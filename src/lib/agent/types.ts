export type StepStatus = 'pending' | 'running' | 'done' | 'error'
export type Severity = 1 | 2 | 3 | 4 | 5

export interface AgentStep {
  step: number
  total: number
  label: string
  status: StepStatus
  data?: Record<string, unknown>
  error?: string
  durationMs?: number
}

export interface RunbookEntry {
  order: number
  action: string
  rationale: string
  command?: string
}

export interface Incident {
  id: string
  triggeredAt: string
  query: string
  context: string
  severity: Severity
  severityLabel: 'critical' | 'high' | 'medium' | 'low' | 'info'
  rootCause: string
  affectedServices: string[]
  steps: AgentStep[]
  runbook: RunbookEntry[]
  status: 'investigating' | 'complete' | 'error'
  /** ISO timestamp when an operator approved the runbook (human-in-the-loop) */
  approvedAt?: string
}

export interface InvestigateRequest {
  query: string
  context?: string
}

export type SSEEvent =
  | { type: 'step'; payload: AgentStep }
  | { type: 'complete'; payload: Incident }
  | { type: 'error'; payload: { message: string } }
