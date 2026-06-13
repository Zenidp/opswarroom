import { NextRequest } from 'next/server'
import { runInvestigation } from '@/lib/agent/orchestrator'
import { encodeSSE, makeSSEHeaders } from '@/lib/utils/streaming'
import { z } from 'zod'

export const maxDuration = 55 // Vercel max, leave 5s buffer

const RequestSchema = z.object({
  query: z.string().max(2000)
    .transform(s => s.trim())
    .refine(q => q.length >= 8 && q.split(/\s+/).filter(Boolean).length >= 2, {
      message: 'Describe the anomaly in a few words — e.g. "CPU spike on api-gateway".',
    }),
  context: z.string().max(500).optional().default(''),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request'
    return new Response(JSON.stringify({ error: message }), { status: 422 })
  }

  const { query, context } = parsed.data

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false

      function emit(event: Parameters<typeof encodeSSE>[0]) {
        if (closed) return
        controller.enqueue(encoder.encode(encodeSSE(event)))
      }

      try {
        await runInvestigation(query, context, emit)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Investigation failed'
        emit({ type: 'error', payload: { message } })
      } finally {
        closed = true
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: makeSSEHeaders() })
}
