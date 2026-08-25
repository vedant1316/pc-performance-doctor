# PC Performance Doctor — Project Reference

> Paste this whole document into any AI coding session (or hand it to a teammate) before asking for help. It contains everything needed to give consistent, context-aware assistance without re-explaining the project.

---

## 1. Project Overview

**One-line pitch:** PC Performance Doctor is a Windows desktop app that watches your CPU/RAM/GPU/disk/network in real time, figures out the *actual* bottleneck using its own diagnostic engine, and only then asks an LLM to explain it in plain English with fixes.

**What makes this different from "system monitor + ChatGPT":**

1. **Diagnostic reasoning happens before the LLM ever sees anything.** A rule-based engine (not the LLM) inspects live metrics and produces a structured diagnosis label (e.g. `memory_pressure`, `disk_bottleneck`, `thermal_throttling`). The LLM is only ever handed this already-solved diagnosis to translate into human language — it never guesses the root cause itself. This is the core IP and the thing to lead with in a demo: "our own reasoning engine, not just ChatGPT reading numbers."
2. **A historical timeline that can answer "why was my PC slow at 2:30pm."** Every metrics snapshot and every diagnosis is persisted to SQLite, so the tool isn't just a live dashboard — it's a queryable record of the machine's health over time.

**Scoped core feature list (realistic for 24 hours, team of 1):**

- Live system monitor (CPU/RAM/GPU/disk/network) streamed over WebSocket
- Rule-based diagnostic engine reading from `rules.yaml`
- "Diagnose My PC" button → structured diagnosis → LLM plain-English writeup
- SQLite persistence of metrics + diagnoses
- Performance Timeline view (query a past time range)
- Basic Health Report (score + summary, exportable as PDF is a stretch goal)
- Benchmark Mode is a stretch goal — build only if MVP checkpoint is hit early

---

## 2. Tech Stack

**Frontend:** React + Tailwind CSS + Recharts, packaged as a desktop app via **Tauri** (preferred) or Electron.

**Backend agent:** Python, using:
- `psutil` — CPU, RAM, disk, network, per-process stats (cross-platform baseline)
- `GPUtil` — NVIDIA GPU usage/temp (falls back gracefully if no NVIDIA GPU)
- `pywin32` / `wmi` — Windows-specific data (temps via WMI where available, disk I/O detail, process elevation info)
- `websockets` (or FastAPI + `websockets`/`socketio`) — push live updates to the UI
- `sqlite3` (stdlib) — historical metrics + diagnosis storage

**AI layer:** Any OpenAI-compatible LLM provider (OpenAI, Anthropic via a compatible shim, local Ollama, etc.) — the AI layer only needs a base URL, API key, and model name, so it's provider-agnostic by design.

**Why this can't just be a website:**
Browsers cannot read live CPU temperature, per-process disk I/O, GPU utilization, or WMI performance counters — that data only exists behind OS-level APIs (`psutil`, `wmi`, `pywin32`, vendor GPU SDKs) that require a native process with local machine access. A website served over HTTP has no path to that data; a desktop shell (Tauri/Electron) lets the same React UI run inside a window that also spawns and talks to a local Python agent process with full OS access.

---

## 3. Architecture Diagram (ASCII)

