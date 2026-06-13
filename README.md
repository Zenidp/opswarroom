# OpsWarRoom

**Agentic incident investigation platform powered by Splunk AI**

OpsWarRoom automates the full incident investigation lifecycle — from anomaly detection to runbook generation — using a 4-step AI agent loop driven by **Splunk's native ML commands** (`anomalydetection`, `predict`) executed at runtime through the **Splunk MCP Server**. Every step streams live to the dashboard.

Built for the [Splunk Agentic Ops Hackathon 2026](https://splunk.devpost.com) — Observability track.

## Live demo

→ https://opswarroom.vercel.app

## How it works

```
Anomaly detected
  → [1/4] Detect    — Splunk anomalydetection + predict (native ML) via MCP Server
  → [2/4] Correlate — Cross-sourcetype log correlation via MCP splunk_run_query
  → [3/4] Analyze   — Root cause grounded in the ML output (anomaly score + forecast)
  → [4/4] Remediate — Runbook generation with severity scoring
  → Live stream to dashboard via SSE
```

## How Splunk AI is used at runtime

The detection step does **not** use hardcoded thresholds or simulated output. It calls
Splunk's built-in machine-learning commands inside Splunk Cloud, via the MCP Server's
`splunk_run_query` tool:

- **`anomalydetection`** — flags anomalous infrastructure-metric events (CPU/memory outliers)
  and reports the affected hosts and probable cause.
- **`predict`** — forecasts the next-window metric value with a 95% confidence interval,
  contrasted against a computed baseline.

The exact SPL run is surfaced live in the dashboard's "Splunk Native ML" panel, and the
analysis step is grounded in the real values these commands return.

> **Note on trial tier:** the project also makes best-effort calls to the Splunk AI Assistant
> (`saia_*`) and Splunk hosted models (GPT-OSS). On the Splunk Cloud **trial** tier these
> backends are not provisioned (`Service not initialized` / login-gated), so the runtime AI
> is provided by Splunk's native SPL ML commands above. The hosted-model/SAIA calls remain in
> the code and are used automatically if a provisioned instance is configured.

## Setup

### Prerequisites

- Node.js 20+
- Splunk Cloud Platform account
- Splunk MCP Server app installed (Splunkbase app ID: 7931)
- A HEC token for seeding sample data

### 1. Clone & install

```bash
git clone https://github.com/your-username/opswarroom
cd opswarroom
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Splunk credentials in `.env.local`.

### 3. Seed sample data

```bash
npm run seed
```

This creates realistic sample events in Splunk (CPU spike → app error cascade scenario).

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 5. Deploy to Vercel

```bash
npx vercel --prod
```

Add environment variables in Vercel dashboard under Project Settings → Environment Variables.

## API reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/investigate` | POST | Trigger agent loop for a query. Returns SSE stream. |
| `/api/incidents` | GET | List all investigation history. |
| `/api/status` | GET | Splunk connection health check. |

### POST /api/investigate

```json
{
  "query": "index=main error_code=500 | stats count by service",
  "context": "Production API degradation alert"
}
```

Returns SSE stream of `AgentStep` events followed by a `complete` event.

## Splunk tools used

| MCP Tool | Purpose |
|---|---|
| `splunk_run_query` | Execute SPL — including the `anomalydetection` and `predict` ML commands — for detect + correlate |
| `splunk_get_indexes` / `splunk_get_info` | Index discovery and connection health check |
| `saia_generate_spl` / `saia_explain_spl` | Best-effort NL→SPL via Splunk AI Assistant (not provisioned on trial; falls back) |

Native Splunk ML commands executed at runtime: **`anomalydetection`** (outlier detection),
**`predict`** (time-series forecasting with confidence intervals).

## Architecture

See [architecture_diagram.md](./architecture_diagram.md) for full data flow diagram.

## Known limitations & future work

- Incident store is in-memory (no persistence) — production would use Postgres/Redis
- No authentication layer — production would add Splunk RBAC passthrough
- No webhook integrations (PagerDuty, Slack) — planned as next feature

## License

MIT
