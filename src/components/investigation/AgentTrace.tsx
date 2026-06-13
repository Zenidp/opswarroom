import type { AgentStep } from '@/lib/agent/types'
import { StepIndicator } from './StepIndicator'

const TOTAL_STEPS = 4
const STEP_LABELS = ['Detecting anomaly', 'Correlating logs', 'Analyzing root cause', 'Generating runbook']

// Keys that are rendered by the dedicated Splunk ML panel rather than the
// generic key/value list.
const ML_KEYS = new Set([
  'mlSpl', 'mlSummary', 'mlAnomalyCount', 'mlAffectedHosts', 'mlForecast',
])

type Forecast = { field: string; predicted: number; upper95: number; lower95: number; baseline: number }

function MLPanel({ data }: { data: Record<string, unknown> }) {
  const spl = Array.isArray(data.mlSpl) ? (data.mlSpl as string[]) : []
  const summary = typeof data.mlSummary === 'string' ? data.mlSummary : ''
  const forecast = data.mlForecast as Forecast | undefined
  if (!spl.length && !summary) return null

  return (
    <div className="mt-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-2 text-xs">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-violet-300">
        <span>🧠 Splunk Native ML</span>
        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
          anomalydetection · predict
        </span>
      </div>
      {summary && <p className="text-slate-300">{summary}</p>}
      {forecast && forecast.predicted > 0 && (
        <p className="mt-1 text-slate-400">
          Forecast {forecast.field}:{' '}
          <span className="font-semibold text-violet-300">{forecast.predicted.toFixed(1)}</span>{' '}
          (baseline {forecast.baseline.toFixed(1)}, 95% CI {forecast.lower95.toFixed(1)}–{forecast.upper95.toFixed(1)})
        </p>
      )}
      {spl.map((q, i) => (
        <pre key={i} className="mt-1 overflow-x-auto rounded bg-black/40 p-1.5 font-mono text-[10px] text-emerald-300">
          {q}
        </pre>
      ))}
    </div>
  )
}

function StepData({ data }: { data: Record<string, unknown> }) {
  const generic = Object.entries(data).filter(([key]) => !ML_KEYS.has(key))
  return (
    <>
      <MLPanel data={data} />
      {generic.length > 0 && (
        <dl className="mt-2 space-y-1 text-xs">
          {generic.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="shrink-0 font-medium text-slate-500">{key}:</dt>
              <dd className="whitespace-pre-wrap break-all text-slate-300">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}

export function AgentTrace({ steps }: { steps: AgentStep[] }) {
  // Fill not-yet-emitted steps with pending placeholders so all 4 are visible
  const display: AgentStep[] = Array.from({ length: TOTAL_STEPS }, (_, i) =>
    steps[i] ?? { step: i + 1, total: TOTAL_STEPS, label: STEP_LABELS[i], status: 'pending' }
  )

  return (
    <ol className="space-y-3">
      {display.map(step => (
        <li
          key={step.step}
          className={`rounded-lg border p-3 transition ${
            step.status === 'running'
              ? 'border-cyan-500/40 bg-cyan-500/5'
              : step.status === 'error'
                ? 'border-red-500/40 bg-red-500/5'
                : 'border-surface-border'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepIndicator step={step} />
              <span className={`text-sm font-medium ${step.status === 'pending' ? 'text-slate-500' : 'text-slate-200'}`}>
                {step.label}
              </span>
            </div>
            {step.durationMs !== undefined && (
              <span className="text-xs text-slate-500">{(step.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
          {step.error && <p className="mt-2 text-xs text-red-400">{step.error}</p>}
          {step.data && <StepData data={step.data} />}
        </li>
      ))}
    </ol>
  )
}