```
┌─────────────────────────────┐
│        React UI (Tauri)     │
│  Dashboard / Diagnosis /    │
│  Timeline / Health Report   │
└──────────────┬───────────────┘
               │ WebSocket (ws://localhost:8765)
               ▼
┌─────────────────────────────┐
│     Python Agent Process     │
│                              │
│  ┌────────────────────────┐ │
│  │ 1. Metrics Collectors   │ │  psutil / GPUtil / wmi / pywin32
│  └───────────┬────────────┘ │
│              ▼               │
│  ┌────────────────────────┐ │
│  │ 2. Diagnostic Engine    │ │  reads rules.yaml
│  │    (rule-based, no LLM) │ │  → structured diagnosis JSON
│  └───────────┬────────────┘ │
│              ▼               │
│  ┌────────────────────────┐ │
│  │ 3. AI Layer             │ │  sends DIAGNOSIS (not raw metrics)
│  │    (LLM call, optional) │ │  → plain-English explanation + fixes
│  └───────────┬────────────┘ │
│              ▼               │
│  ┌────────────────────────┐ │
│  │ 4. WebSocket Server     │ │  pushes ticks + diagnosis to UI
│  └───────────┬────────────┘ │
│              ▼               │
│  ┌────────────────────────┐ │
│  │ 5. SQLite Persistence   │ │  metrics_snapshots, diagnoses
│  └────────────────────────┘ │
└──────────────┬───────────────┘
               │
               ▼
     OS / Hardware APIs
   (WMI, pywin32, GPU SDKs)
```

---

## 4. Full Folder Structure

```
pc-performance-doctor/
├── agent/                              # Python backend
│   ├── main.py                         # entrypoint: starts WS server + polling loop
│   ├── config.py                       # loads .env, exposes settings object
│   ├── collectors/
│   │   ├── __init__.py
│   │   ├── cpu_collector.py            # psutil CPU %, per-core, freq
│   │   ├── ram_collector.py            # psutil virtual_memory, pagefile
│   │   ├── disk_collector.py           # psutil disk_io_counters, per-process I/O
│   │   ├── gpu_collector.py            # GPUtil (NVIDIA) + wmi fallback (AMD/Intel)
│   │   ├── network_collector.py        # psutil net_io_counters
│   │   └── process_collector.py        # per-process CPU/RAM/IO breakdown
│   ├── diagnostics/
│   │   ├── __init__.py
│   │   ├── engine.py                   # loads rules.yaml, evaluates conditions
│   │   ├── rules.yaml                  # THE RULES — human-readable, the product's IP
│   │   └── models.py                   # Diagnosis dataclass/schema
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── client.py                   # OpenAI-compatible client wrapper
│   │   ├── prompts.py                  # system prompt + schema (Section 9)
│   │   └── explainer.py                # takes Diagnosis -> calls LLM -> returns explanation
│   ├── server/
│   │   ├── __init__.py
│   │   ├── ws_server.py                # WebSocket server, tick loop, message routing
│   │   └── schemas.py                  # message shapes (Section 10)
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── db.py                       # SQLite connection + migrations
│   │   └── models.py                   # snapshot/diagnosis row (de)serialization
│   ├── benchmark/
│   │   └── benchmark.py                # stretch goal: synthetic load + score
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                           # React app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── ws/
│   │   │   └── useAgentSocket.ts       # WebSocket hook, reconnect logic
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx           # live metrics view
│   │   │   ├── DiagnosisResult.tsx     # "Diagnose My PC" result view
│   │   │   ├── Timeline.tsx            # historical query view
│   │   │   ├── Benchmark.tsx           # stretch goal
│   │   │   └── HealthReport.tsx        # exportable summary
│   │   ├── components/
│   │   │   ├── MetricGauge.tsx
│   │   │   ├── ProcessTable.tsx
│   │   │   ├── DiagnosisCard.tsx
│   │   │   ├── TimelineChart.tsx       # Recharts
│   │   │   └── HealthScoreBadge.tsx
│   │   └── lib/
│   │       └── api.ts                  # request helpers over WS
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── src-tauri/                          # desktop shell (Tauri)
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── src/
│       └── main.rs                     # spawns agent/main.py as sidecar process
│
├── data/
│   └── performance.db                  # SQLite file (gitignored)
│
├── .gitignore
└── README.md
```

---

## 5. Environment Variables

`.env` (agent root), example values:

