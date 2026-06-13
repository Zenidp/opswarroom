import { NextResponse } from 'next/server'
import { listIncidents } from '@/lib/store/incidents'

export async function GET() {
  const incidents = listIncidents()
  return NextResponse.json({ incidents, total: incidents.length })
}
