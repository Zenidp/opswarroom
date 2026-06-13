import type { Incident } from '../agent/types'

const MAX_SIZE = 100
const store = new Map<string, Incident>()

export function saveIncident(incident: Incident): void {
  if (store.size >= MAX_SIZE) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
  store.set(incident.id, incident)
}

export function getIncident(id: string): Incident | undefined {
  return store.get(id)
}

export function listIncidents(): Incident[] {
  return Array.from(store.values())
    .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
}

export function clearIncidents(): void {
  store.clear()
}
