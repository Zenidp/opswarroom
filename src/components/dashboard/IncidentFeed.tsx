'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentStep, Incident, SSEEvent } from '@/lib/agent/types'
import { IncidentCard } from './IncidentCard'
import { AgentTrace } from '@/components/investigation/AgentTrace'
import { Spinner } from '@/components/ui/Spinner'
import { ToastStack, type ToastMessage } from '@/components/ui/Toast'
import { saveClientIncident, listClientIncidents, clearClientIncidents } from '@/lib/store/clientIncidents'

const DEFAULT_QUERY = 'CPU spike on web-prod hosts causing app error cascade'

export function IncidentFeed() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [investigating, setInvestigating] = useState(false)
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toastId = useRef(0)

  const pushToast = useCallback((text: string, kind: ToastMessage['kind']) => {
    setToasts(prev => [...prev, { id: ++toastId.current, text, kind }])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const loadIncidents = useCallback(() => {
    // History is read from the browser store: the server-side Map does not
    // persist across Vercel serverless invocations.
    setIncidents(listClientIncidents())
  }, [])

  useEffect(() => {
    loadIncidents()
  }, [loadIncidents])

  async function triggerInvestigation() {
    if (investigating || !query.trim()) return
    setInvestigating(true)
    setLiveSteps([])

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.toString() ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let completedIncident: Incident | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const line = frame.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          const event: SSEEvent = JSON.parse(line.slice(6))

          if (event.type === 'step') {
            setLiveSteps(prev => {
              const next = [...prev]
              next[event.payload.step - 1] = event.payload
              return next
            })
          } else if (event.type === 'complete') {
            completedIncident = event.payload
          } else if (event.type === 'error') {
            throw new Error(event.payload.message)
          }
        }
      }

      if (completedIncident) {
        saveClientIncident(completedIncident)
        pushToast('Investigation complete', 'success')
        loadIncidents()
        router.push(`/incidents/${completedIncident.id}`)
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Investigation failed', 'error')
    } finally {
      setInvestigating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <label htmlFor="query" className="text-sm font-medium text-slate-300">
          Describe the anomaly to investigate
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && triggerInvestigation()}
            disabled={investigating}
            className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500/60 disabled:opacity-50"
            placeholder="e.g. CPU spike on web-prod hosts"
          />
          <button
            onClick={triggerInvestigation}
            disabled={investigating || !query.trim()}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-surface transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {investigating && <Spinner className="h-4 w-4 text-surface" />}
            {investigating ? 'Investigating…' : 'Trigger investigation'}
          </button>
        </div>
      </div>

      {(investigating || liveSteps.length > 0) && (
        <div className="rounded-xl border border-cyan-500/30 bg-surface-raised p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Live agent trace
          </h2>
          <AgentTrace steps={liveSteps} />
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Incident history ({incidents.length})
          </h2>
          {incidents.length > 0 && (
            <button
              onClick={() => {
                clearClientIncidents()
                setIncidents([])
                pushToast('Incident history cleared', 'success')
              }}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-red-500/50 hover:text-red-400"
            >
              Clear history
            </button>
          )}
        </div>
        {incidents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border p-8 text-center text-sm text-slate-500">
            No incidents yet. Trigger an investigation to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {incidents.map(inc => <IncidentCard key={inc.id} incident={inc} />)}
          </div>
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
