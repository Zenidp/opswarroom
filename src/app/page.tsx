import { IncidentFeed } from '@/components/dashboard/IncidentFeed'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Incident War Room</h1>
        <p className="mt-1 text-sm text-slate-400">
          Trigger an agentic investigation: detect → correlate → analyze → remediate, streamed live from Splunk.
        </p>
      </div>
      <IncidentFeed />
    </div>
  )
}
