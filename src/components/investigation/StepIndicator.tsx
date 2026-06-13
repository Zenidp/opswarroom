import type { AgentStep } from '@/lib/agent/types'
import { Spinner } from '@/components/ui/Spinner'

export function StepIndicator({ step }: { step: AgentStep }) {
  return (
    <div className="flex items-center gap-2">
      {step.status === 'running' ? (
        <Spinner className="h-5 w-5" />
      ) : (
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
            step.status === 'done'
              ? 'bg-emerald-500/20 text-emerald-400'
              : step.status === 'error'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-slate-500/20 text-slate-500'
          }`}
        >
          {step.status === 'done' ? '✓' : step.status === 'error' ? '✗' : step.step}
        </span>
      )}
      <span className="text-xs text-slate-500">
        {step.step}/{step.total}
      </span>
    </div>
  )
}
