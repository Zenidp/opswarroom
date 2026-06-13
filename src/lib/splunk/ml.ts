/**
 * Splunk native ML/AI detection, executed at runtime via the MCP Server's
 * `splunk_run_query` tool. Uses Splunk's built-in `predict` (time-series
 * forecasting) and `anomalydetection` commands — these run inside Splunk Cloud,
 * not in our process. This is the project's real "Splunk AI at runtime".
 *
 * `predict` is the primary signal: it is robust and always meaningful (forecast
 * vs. baseline). `anomalydetection` runs alongside and is reported when it flags
 * statistical outliers — note it only fires when anomalies are *rare* in the
 * window, so under continuous similar data it may legitimately report none.
 *
 * (The Splunk AI Assistant `saia_*` tools and hosted GPT models are kept as
 *  best-effort calls elsewhere but are not provisioned on the trial tier.)
 */
import { runSplunkQuery } from './mcp-client'

export interface MLForecast {
  field: string
  predicted: number
  upper95: number
  lower95: number
  baseline: number
}

export interface MLResult {
  forecast: MLForecast
  /** events flagged by Splunk anomalydetection (rare-outlier model) */
  anomalyCount: number
  /** events exceeding a baseline-derived threshold (robust elevated-load count) */
  elevatedCount: number
  affectedHosts: string[]
  peakValue: number
  /** anomaly window in minutes, from the elevated-event time range */
  windowMinutes: number
  /** the SPL ML commands actually run, for display in the UI / demo */
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

/** Splunk `predict`: forecast the next value of a metric series + 95% CI, plus a baseline mean. */
async function forecastTrend(sourcetype: string, field: string, earliest: string): Promise<{ forecast: MLForecast; spl: string }> {
  const spl =
    `search index=main sourcetype=${sourcetype} earliest=${earliest} ` +
    `| timechart span=5m avg(${field}) as ${field} ` +
    `| predict ${field} as predicted | tail 1`
  const { events } = await runSplunkQuery(spl)
  const row = events[0] ?? {}

  const baseRes = await runSplunkQuery(
    `search index=main sourcetype=${sourcetype} earliest=${earliest} latest=-30m | stats avg(${field}) as baseline`
  )
  const baseline = num(baseRes.events[0]?.baseline)

  return {
    forecast: {
      field,
      predicted: num(row.predicted),
      upper95: num(row['upper95(predicted)']),
      lower95: num(row['lower95(predicted)']),
      baseline,
    },
    spl,
  }
}

/** Splunk `anomalydetection`: count statistical-outlier events (rare-event model). */
async function anomalyDetectionCount(sourcetype: string, fields: string[], earliest: string): Promise<{ count: number; spl: string }> {
  const spl =
    `search index=main sourcetype=${sourcetype} earliest=${earliest} ` +
    `| anomalydetection ${fields.join(' ')} | stats count as anomalies`
  const { events } = await runSplunkQuery(spl)
  return { count: num(events[0]?.anomalies), spl }
}

/**
 * Combined metric ML pass. `predict` drives the headline; a baseline-derived
 * threshold (not a hardcoded constant) gives a robust elevated-load count,
 * peak, affected hosts and window; `anomalydetection` runs alongside.
 */
export async function runMetricML(
  sourcetype = 'infra_metric',
  fields = ['cpu_pct', 'mem_pct'],
  earliest = '-3h'
): Promise<MLResult> {
  const field = fields[0]
  const [{ forecast, spl: predictSpl }, ad] = await Promise.all([
    forecastTrend(sourcetype, field, earliest),
    anomalyDetectionCount(sourcetype, fields, earliest),
  ])

  // Threshold derived from the ML-computed baseline (1.5×), not a magic constant.
  const threshold = forecast.baseline > 0 ? forecast.baseline * 1.5 : 70
  const elevatedRes = await runSplunkQuery(
    `search index=main sourcetype=${sourcetype} earliest=${earliest} ` +
    `| where ${field} > ${threshold.toFixed(1)} ` +
    `| stats count as n, max(${field}) as peak, values(host) as hosts, range(_time) as span_sec`
  )
  const row = elevatedRes.events[0] ?? {}
  const elevatedCount = num(row.n)
  const peakValue = num(row.peak)
  const affectedHosts = toArray(row.hosts)
  const windowMinutes = Math.round(num(row.span_sec) / 60)

  const ratio = forecast.baseline > 0 ? forecast.predicted / forecast.baseline : 0
  const parts: string[] = []
  parts.push(
    `Splunk predict (ML forecasting) projects ${field} at ${forecast.predicted.toFixed(1)}` +
      (ratio > 0 ? ` — ${ratio.toFixed(1)}× the ${forecast.baseline.toFixed(1)} baseline` : '') +
      ` (95% CI ${forecast.lower95.toFixed(1)}–${forecast.upper95.toFixed(1)}).`
  )
  if (elevatedCount > 0) {
    parts.push(
      `${elevatedCount} ${field} reading(s) exceeded ${threshold.toFixed(1)}, peaking at ${peakValue.toFixed(1)}` +
        (affectedHosts.length ? ` on ${affectedHosts.join(', ')}` : '') + '.'
    )
  }
  if (ad.count > 0) {
    parts.push(`Splunk anomalydetection independently flagged ${ad.count} as statistical outlier(s).`)
  }

  return {
    forecast,
    anomalyCount: ad.count,
    elevatedCount,
    affectedHosts,
    peakValue,
    windowMinutes,
    mlSpl: [predictSpl, ad.spl],
    summary: parts.join(' '),
  }
}
