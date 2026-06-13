'use client'

import { useEffect, useState } from 'react'

interface Status {
  status: 'ok' | 'degraded'
  splunk: 'connected' | 'unreachable'
  timestamp: string
}

export function StatusBar() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/status')
        const data = await res.json()
        if (!cancelled) setStatus(data)
      } catch {
        if (!cancelled) setStatus({ status: 'degraded', splunk: 'unreachable', timestamp: new Date().toISOString() })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    poll()
    const interval = setInterval(poll, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const connected = status?.splunk === 'connected'

  return (
    <div className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised px-3 py-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${
          loading ? 'animate-pulse bg-slate-500' : connected ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />
      <span className="text-slate-400">Splunk:</span>
      <span className={loading ? 'text-slate-400' : connected ? 'text-emerald-400' : 'text-red-400'}>
        {loading ? 'checking…' : connected ? 'connected' : 'unreachable'}
      </span>
    </div>
  )
}
