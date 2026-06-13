export interface MCPQueryResult {
  events: Record<string, unknown>[]
  rawText: string
}

function getConfig() {
  const url = process.env.SPLUNK_MCP_URL
  const token = process.env.SPLUNK_MCP_TOKEN ?? process.env.SPLUNK_TOKEN
  if (!url) throw new Error('SPLUNK_MCP_URL is not set')
  if (!token) throw new Error('SPLUNK_TOKEN is not set')
  return { url, token }
}

async function callMCP(method: string, params: Record<string, unknown>): Promise<unknown> {
  const { url, token } = getConfig()
  let retries = 0
  while (retries < 3) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      })
      if (!res.ok) throw new Error(`MCP HTTP ${res.status}`)
      const json = await res.json() as { result?: unknown; error?: { message: string } }
      if (json.error) throw new Error(`MCP error: ${json.error.message}`)
      return json.result
    } catch (err) {
      retries++
      if (retries >= 3) throw err
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, retries)))
    }
  }
  throw new Error('MCP failed after 3 retries')
}

function isToolError(result: unknown, text: string): boolean {
  if (result && typeof result === 'object' && (result as Record<string, unknown>).isError === true) return true
  return /^\{"error"|Missing required argument|Service not initialized/i.test(text)
}

function extractToolText(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result ?? '')
  const r = result as Record<string, unknown>
  if (Array.isArray(r.content)) {
    return (r.content as Array<{ type?: string; text?: string }>)
      .filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('\n')
  }
  return JSON.stringify(result)
}

export async function runSplunkQuery(spl: string): Promise<MCPQueryResult> {
  const result = await callMCP('tools/call', {
    name: 'splunk_run_query',
    arguments: { query: spl, row_limit: 100 },
  })
  const rawText = extractToolText(result)
  let events: Record<string, unknown>[] = []
  try {
    const parsed = JSON.parse(rawText)
    events = Array.isArray(parsed) ? parsed : (parsed.results ?? [])
  } catch { events = [] }
  // Splunk returns JSON event payloads as a `_raw` string without field
  // extraction — merge those fields so callers can read service, error_code, etc.
  events = events.map(e => {
    if (typeof e._raw === 'string' && e._raw.trim().startsWith('{')) {
      try { return { ...JSON.parse(e._raw), ...e } } catch { /* keep as-is */ }
    }
    return e
  })
  return { events, rawText }
}

export async function generateSPL(description: string): Promise<string> {
  try {
    const result = await callMCP('tools/call', {
      name: 'saia_generate_spl',
      arguments: { prompt: description, spl_only: true },
    })
    const text = extractToolText(result).trim()
    // If AI assistant returns an error object, fall through to fallback
    if (text && !isToolError(result, text)) return text
  } catch { /* fall through */ }

  // Fallback: keyword-based SPL
  const lower = description.toLowerCase()
  if (lower.includes('cpu') || lower.includes('spike') || lower.includes('metric')) {
    return `index=main sourcetype=infra_metric earliest=-30m | where cpu_pct > 80 | head 50`
  }
  if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) {
    return `index=main (error_code=TIMEOUT OR error_code=CONNECTION_REFUSED OR severity=ERROR) earliest=-30m | head 50`
  }
  if (lower.includes('network') || lower.includes('traffic')) {
    return `index=main sourcetype=net_event earliest=-30m | head 50`
  }
  return `index=main earliest=-30m | head 50`
}

export async function explainSPL(spl: string, results: string): Promise<string> {
  try {
    const result = await callMCP('tools/call', {
      name: 'saia_explain_spl',
      arguments: { spl, additional_context: `Query results: ${results.slice(0, 2000)}` },
    })
    const text = extractToolText(result).trim()
    if (text && !isToolError(result, text)) return text
  } catch { /* fall through */ }

  // Fallback: summarize from raw results
  try {
    const events: Record<string, unknown>[] = JSON.parse(results)
    if (!events.length) return 'No correlated events found in related indexes.'
    const uniq = (key: string) => [...new Set(
      events.flatMap(e => String(e[key] ?? '').split(',')).map(s => s.trim()).filter(Boolean)
    )]
    const services = uniq('service')
    const errorCodes = uniq('error_code')
    const hosts = uniq('host').slice(0, 3)
    return `Found ${events.length} correlated events.${services.length ? ` Affected services: ${services.join(', ')}.` : ''}${errorCodes.length ? ` Error codes: ${errorCodes.join(', ')}.` : ''}${hosts.length ? ` Hosts: ${hosts.join(', ')}.` : ''}`
  } catch { return 'Correlated log data found across related indexes.' }
}

export async function askSplunk(question: string): Promise<string> {
  const result = await callMCP('tools/call', {
    name: 'saia_ask_splunk_question',
    arguments: { prompt: question },
  })
  const text = extractToolText(result).trim()
  if (!text || isToolError(result, text)) throw new Error('AI Assistant not ready')
  return text
}

export async function listIndexes(): Promise<string[]> {
  const result = await callMCP('tools/call', { name: 'splunk_get_indexes', arguments: {} })
  const text = extractToolText(result)
  try {
    const parsed = JSON.parse(text)
    const results: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : (parsed.results ?? [])
    return results.map(r => String(r.title ?? r)).filter(Boolean)
  } catch { return [] }
}

export async function checkConnection(): Promise<boolean> {
  try {
    await callMCP('tools/call', { name: 'splunk_get_info', arguments: {} })
    return true
  } catch { return false }
}
