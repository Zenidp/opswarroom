'use client'

import { useState } from 'react'
import type { Incident } from '@/lib/agent/types'
import { markIncidentApproved } from '@/lib/store/clientIncidents'

export function RunbookViewer({ incident }: { incident: Incident }) {
  const [approvedAt, setApprovedAt] = useState<string | undefined>(incident.approvedAt)
  const approved = !!approvedAt

  function approve() {
    const updated = markIncidentApproved(incident.id)
    setApprovedAt(updated?.approvedAt ?? new Date().toISOString())
  }

  function exportMarkdown() {
    const lines = [
      `# Runbook — ${incident.query}`,
      '',
      `**Severity:** ${incident.severityLabel} (S${incident.severity})`,
      `**Root cause:** ${incident.rootCause}`,
      `**Affected services:** ${incident.affectedServices.join(', ')}`,
      '',
      ...incident.runbook.flatMap(entry => [
        `## ${entry.order}. ${entry.action}`,
        '',
        entry.rationale,
        ...(entry.command ? ['', '```bash', entry.command, '```'] : []),
        '',
      ]),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `runbook-${incident.id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Remediation runbook
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportMarkdown}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500/50"
          >
            Export .md
          </button>
          <button
            onClick={approve}
            disabled={approved}
            title={approvedAt ? `Approved at ${new Date(approvedAt).toLocaleString()}` : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              approved
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-cyan-500 text-surface hover:bg-cyan-400'
            }`}
          >
            {approved
              ? `✓ Approved ${new Date(approvedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Approve'}
          </button>
        </div>
      </div>

      <ol className="space-y-4">
        {incident.runbook.map(entry => (
          <li key={entry.order} className="rounded-lg border border-surface-border p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-400">
                {entry.order}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{entry.action}</p>
                <p className="mt-1 text-sm text-slate-400">{entry.rationale}</p>
                {entry.command && (
                  <pre className="mt-2 overflow-x-auto rounded bg-surface p-2 text-xs text-cyan-300">
                    <code>{entry.command}</code>
                  </pre>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
