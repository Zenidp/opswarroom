import { v4 as uuidv4 } from 'uuid'
import { detectAnomaly } from './steps/detect'
import { correlateContext } from './steps/correlate'
import { analyzeIncident } from './steps/analyze'
import { remediateIncident } from './steps/remediate'
import { saveIncident } from '../store/incidents'
import type { Incident, AgentStep, SSEEvent } from './types'

type Emitter = (event: SSEEvent) => void

export async function runInvestigation(
  query: string,
  context: string,
  emit: Emitter
): Promise<Incident> {
  const id = uuidv4()
  const steps: AgentStep[] = []
  const startTime = Date.now()

  function emitStep(step: number, label: string, status: AgentStep['status'], data?: Record<string, unknown>, error?: string): AgentStep {
    const agentStep: AgentStep = {
      step,
      total: 4,
      label,
      status,
      data,
      error,
      durationMs: status === 'done' || status === 'error' ? Date.now() - startTime : undefined,
    }
    steps[step - 1] = agentStep
    emit({ type: 'step', payload: agentStep })
    return agentStep
  }

  try {
    // Step 1: Detect
    emitStep(1, 'Detecting anomaly', 'running')
    const detect = await detectAnomaly(query)
    emitStep(1, 'Detecting anomaly', 'done', {
      eventCount: detect.eventCount,
      baselineCount: detect.baselineCount,
      spl: detect.spl,
      mlSpl: detect.mlSpl,
      mlSummary: detect.ml.summary,
      mlAnomalyCount: detect.ml.anomalyCount,
      mlAffectedHosts: detect.ml.affectedHosts,
      mlForecast: detect.ml.forecast,
    })

    // Step 2: Correlate
    emitStep(2, 'Correlating logs', 'running')
    const correlate = await correlateContext(detect.spl, detect.events)
    emitStep(2, 'Correlating logs', 'done', {
      correlatedIndexes: correlate.correlatedIndexes,
      correlationHits: correlate.correlationHits,
      explanation: correlate.explanation,
    })

    // Step 3: Analyze
    emitStep(3, 'Analyzing root cause', 'running')
    const analyze = await analyzeIncident(detect, correlate, context)
    emitStep(3, 'Analyzing root cause', 'done', {
      rootCause: analyze.rootCause,
      affectedServices: analyze.affectedServices,
    })

    // Step 4: Remediate
    emitStep(4, 'Generating runbook', 'running')
    const remediate = await remediateIncident(
      analyze.rootCause,
      analyze.affectedServices,
      detect,
      correlate
    )
    emitStep(4, 'Generating runbook', 'done', {
      severity: remediate.severity,
      runbookSteps: remediate.runbook.length,
    })

    const incident: Incident = {
      id,
      triggeredAt: new Date().toISOString(),
      query,
      context,
      severity: remediate.severity,
      severityLabel: remediate.severityLabel,
      rootCause: analyze.rootCause,
      affectedServices: analyze.affectedServices,
      steps,
      runbook: remediate.runbook,
      status: 'complete',
    }

    saveIncident(incident)
    emit({ type: 'complete', payload: incident })
    return incident

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const failedStep = steps.findIndex(s => s.status === 'running') + 1
    if (failedStep > 0) {
      emitStep(failedStep, steps[failedStep - 1].label, 'error', undefined, message)
    }
    emit({ type: 'error', payload: { message } })
    throw err
  }
}
