import { generateRunbook } from '../../splunk/hosted-models'
import type { RunbookEntry } from '../types'
import { scoreSeverity, severityLabel } from '../../utils/severity'
import type { DetectResult } from './detect'
import type { CorrelateResult } from './correlate'
import type { Severity } from '../types'

export interface RemediateResult {
  runbook: RunbookEntry[]
  severity: Severity
  severityLabel: 'critical' | 'high' | 'medium' | 'low' | 'info'
}

export async function remediateIncident(
  rootCause: string,
  affectedServices: string[],
  detect: DetectResult,
  correlate: CorrelateResult
): Promise<RemediateResult> {
  const severity = scoreSeverity({
    eventCount: detect.eventCount,
    baselineCount: detect.baselineCount,
    affectedServiceTiers: affectedServices.length > 0 ? ['high'] : ['medium'],
    correlationHits: correlate.correlationHits,
    anomalyDurationMinutes: detect.anomalyDurationMinutes,
  })

  const rawRunbook = await generateRunbook(rootCause, affectedServices)

  let runbook: RunbookEntry[] = []
  try {
    runbook = JSON.parse(rawRunbook)
  } catch {
    runbook = [{
      order: 1,
      action: 'Investigate manually',
      rationale: 'Automated runbook generation failed. Review logs manually.',
      command: undefined,
    }]
  }

  return {
    runbook,
    severity,
    severityLabel: severityLabel(severity),
  }
}
