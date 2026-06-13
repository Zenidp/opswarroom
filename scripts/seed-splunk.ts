/**
 * Seeds Splunk HEC with realistic sample events for demo.
 * Creates a "CPU spike → app error cascade" scenario.
 * Safe to run multiple times (events are timestamped).
 *
 * Usage: npm run seed
 */

import { sendHECEvents, type HECEvent } from '../src/lib/splunk/hec-client'

if (!process.env.SPLUNK_HEC_URL || !process.env.SPLUNK_HEC_TOKEN) {
  console.error('SPLUNK_HEC_URL and SPLUNK_HEC_TOKEN must be set')
  process.exit(1)
}

function nowMinus(minutes: number) {
  return Math.floor((Date.now() - minutes * 60 * 1000) / 1000)
}

// Infra metrics as a 3-hour time series at 5-min resolution so Splunk's native
// ML commands (predict, anomalydetection) have enough history to forecast a
// baseline and flag the CPU spike at the tail as a real anomaly.
// Spike window: last ~25 minutes. Quiet baseline before that.
const HOSTS = ['web-prod-01', 'web-prod-02', 'web-prod-03']
const POINTS = 36 // 36 × 5min = 180min (3h)
const SPIKE_AFTER_POINT = 31 // last ~5 points (~25min) are the spike

const infraEvents: HECEvent[] = HOSTS.flatMap(host =>
  Array.from({ length: POINTS }, (_, i) => {
    const minutesAgo = (POINTS - 1 - i) * 5
    const spiking = i >= SPIKE_AFTER_POINT
    return {
      time: nowMinus(minutesAgo),
      host,
      source: 'metrics',
      sourcetype: 'infra_metric',
      index: 'main',
      event: {
        cpu_pct: spiking ? 86 + Math.random() * 11 : 22 + Math.random() * 13,
        mem_pct: spiking ? 79 + Math.random() * 9 : 46 + Math.random() * 9,
        host,
        region: 'ap-southeast-1',
        service: 'api-gateway',
      },
    }
  })
)

// Generate app error cascade
const appErrors: HECEvent[] = [
  'api-gateway', 'user-service', 'payment-service', 'notification-service',
].flatMap((service, si) =>
  Array.from({ length: 8 }, (_, i) => ({
    time: nowMinus(20 - i - si * 2),
    host: `app-prod-0${(i % 2) + 1}`,
    source: 'application',
    sourcetype: 'app_error',
    index: 'main',
    event: {
      service,
      error_code: si === 0 ? 'TIMEOUT' : si === 1 ? 'CONNECTION_REFUSED' : '500',
      severity: si < 2 ? 'ERROR' : 'WARNING',
      host: `app-prod-0${(i % 2) + 1}`,
      count: 10 + i * 5,
      message: `${service} failed: upstream timeout after 30s`,
      trace_id: `trace-${Math.random().toString(36).slice(2, 10)}`,
    },
  }))
)

// Generate network anomalies
const networkEvents: HECEvent[] = Array.from({ length: 10 }, (_, i) => ({
  time: nowMinus(25 - i),
  host: `lb-prod-01`,
  source: 'network',
  sourcetype: 'net_event',
  index: 'main',
  event: {
    src_ip: `10.0.${i}.${i * 3}`,
    dst_port: 443,
    bytes: 500000 + i * 100000,
    protocol: 'TCP',
    action: i > 5 ? 'dropped' : 'allowed',
    interface: 'eth0',
  },
}))

async function main() {
  console.log('Seeding Splunk with sample incident data...')

  console.log('  → Sending infrastructure metrics...')
  await sendHECEvents(infraEvents)
  console.log(`     ✓ ${infraEvents.length} metric events`)

  console.log('  → Sending application errors...')
  await sendHECEvents(appErrors)
  console.log(`     ✓ ${appErrors.length} error events`)

  console.log('  → Sending network anomalies...')
  await sendHECEvents(networkEvents)
  console.log(`     ✓ ${networkEvents.length} network events`)

  console.log('\nSeed complete. Sample SPL queries to try:')
  console.log('  index=main error_code=TIMEOUT | stats count by service')
  console.log('  index=main sourcetype=infra_metric cpu_pct>80 | stats avg(cpu_pct) by host')
  console.log('  index=main sourcetype=net_event action=dropped | stats count by src_ip')
}

main().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
