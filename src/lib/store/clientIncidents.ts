import type { Incident } from '../agent/types'

/**
 * Browser-side incident store (localStorage). The server-side store is an
 * in-memory Map that does NOT survive across Vercel serverless invocations, so
 * the incident saved during POST /api/investigate is not visible to a later
 * request for the detail page. The completed incident is already available on
 * the client, so we persist it here — this makes the dashboard + detail view
 * reliable on serverless without a database.
 */
const KEY = 'opswarroom:incidents'
const MAX = 50

function readAll(): Incident[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Incident[]) : []
  } catch {
    return []
  }
}

function writeAll(list: Incident[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* quota or serialization error — ignore */
  }
}

export function saveClientIncident(incident: Incident): void {
  const list = readAll().filter(i => i.id !== incident.id)
  list.unshift(incident)
  writeAll(list)
}

export function getClientIncident(id: string): Incident | undefined {
  return readAll().find(i => i.id === id)
}

export function listClientIncidents(): Incident[] {
  return readAll().sort(
    (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  )
}

/** Clears all locally stored incidents. */
export function clearClientIncidents(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Records operator approval of an incident's runbook; returns the updated incident. */
export function markIncidentApproved(id: string): Incident | undefined {
  const list = readAll()
  const incident = list.find(i => i.id === id)
  if (!incident) return undefined
  incident.approvedAt = new Date().toISOString()
  writeAll(list)
  return incident
}
