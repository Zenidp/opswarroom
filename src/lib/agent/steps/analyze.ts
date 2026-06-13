import { analyzeRootCause } from '../../splunk/hosted-models'
import type { DetectResult } from './detect'
import type { CorrelateResult } from './correlate'

export interface AnalyzeResult {
  rootCause: string
  affectedServices: string[]
}

export async function analyzeIncident(
  detect: DetectResult,
  correlate: CorrelateResult,
  originalContext: string
): Promise<AnalyzeResult> {
  const anomalyContext = `
Query: ${detect.spl}
Event count: ${detect.eventCount} (baseline: ${detect.baselineCount})
Duration: ~${detect.anomalyDurationMinutes} minutes
Splunk ML: ${detect.ml.summary}
Sample events: ${JSON.stringify(detect.events.slice(0, 5))}
Original alert context: ${originalContext}
`.trim()

  const correlatedLogs = correlate.correlatedEvents.length > 0
    ? `Found in ${correlate.correlatedIndexes.join(', ')}:\n${JSON.stringify(correlate.correlatedEvents.slice(0, 10))}`
    : 'No correlated events found in related indexes.'

  const rootCause = await analyzeRootCause(anomalyContext, correlatedLogs, detect.ml.summary)

  const affectedServices = correlate.affectedServices.length > 0
    ? correlate.affectedServices
    : ['unknown']

  return { rootCause, affectedServices }
}
