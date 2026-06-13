import type { Severity } from '../agent/types'

export interface SeverityInput {
  eventCount: number
  baselineCount: number
  affectedServiceTiers: ('critical' | 'high' | 'medium' | 'low')[]
  correlationHits: number
  anomalyDurationMinutes: number
}

export function scoreSeverity(input: SeverityInput): Severity {
  let score = 0

  const spikeRatio = input.baselineCount > 0
    ? input.eventCount / input.baselineCount
    : input.eventCount > 0 ? 10 : 0

  if (spikeRatio >= 10) score += 3
  else if (spikeRatio >= 5) score += 2
  else if (spikeRatio >= 2) score += 1

  const hasCritical = input.affectedServiceTiers.includes('critical')
  const hasHigh = input.affectedServiceTiers.includes('high')
  if (hasCritical) score += 3
  else if (hasHigh) score += 2
  else score += 1

  if (input.correlationHits >= 3) score += 2
  else if (input.correlationHits >= 1) score += 1

  if (input.anomalyDurationMinutes >= 30) score += 2
  else if (input.anomalyDurationMinutes >= 10) score += 1

  const clamped = Math.max(1, Math.min(5, Math.ceil(score / 2))) as Severity
  return clamped
}

export function severityLabel(s: Severity): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  switch (s) {
    case 5: return 'critical'
    case 4: return 'high'
    case 3: return 'medium'
    case 2: return 'low'
    default: return 'info'
  }
}