```bash
# --- LLM / AI layer ---
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_SECONDS=15

# --- Agent behavior ---
POLLING_INTERVAL_MS=1000
WEBSOCKET_PORT=8765
WEBSOCKET_HOST=127.0.0.1

# --- Storage ---
SQLITE_PATH=./data/performance.db
SNAPSHOT_RETENTION_DAYS=14

# --- Diagnostics ---
RULES_PATH=./diagnostics/rules.yaml
```

---

## 6. Data Model (SQLite Schema)

```sql
-- Raw metrics snapshots, one row per polling tick
CREATE TABLE metrics_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT NOT NULL,            -- ISO 8601 UTC
    cpu_percent   REAL NOT NULL,
    cpu_temp_c    REAL,                     -- nullable, not all systems expose this
    ram_percent   REAL NOT NULL,
    ram_available_mb INTEGER NOT NULL,
    pagefile_percent REAL,
    disk_percent_busy REAL NOT NULL,
    disk_read_bps INTEGER,
    disk_write_bps INTEGER,
    gpu_percent   REAL,
    gpu_temp_c    REAL,
    gpu_vram_percent REAL,
    net_sent_bps  INTEGER,
    net_recv_bps  INTEGER
);
CREATE INDEX idx_snapshots_timestamp ON metrics_snapshots(timestamp);

-- Per-process breakdown tied to a snapshot (top N processes by resource use)
CREATE TABLE process_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id   INTEGER NOT NULL REFERENCES metrics_snapshots(id),
    pid           INTEGER NOT NULL,
    name          TEXT NOT NULL,
    cpu_percent   REAL,
    ram_mb        INTEGER,
    io_percent    REAL,
    is_elevated   INTEGER DEFAULT 0         -- 1 if admin-required data was available
);
CREATE INDEX idx_process_snapshot_id ON process_snapshots(snapshot_id);

-- Diagnosis results (one per "Diagnose My PC" run, or periodic auto-run)
CREATE TABLE diagnoses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id       INTEGER NOT NULL REFERENCES metrics_snapshots(id),
    timestamp         TEXT NOT NULL,
    label             TEXT NOT NULL,        -- e.g. "memory_pressure"
    rule_id           TEXT NOT NULL,        -- which rule fired (rules.yaml id)
    severity          TEXT NOT NULL,        -- low | medium | high
    health_score      INTEGER NOT NULL,     -- 0-100, from rules engine alone
    contributing_processes TEXT,            -- JSON array of pids/names
    llm_summary       TEXT,                 -- nullable — filled if LLM call succeeded
    llm_root_cause    TEXT,
    llm_fixes         TEXT,                 -- JSON array
    llm_expected_improvement TEXT,
    llm_call_succeeded INTEGER DEFAULT 0
);
CREATE INDEX idx_diagnoses_timestamp ON diagnoses(timestamp);
```

---

## 7. Diagnostic Rules (`diagnostics/rules.yaml`)

This file **is the product's IP**. Keep it human-readable, versioned, and separate from code so it can be shown directly to judges as "this is our reasoning, not the LLM's."

