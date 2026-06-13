import { runSplunkQuery, explainSPL } from '../../splunk/mcp-client'

export interface CorrelateResult {
  correlatedIndexes: string[]
  correlatedEvents: Record<string, unknown>[]
  correlationHits: number
  explanation: string
  affectedServices: string[]
}

export async function correlateContext(
  anomalySpl: string,
  anomalyEvents: Record<string, unknown>[]
): Promise<CorrelateResult> {
  // Extract service names from anomaly events
  const services = [...new Set(
    anomalyEvents
      .map(e => e.service as string | undefined)
      .filter(Boolean)
  )] as string[]

  const correlatedEvents: Record<string, unknown>[] = []
  const correlatedIndexes: string[] = []

  // Correlate across sourcetypes within the same time window
  // (Splunk Cloud trial keeps all data in index=main)
  const correlationSourcetypes = ['app_error', 'infra_metric', 'net_event']

  for (const st of correlationSourcetypes) {
    const corrSpl = services.length > 0
      ? `index=main sourcetype=${st} (${services.map(s => `service="${s}"`).join(' OR ')} OR action=dropped OR cpu_pct>80) earliest=-3h | head 20`
      : `index=main sourcetype=${st} earliest=-3h | head 10`

    const result = await runSplunkQuery(corrSpl)
    if (result.events.length > 0) {
      correlatedEvents.push(...result.events)
      correlatedIndexes.push(st)
    }
  }

  const explanation = correlatedEvents.length > 0
    ? await explainSPL(anomalySpl, JSON.stringify(correlatedEvents.slice(0, 10)))
    : 'No correlated events found in related indexes.'

  return {
    correlatedIndexes,
    correlatedEvents,
    correlationHits: correlatedIndexes.length,
    explanation,
    affectedServices: services,
  }
}
