/**
 * Splunk HEC (HTTP Event Collector) client.
 * Used by scripts/seed-splunk.ts to push sample events.
 */

export interface HECEvent {
  time: number
  host: string
  source: string
  sourcetype: string
  index: string
  event: Record<string, unknown>
}

function getHECConfig(): { url: string; token: string } {
  const url = process.env.SPLUNK_HEC_URL
  const token = process.env.SPLUNK_HEC_TOKEN
  if (!url) throw new Error('SPLUNK_HEC_URL is not set')
  if (!token) throw new Error('SPLUNK_HEC_TOKEN is not set')
  return { url, token }
}

export async function sendHECEvents(events: HECEvent[]): Promise<unknown> {
  const { url, token } = getHECConfig()
  const body = events.map(e => JSON.stringify(e)).join('\n')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Splunk ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HEC error ${res.status}: ${text}`)
  }
  return res.json()
}