```yaml
rules:
  - id: memory_pressure
    description: >
      RAM is critically high, the pagefile is actively being used, and there's
      very little RAM actually available — the system is swapping to disk.
    conditions:
      - metric: ram_percent
        operator: ">"
        value: 90
      - metric: pagefile_percent
        operator: ">"
        value: 50
        label: HIGH
      - metric: ram_available_mb
        operator: "<"
        value: 500
        label: LOW
    output:
      label: memory_pressure
      severity: high
      health_score_penalty: 40

  - id: disk_bottleneck
    description: >
      Disk is fully saturated and a single process accounts for most of the I/O —
      that process is the bottleneck, not the disk hardware itself.
    conditions:
      - metric: disk_percent_busy
        operator: "=="
        value: 100
      - metric: top_process_io_percent
        operator: ">"
        value: 70
    output:
      label: disk_bottleneck
      severity: high
      health_score_penalty: 35

  - id: thermal_throttling
    description: >
      CPU usage is very high, one process dominates that usage, and CPU
      temperature is elevated — likely throttling rather than a workload issue.
    conditions:
      - metric: cpu_percent
        operator: ">"
        value: 90
      - metric: top_process_cpu_percent
        operator: ">"
        value: 70
      - metric: cpu_temp_c
        operator: ">"
        value: 85
        label: HIGH
    output:
      label: thermal_throttling
      severity: high
      health_score_penalty: 45

  - id: network_saturation
    description: >
      Network throughput is near the detected link capacity, degrading
      responsiveness for network-dependent apps.
    conditions:
      - metric: net_recv_bps
        operator: ">"
        value: 0.9   # fraction of estimated link capacity
        relative: true
    output:
      label: network_saturation
      severity: medium
      health_score_penalty: 20

  - id: gpu_bound
    description: >
      GPU usage is maxed while CPU is comfortable — workload is GPU-limited,
      not a general system slowdown.
    conditions:
      - metric: gpu_percent
        operator: ">"
        value: 95
      - metric: cpu_percent
        operator: "<"
        value: 60
    output:
      label: gpu_bound
      severity: low
      health_score_penalty: 10

  - id: background_process_sprawl
    description: >
      No single resource is critically high, but a large number of processes
      are each consuming a small-to-moderate share — death by a thousand cuts.
    conditions:
      - metric: process_count_above_threshold
        operator: ">"
        value: 15
        threshold_metric: cpu_percent
        threshold_value: 5
    output:
      label: background_process_sprawl
      severity: medium
      health_score_penalty: 15

  - id: nominal
    description: All metrics within healthy ranges — no bottleneck detected.
    conditions: []   # fallback / default rule, evaluated last
    output:
      label: nominal
      severity: none
      health_score_penalty: 0
```

**Evaluation order:** rules are evaluated top to bottom; the first fully-matching rule wins (highest `health_score_penalty` rules should be ordered first so the most severe explanation is surfaced when multiple conditions technically overlap). `nominal` is the catch-all when nothing else fires.

---

## 8. Step-by-Step Pipeline

1. **Collect metrics** — each collector (`cpu_collector.py`, `ram_collector.py`, etc.) runs on every polling tick (`POLLING_INTERVAL_MS`) and returns a normalized dict.
2. **Assemble snapshot** — collectors' outputs are merged into one `MetricsSnapshot` object, including top-N process breakdown.
3. **Run diagnostic engine** — `engine.py` loads `rules.yaml` (cached, hot-reload optional) and evaluates the snapshot against each rule in order.
4. **Produce structured diagnosis JSON** — engine outputs `{label, rule_id, severity, health_score, contributing_processes}` — no LLM involved yet.
5. **Send diagnosis (not raw metrics) to LLM** — only on explicit "Diagnose My PC" click (not every tick, to control cost/latency) — `explainer.py` sends the diagnosis JSON to the LLM using the contract in Section 9.
6. **LLM returns plain-English explanation + fixes** — parsed against the required JSON schema; validated before use.
7. **Push to dashboard over WebSocket** — both the raw tick (every `POLLING_INTERVAL_MS`) and the diagnosis result (on demand) are pushed to the frontend.
8. **Persist snapshot to SQLite** — every tick's snapshot is written to `metrics_snapshots`/`process_snapshots`; every diagnosis run is written to `diagnoses`.

---

## 9. LLM Contract

**System prompt (exact):**

