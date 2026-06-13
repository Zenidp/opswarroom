import { runSplunkQuery, generateSPL } from '../../splunk/mcp-client'
import { runMetricML, type MLResult } from '../../splunk/ml'

export interface DetectResult {
  spl: string
  events: Record<string, unknown>[]
  eventCount: number
  baselineCount: number
  anomalyDurationMinutes: number
  /** SPL of the Splunk ML commands run at detection time (for UI/demo) */
  mlSpl: string[]
  /** structured output of Splunk's native ML (anomalydetection + predict) */
  ml: MLResult
}

export async function detectAnomaly(query: string): Promise<DetectResult> {
  let spl = query

  // If query looks like natural language, generate SPL from it
  if (!query.trim().startsWith('index=') && !query.trim().startsWith('search ')) {
    spl = await generateSPL(query)
  }

  // Base search (event list) + baseline count, plus the native ML pass that
  // actually drives anomaly detection (Splunk anomalydetection + predict).
  const [result, baselineResult, ml] = await Promise.all([
    runSplunkQuery(spl),
    runSplunkQuery(`${spl} earliest=-24h latest=-1h | stats count as baseline_count`),
    runMetricML('infra_metric', ['cpu_pct', 'mem_pct'], '-3h'),
  ])

  const baselineCount = Number(baselineResult.events?.[0]?.baseline_count ?? 0)

  // Anomaly duration comes from the ML elevated-event window when available,
  // with a sane floor so severity scoring stays meaningful.
  const anomalyDurationMinutes = ml.windowMinutes > 0 ? ml.windowMinutes : 15

  return {
    spl,
    events: result.events,
    eventCount: result.events.length,
    baselineCount,
    anomalyDurationMinutes,
    mlSpl: ml.mlSpl,
    ml,
  }
}
