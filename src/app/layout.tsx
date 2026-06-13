import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusBar } from '@/components/dashboard/StatusBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'OpsWarRoom — Agentic Incident Investigation',
  description:
    'Automated incident investigation powered by Splunk MCP Server and Splunk Hosted Models. Detect, correlate, analyze, and remediate — streamed live.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-surface-border">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">🚨</span>
              <span className="text-lg font-bold text-slate-100">
                Ops<span className="text-cyan-400">WarRoom</span>
              </span>
            </Link>
            <StatusBar />
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-4xl px-6 pb-8 text-center text-xs text-slate-600">
          Built for the Splunk Agentic Ops Hackathon — powered by Splunk MCP Server &amp; Hosted Models
        </footer>
      </body>
    </html>
  )
}