```
You are the explanation layer of PC Performance Doctor. A rule-based diagnostic
engine has ALREADY determined the root cause of a performance issue on this
Windows PC. You are NOT diagnosing anything yourself — you must never guess,
override, or second-guess the provided diagnosis label. Your only job is to:

1. Explain the already-determined diagnosis in clear, plain English for a
   non-technical user.
2. Explain WHY this diagnosis leads to a slow PC.
3. Suggest concrete, actionable fixes ranked by ease/impact.
4. Estimate the expected improvement if the fixes are applied.

You will receive a JSON object describing the diagnosis, the contributing
processes, and severity. Treat this JSON as ground truth. Do not contradict it.

Respond with ONLY a JSON object matching this exact schema, and nothing else
(no markdown, no prose outside the JSON):

{
  "summary": "string, 1-2 sentences, plain English",
  "root_cause": "string, explains the mechanism behind the diagnosis label",
  "contributing_processes": ["string", "..."],
  "fixes": [
    {
      "action": "string, concrete step the user can take",
      "difficulty": "easy | medium | advanced",
      "impact": "low | medium | high"
    }
  ],
  "expected_improvement": "string, plain-English expectation, e.g. 'RAM usage should drop to ~60% after closing these apps'"
}
```

**User message (template):**

```
Diagnosis JSON:
{diagnosis_json}

Explain this diagnosis and provide fixes, following your system instructions exactly.
```

**Fallback behavior if the LLM call fails (timeout, auth error, malformed response):**
- The diagnosis label, severity, and health score **must still display**, since they come entirely from the rules engine and require no LLM.
- The UI shows the diagnosis card with a note: *"AI explanation unavailable — showing rules-engine diagnosis only."*
- `llm_call_succeeded = 0` is stored in the `diagnoses` row; `llm_summary`/`llm_fixes`/etc. remain null.
- Never block the "Diagnose My PC" flow on the LLM call — the rules-engine result is written and displayed first, then the LLM call is attempted as an enhancement.

---

## 10. API / WebSocket Contract

**Agent → Frontend, pushed every tick (`POLLING_INTERVAL_MS`):**

```json
{
  "type": "metrics_tick",
  "timestamp": "2026-08-24T10:15:00Z",
  "cpu_percent": 42.1,
  "ram_percent": 67.3,
  "ram_available_mb": 3400,
  "disk_percent_busy": 12.0,
  "gpu_percent": 8.5,
  "net_sent_bps": 15234,
  "net_recv_bps": 88213,
  "top_processes": [
    {"pid": 4821, "name": "chrome.exe", "cpu_percent": 18.2, "ram_mb": 1200}
  ]
}
```

**Frontend → Agent, "Diagnose My PC":**

```json
{ "type": "diagnose_request" }
```

**Agent → Frontend, diagnosis response:**

```json
{
  "type": "diagnosis_result",
  "diagnosis": {
    "label": "memory_pressure",
    "rule_id": "memory_pressure",
    "severity": "high",
    "health_score": 55,
    "contributing_processes": ["chrome.exe", "Teams.exe"]
  },
  "explanation": {
    "summary": "...",
    "root_cause": "...",
    "fixes": [ { "action": "...", "difficulty": "easy", "impact": "high" } ],
    "expected_improvement": "..."
  },
  "llm_call_succeeded": true
}
```

**Frontend → Agent, "Run Benchmark" (stretch goal):**

```json
{ "type": "benchmark_request" }
```

**Agent → Frontend, benchmark response:**

```json
{ "type": "benchmark_result", "score": 742, "breakdown": { "cpu": 780, "disk": 690, "gpu": 760 } }
```

**Frontend → Agent, timeline query:**

```json
{ "type": "timeline_query", "start": "2026-08-24T14:00:00Z", "end": "2026-08-24T15:00:00Z" }
```

**Agent → Frontend, timeline response:**

```json
{
  "type": "timeline_result",
  "snapshots": [ /* array of metrics_snapshots rows */ ],
  "diagnoses": [ /* array of diagnoses rows in range */ ]
}
```

---

## 11. UI Screen List

