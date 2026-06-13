import { NextResponse } from 'next/server'
import { checkConnection } from '@/lib/splunk/mcp-client'

export async function GET() {
  const splunkConnected = await checkConnection()
  return NextResponse.json({
    status: splunkConnected ? 'ok' : 'degraded',
    splunk: splunkConnected ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }, { status: splunkConnected ? 200 : 503 })
}
