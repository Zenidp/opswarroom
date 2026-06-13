/**
 * Splunk native ML/AI detection, executed at runtime via the MCP Server's
 * `splunk_run_query` tool. Uses Splunk's built-in `anomalydetection` and
 * `predict` commands — these run inside Splunk Cloud, not in our process.
 *
 * This is the project's real "Splunk AI at runtime": no fallback simulation.
 * (The Splunk AI Assistant `saia_*` tools and hosted GPT models are kept as
 *  best-effort calls elsewhere but are not provisioned on the trial tier.)
 */
import { runSplunkQuery } from './mcp-client'

export interface MLAnomalyFinding {
  /** number of events Splunk anomalydetection flagged as anomalous */
  anomalyCount: number
  affectedHosts: string[]
  maxValue: number
  avgValue: number
  field: string
  /** anomaly window in minutes, derived from flagged-event time range */
  windowMinutes: number
  spl: string
}

export interface MLForecastFinding {
  field: string
  predicted: number
  upper95: number
  lower95: number
  /** mean of the field over the baseline period, for contrast */
  baseline: number
  spl: string
}

export interface MLResult {
  anomaly: MLAnomalyFinding
  forecast: MLForecastFinding
  /** the SPL commands actually run, for display in the UI / demo */
  mlSpl: string[]
  /** human-readable summary grounded in the ML output */
  summary: string
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (v === undefined || v === null || v === '') return []
  return [String(v)]
}

/**
 * Runs Splunk's `anomalydetection` ML command over a metric sourcetype and
 * summarizes the flagged outliers.
 */
export async function detectAnomaliesAD(
  sourcetype: string,
  fields: string[],
  earliest = '-3h'
): Promise<MLAnomalyFinding> {
  const primary = fields[0]
  const fieldList = fields.join(' ')
  const spl =
    `search index=main sourcetype=${sourcetype} earliest=${earliest} ` +
    `| anomalydetection ${fieldList} ` +
    `| stats count as anomalies, avg(${primary}) as avg_val, max(${primary}) as max_val, ` +
    `values(host) as hosts, range(_time) as span_sec`

  const { events } = await runSplunkQuery(spl)
  const row = events[0] ?? {}
  return {
    anomalyCount: num(row.anomalies),
    affectedHosts: toArray(row.hosts),
    maxValue: num(row.max_val),
    avgValue: num(row.avg_val),
    field: primary,
    windowMinutes: Math.round(num(row.span_sec) / 60),
    spl,
  }
}

/**
 * Runs Splunk's `predict` ML command to forecast the next value of a metric
 * series, with a 95% confidence interval. Also computes a baseline mean for
 * contrast.
 */
export async function forecastTrend(
  sourcetype: string,
  field: string,
  earliest = '-3h'
): Promise<MLForecastFinding> {
  const spl =
    `search index=main sourcetype=${sourcetype} earliest=${earliest} ` +
    `| timechart span=5m avg(${field}) as ${field} ` +
    `| predict ${field} as predicted | tail 1`

  const { events } = await runSplunkQuery(spl)
  const row = events[0] ?? {}

  // Baseline: average of the field over the older two-thirds of the window.
  const baseSpl =
    `search index=main sourcetype=${sourcetype} earliest=${earliest} latest=-30m ` +
    `| stats avg(${field}) as baseline`
  const baseRes = await runSplunkQuery(baseSpl)
  const baseline = num(baseRes.events[0]?.baseline)

  return {
    field,
    predicted: num(row.predicted),
    upper95: num(row['upper95(predicted)']),
    lower95: num(row['lower95(predicted)']),
    baseline,
    spl,
  }
}

/**
 * Combined metric ML pass: anomaly detection + forecast. Produces a summary
 * grounded entirely in the values Splunk's ML commands returned.
 */
export async function runMetricML(
  sourcetype = 'infra_metric',
  fields = ['cpu_pct', 'mem_pct'],
  earliest = '-3h'
): Promise<MLResult> {
  const [anomaly, forecast] = await Promise.all([
    detectAnomaliesAD(sourcetype, fields, earliest),
    forecastTrend(sourcetype, fields[0], earliest),
  ])

  const parts: string[] = []
  if (anomaly.anomalyCount > 0) {
    parts.push(
      `Splunk anomalydetection flagged ${anomaly.anomalyCount} anomalous ${sourcetype} ` +
        `event(s) — ${anomaly.field} peaked at ${anomaly.maxValue.toFixed(1)} ` +
        `(avg ${anomaly.avgValue.toFixed(1)})` +
        (anomaly.affectedHosts.length ? ` on ${anomaly.affectedHosts.join(', ')}` : '') +
        '.'
    )
  } else {
    parts.push(`Splunk anomalydetection found no ${anomaly.field} outliers in the window.`)
  }
  if (forecast.predicted > 0) {
    parts.push(
      `Splunk predict forecasts ${forecast.field} at ${forecast.predicted.toFixed(1)} ` +
        `(95% CI ${forecast.lower95.toFixed(1)}–${forecast.upper95.toFixed(1)}) ` +
        `vs a baseline of ${forecast.baseline.toFixed(1)}.`
    )
  }

  return {
    anomaly,
    forecast,
    mlSpl: [anomaly.spl, forecast.spl],
    summary: parts.join(' '),
  }
}