1. **Live Dashboard** — real-time gauges for CPU/RAM/GPU/disk/network, top-process table, updates via WebSocket tick.
2. **Diagnosis Result** — shows the fired rule, severity, health score, plain-English explanation, and ranked fixes.
3. **Performance Timeline** — scrubbable chart (Recharts) over historical snapshots; click/select a range to answer "why was my PC slow at 2:30pm."
4. **Benchmark Mode** *(stretch goal)* — runs a synthetic load, reports a comparable score.
5. **PC Health Report** — summary view combining current health score, recent diagnoses, and trend; exportable as PDF *(stretch goal — build the on-screen version first, PDF export only if time remains)*.

---

## 12. End-to-End User Flows

**(a) Passive live monitoring**
1. User opens the app → Tauri shell launches → spawns Python agent as a sidecar process.
2. Agent starts polling loop and opens WebSocket server on `WEBSOCKET_PORT`.
3. React UI connects to the WebSocket on mount.
4. Agent pushes a `metrics_tick` message every `POLLING_INTERVAL_MS`.
5. Dashboard gauges/charts update live; each tick is also persisted to `metrics_snapshots`.

**(b) Clicking "Diagnose My PC"**
1. User clicks the button on the Dashboard.
2. Frontend sends `diagnose_request` over the WebSocket.
3. Agent takes the latest snapshot, runs it through `engine.py` against `rules.yaml`.
4. Rules-engine result (label, severity, health score) is written to `diagnoses` and pushed to the frontend immediately.
5. Diagnosis Result view renders the rules-engine result right away (no waiting on the LLM).
6. Agent asynchronously calls the LLM with the diagnosis JSON (Section 9 contract).
7. When the LLM responds, the row is updated and a follow-up WebSocket message enriches the same Diagnosis Result view with the plain-English explanation and fixes.
8. If the LLM call fails, the UI shows the fallback note from Section 9.

**(c) Querying a past time range on the Timeline**
1. User opens the Timeline screen and selects a start/end range (or clicks a point on the chart).
2. Frontend sends `timeline_query` with `start`/`end`.
3. Agent queries `metrics_snapshots` and `diagnoses` between those timestamps.
4. Agent returns `timeline_result` with both datasets.
5. UI renders the metrics chart for that range plus any diagnosis cards that occurred within it, answering "why was my PC slow at 2:30pm."

**(d) Running a benchmark** *(stretch goal)*
1. User clicks "Run Benchmark."
2. Frontend sends `benchmark_request`.
3. Agent runs a short synthetic CPU/disk/GPU load (`benchmark.py`), measuring throughput.
4. Agent computes a composite score and per-component breakdown.
5. Agent returns `benchmark_result`; UI displays the score with a simple bar breakdown.

---

## 13. Known Gotchas

- **`wmi`/`pywin32` permission issues** — some WMI classes (e.g. detailed thermal data via `MSAcpi_ThermalZoneTemperature`) require admin privileges or aren't exposed on all hardware/OEM configurations. Always wrap WMI calls in try/except and degrade to "temp: unavailable" rather than crashing.
- **GPU vendor API differences** — `GPUtil` only reliably supports NVIDIA (via `nvidia-smi`). AMD and Intel GPUs need separate paths (WMI performance counters, or vendor-specific tools) and may simply be unavailable — design the GPU collector to return `null` fields gracefully rather than assuming NVIDIA.
- **WebSocket reconnect handling** — the desktop shell and agent are separate processes; if the agent restarts or the WS drops, the frontend must auto-reconnect with backoff and show a "reconnecting…" state rather than a blank dashboard.
- **Sampling overhead** — polling too aggressively (sub-500ms) with `psutil`/`wmi` can itself consume enough CPU to skew the very metrics being measured, especially on lower-end machines. Default `POLLING_INTERVAL_MS=1000` balances responsiveness against overhead.
- **Admin-elevation prompts mid-demo** — some collectors silently return less data without admin rights; don't request elevation live on stage (Section "fragile steps" below covers the backup plan).

---

## 14. What's Intentionally NOT Being Built

