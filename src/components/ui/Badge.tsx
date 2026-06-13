import type { Incident } from '@/lib/agent/types'

type SeverityLabel = Incident['severityLabel']

const styles: Record<SeverityLabel, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/40',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  info: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
}

export function SeverityBadge({ label, severity }: { label: SeverityLabel; severity?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[label]}`}>
      {label}
      {severity !== undefined && <span className="opacity-70">S{severity}</span>}
    </span>
  )
}

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-surface-border bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-slate-300 ${className}`}>
      {children}
    </span>
  )
}
