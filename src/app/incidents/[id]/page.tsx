import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getIncident } from '@/lib/store/incidents'
import { AgentTrace } from '@/components/investigation/AgentTrace'
import { RunbookViewer } from '@/components/investigation/RunbookViewer'
import { SeverityBadge, Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const incident = getIncident(id)
  if (!incident) notFound()

  const time = new Date(incident.triggeredAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-cyan-400 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100">{incident.query}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Triggered {time} · ID {incident.id.slice(0, 8)}
            </p>
          </div>
          <SeverityBadge label={incident.severityLabel} severity={incident.severity} />
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Root cause</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{incident.rootCause}</p>
        </div>

        {incident.affectedServices.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Affected services:</span>
            {incident.affectedServices.map(s => <Badge key={s}>{s}</Badge>)}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Agent trace
        </h2>
        <AgentTrace steps={incident.steps} />
      </div>

      <RunbookViewer incident={incident} />
    </div>
  )
}