- **Cross-platform (macOS/Linux) support** — the diagnostic value depends on Windows-specific APIs (WMI, pywin32); supporting other OSes would dilute the 24-hour build with parallel collector implementations for no demo benefit.
- **Kernel-level telemetry / driver-level hooks** — requires signed kernel drivers and elevated install steps that are out of scope for a hackathon timeline and a security liability to ship quickly.
- **Auto-remediation / auto-fix actions** — automatically killing processes or changing system settings is risky to demo live and raises trust/safety concerns; the tool recommends fixes, the user applies them.
- **Multi-machine / cloud dashboard** — this is a local, single-machine tool; syncing across devices or a cloud backend adds infra scope with no core-feature payoff.
- **Custom ML model for diagnosis** — the rule-based engine is the deliberate design choice (explainable, demoable, fast to build); training/hosting a model is unnecessary complexity for this scope.

---

## 15. Team Split by Build Phase

*(Even as a solo builder, treat these as sequential checkpoints — each phase should be independently demoable before moving on.)*

1. **System monitor** — collectors return real data for CPU/RAM/disk/network/GPU (console-printed is fine at first).
2. **Dashboard** — WebSocket server + React UI showing live gauges from real data.
3. **Diagnostic engine** — `rules.yaml` + `engine.py` producing a diagnosis label from a snapshot; wire up "Diagnose My PC" button end-to-end with rules-only output (no LLM yet).
4. **History** — SQLite persistence of snapshots and diagnoses; Timeline screen querying real historical data.

   **★ MVP DONE CHECKPOINT ★** — live monitoring, rules-based diagnosis, and timeline all work without any LLM involved. This alone is demoable and safe if time runs out.

5. **AI layer** — LLM contract (Section 9) wired in, with fallback behavior tested by deliberately breaking the API key.
6. **Advanced features** (only if time remains, in priority order) — Health Report screen → Benchmark Mode → PDF export.

---

## 16. Quick Start Commands

**Python agent:**
```bash
cd agent
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python main.py
```

**React dev server:**
```bash
cd frontend
npm install
npm run dev
```

**Desktop shell (Tauri):**
```bash
cd src-tauri
cargo tauri dev        # dev mode, launches shell + spawns agent sidecar
cargo tauri build       # production build
```

---

## Demo-Risk Checklist (fragile / platform-risky steps + backup plans)

| Risk | Why it's fragile | Backup plan |
|---|---|---|
| GPU API differences across judge/demo machines | AMD/Intel machines may return null GPU data via `GPUtil`; unfamiliar hardware could throw unexpected WMI errors | Pre-test on the actual demo machine beforehand; if GPU data is unavailable, have the UI show "GPU: not available on this device" gracefully rather than erroring; keep a pre-recorded snapshot of a GPU-bound diagnosis as a fallback screen recording |
| Admin-permission prompts during live demo | Some WMI/pywin32 calls need elevation; a UAC prompt mid-demo is disruptive and can stall the flow | Launch the built app "Run as Administrator" *before* the demo starts, not live; verify no elevation prompts appear once already running |
| LLM API call failing live (network flakiness, rate limit, cold demo wifi) | Kills the "wow" explanation moment if it hangs or errors | Rules-engine diagnosis always renders first and independently (Section 9 fallback); have a cached/pre-recorded example diagnosis JSON + LLM response ready to paste in via a debug trigger if live calls fail |
| WebSocket disconnect between agent and UI mid-demo | Agent sidecar process could crash or lag under audience Wi-Fi/laptop conditions | Test reconnect logic ahead of time; keep a terminal window open to restart `python main.py` quickly if needed; consider a "demo mode" flag that replays a recorded sequence of ticks/diagnoses if live data misbehaves |
| First-run performance overhead skewing the initial diagnosis | Sampling itself can spike CPU right after launch, before steady-state | Let the app run for ~30 seconds before triggering "Diagnose My PC" live; don't diagnose immediately on launch |
