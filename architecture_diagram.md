# OpsWarRoom — Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                   │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   Splunk Cloud       │  │   Splunk Hosted Models               │ │
│  │   MCP Server v1.2    │  │   • GPT-OSS 120B (reasoning)        │ │
│  │                      │  │   • Cisco Deep TS (anomaly)         │ │
│  │   Tools:             │  └──────────────────────────────────────┘ │
│  │   • run_splunk_query │                                           │
│  │   • generate_spl     │  ┌──────────────────────────────────────┐ │
│  │   • explain_spl      │  │   Splunk HEC                         │ │
│  │   • list_indexes     │  │   Seeded sample events               │ │
│  └──────────────────────┘  │   (CPU spike → app error scenario)  │ │
│                             └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
              │                         │
              ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  AGENT ORCHESTRATOR (Vercel Serverless)             │
│                                                                     │
│  ┌──────────┐   ┌───────────┐   ┌───────────┐   ┌─────────────┐  │
│  │  Step 1  │──▶│  Step 2   │──▶│  Step 3   │──▶│   Step 4    │  │
│  │  Detect  │   │ Correlate │   │  Analyze  │   │  Remediate  │  │
│  │          │   │           │   │           │   │             │  │
│  │MCP query │   │MCP cross- │   │GPT-OSS    │   │GPT-OSS      │  │
│  │anomaly   │   │index corr.│   │120B root  │   │120B runbook │  │
│  │via SPL   │   │+ context  │   │cause      │   │+ severity   │  │
│  └──────────┘   └───────────┘   └───────────┘   └─────────────┘  │
│       │               │               │                │           │
│       └───────────────┴───────────────┴────────────────┘           │
│                              │ SSE stream (AgentStep events)        │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
              ┌────────────────▼──────────────────┐
              │    Next.js API Routes (Vercel)     │
              │                                   │
              │  POST /api/investigate  (SSE)     │
              │  GET  /api/incidents              │
              │  GET  /api/status                 │
              └────────────────┬──────────────────┘
                               │
              ┌────────────────▼──────────────────┐
              │   Next.js 15 Dashboard (Vercel)    │
              │                                   │
              │  • Live incident feed (SSE)       │
              │  • Agent step trace viewer        │
              │  • Runbook viewer + approve       │
              │  • Splunk connection status       │
              └───────────────────────────────────┘
```

## Component interaction

### How the application interacts with Splunk

1. MCP client (`src/lib/splunk/mcp-client.ts`) connects to Splunk Cloud MCP Server using token auth
2. Agent steps call MCP tools via `@modelcontextprotocol/sdk` client
3. `run_splunk_query` executes SPL searches against Splunk indexes
4. `generate_spl` + `explain_spl` use Splunk AI Assistant for NLU capabilities
5. HEC client seeds realistic sample data to ensure demo always has events

### How AI models are integrated

1. Step 1 (Detect): `cisco-deep-ts` hosted model for time-series anomaly detection
2. Step 3 (Analyze): `gpt-oss-120b` hosted model via Splunk AI Toolkit for root cause reasoning
3. Step 4 (Remediate): `gpt-oss-120b` for generating structured runbook with severity scoring
4. All model calls stay within Splunk platform boundary — no external LLM APIs

### Data flow

```
User trigger → POST /api/investigate
  → orchestrator.ts starts agent loop
  → detect.ts: MCP run_splunk_query → anomaly events
  → correlate.ts: MCP run_splunk_query × 2 (related indexes) + explain_spl
  → analyze.ts: Splunk GPT-OSS 120B → root cause text
  → remediate.ts: Splunk GPT-OSS 120B → structured runbook JSON
  → Each step: emit SSE AgentStep event to client
  → Final: emit SSE complete event with full Incident object
  → Store incident in memory store
  → Dashboard updates live via SSE
```
