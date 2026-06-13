import Link from 'next/link'
import type { Incident } from '@/lib/agent/types'
import { SeverityBadge, Badge } from '@/components/ui/Badge'

export function IncidentCard({ incident }: { incident: Incident }) {
  const time = new Date(incident.triggeredAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="block rounded-xl border border-surface-border bg-surface-raised p-4 transition hover:border-cyan-500/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-100">{incident.query}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{incident.rootCause}</p>
        </div>
        <SeverityBadge label={incident.severityLabel} severity={incident.severity} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{time}</span>
        <span>·</span>
        <span>{incident.runbook.length} runbook steps</span>
        {incident.affectedServices.slice(0, 3).map(s => (
          <Badge key={s}>{s}</Badge>
        ))}
        {incident.affectedServices.length > 3 && (
          <Badge>+{incident.affectedServices.length - 3}</Badge>
        )}
      </div>
    </Link>
  )
}
