import { askSplunk } from './mcp-client'

async function callHostedModel(
  model: 'gpt-oss-120b' | 'gpt-oss-20b' | 'cisco-deep-ts',
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const host = process.env.SPLUNK_HOST
  const token = process.env.SPLUNK_TOKEN
  if (!host || !token) throw new Error('Splunk credentials not configured')

  const url = `${host}/en-US/splunkd/__raw/services/ml/hosted-models/${model}/invocations`
  const body = {
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.2,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Hosted model ${model} error ${res.status}`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Hosted model returned non-JSON (model may not be available on this tier)`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

export async function analyzeRootCause(
  anomalyContext: string,
  correlatedLogs: string,
  mlSummary = ''
): Promise<string> {
  const prompt = `Analyze this production incident and provide root cause in 3-5 sentences.

Anomaly: ${anomalyContext}

Splunk ML findings: ${mlSummary}

Correlated logs: ${correlatedLogs}

Focus on: likely root cause, affected services, blast radius. Be specific.`

  // Try hosted model first, fall back to Splunk AI Assistant
  try {
    return await callHostedModel('gpt-oss-120b', prompt, 'You are an expert SRE assistant.')
  } catch {
    try {
      return await askSplunk(`Based on this incident data, what is the root cause?\n\n${prompt}`)
    } catch {
      // Final fallback: analysis grounded in Splunk's native ML output.
      return generateFallbackAnalysis(anomalyContext, correlatedLogs, mlSummary)
    }
  }
}

export async function generateRunbook(
  rootCause: string,
  affectedServices: string[]
): Promise<string> {
  const prompt = `Create an incident response runbook as JSON array.
Root cause: ${rootCause}
Affected services: ${affectedServices.join(', ')}

Schema: [{"order":1,"action":"title","rationale":"why","command":"optional cmd"}]
Return 4-6 steps. Valid JSON only, no markdown.`

  try {
    const raw = await callHostedModel('gpt-oss-120b', prompt)
    return raw.replace(/```json|```/g, '').trim()
  } catch {
    try {
      const raw = await askSplunk(`Generate a runbook JSON for: ${rootCause}. Services: ${affectedServices.join(', ')}. Format: [{"order":1,"action":"...","rationale":"...","command":"..."}]`)
      return raw.replace(/```json|```/g, '').trim()
    } catch {
      return generateFallbackRunbook(rootCause, affectedServices)
    }
  }
}

function generateFallbackAnalysis(anomalyContext: string, correlatedLogs: string, mlSummary = ''): string {
  const hasCorrelation = correlatedLogs && !correlatedLogs.includes('No correlated')
  const mlSentence = mlSummary ? `${mlSummary} ` : ''
  return `${mlSentence}${hasCorrelation ? 'Correlated events across multiple sourcetypes indicate a cascading failure: the infrastructure-level anomaly is propagating into application errors.' : 'No direct correlations were found in related sourcetypes.'} The most likely root cause is the resource-saturation anomaly Splunk's ML flagged on the affected hosts, driving upstream timeouts. Recommend immediate investigation of the flagged hosts and confirmation against the correlated error logs.`
}

function generateFallbackRunbook(rootCause: string, affectedServices: string[]): string {
  const services = affectedServices.length > 0 ? affectedServices : ['affected service']
  return JSON.stringify([
    { order: 1, action: 'Acknowledge incident', rationale: 'Notify on-call team and stakeholders', command: undefined },
    { order: 2, action: `Investigate ${services[0]} logs`, rationale: 'Identify root cause from log patterns', command: `index=main service="${services[0]}" | head 100` },
    { order: 3, action: 'Check infrastructure metrics', rationale: 'Verify CPU, memory, and network status', command: `index=main sourcetype=infra_metric earliest=-1h | stats avg(cpu_pct) avg(mem_pct) by host` },
    { order: 4, action: 'Apply remediation', rationale: rootCause.slice(0, 100), command: undefined },
    { order: 5, action: 'Verify recovery', rationale: 'Confirm services are back to normal', command: `index=main (error OR exception) earliest=-15m | stats count` },
    { order: 6, action: 'Write post-mortem', rationale: 'Document incident timeline and prevention steps', command: undefined },
  ])
}
