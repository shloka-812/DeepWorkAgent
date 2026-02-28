# Deep Work Agent 🎯 V2

> A persistent background agent that monitors your browser **and entire Mac system**, infers your task from browser context + calendar, and intervenes with precision — not blunt force. It knows a developer watching a FastAPI tutorial on YouTube is *working*. It reads your calendar to know what you *should* be doing, and escalates gradually rather than blocking immediately.

**Positioning**: *"Not a tool you use. An agent that works for you — and actually understands your workflow."*

## Architecture

```
Chrome Extension  ┐
                  ├─→  FastAPI + CrewAI (Groq Llama 3.1-70b)  →  Snowflake Memory
mac_monitor.py   ┘          + Calendar context (Composio)          + Cortex AI
                                        ↓
                               Composio Actions
                           (Slack DM · Calendar read/write)
                                        ↓
                           Escalation Ladder (allow → monitor → nudge → block)
```

## Tech Stack

| Layer | Tech |
|---|---|
| Chrome Extension | React 18 + Vite + Manifest V3 |
| Mac System Monitor | Python 3.11 + pyobjc-framework-Quartz |
| Agent Backend | Python 3.11 + FastAPI + CrewAI |
| Agent LLM | **Groq Llama 3.1-70b** (real-time decisions, free) |
| Insights LLM | **Snowflake Cortex Llama 3.1** (analytics) |
| Memory | Snowflake (sessions, events, interventions, decisions) |
| Integrations | Composio (Slack, Google Calendar read + write) |

---

## 🚀 Quickstart (new teammate — 3 commands)

```bash
git clone <your-repo-url>
cd DeepWorkAgent
make setup
```

Then:

```bash
cp backend/.env.example backend/.env
# Open backend/.env and fill in your secrets (see section below)
```

That's it. No manual pip installs, no npm installs — `make setup` handles everything.

---

## Running in Dev

Open **two terminals** (three if running Phase 6 mac monitor):

```bash
# Terminal 1 — Backend API (http://localhost:8000)
make backend

# Terminal 2 — Build the Chrome Extension
make extension
# → then load extension/dist in Chrome (see step below)

# Terminal 3 — Mac System Monitor (Phase 6 only, macOS)
make setup-mac-monitor   # one-time
make monitor
```

**Loading the extension in Chrome:**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `extension/dist/`

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | **[console.groq.com](https://console.groq.com)** → API Keys (free, primary LLM) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) (fallback only, optional) |
| `SNOWFLAKE_ACCOUNT` | Snowflake Admin → Accounts → copy locator (e.g. `abc123.us-east-1`) |
| `SNOWFLAKE_USER` | Your Snowflake username |
| `SNOWFLAKE_PASSWORD` | Your Snowflake password |
| `COMPOSIO_API_KEY` | [app.composio.dev](https://app.composio.dev) → Settings → API Keys |
| `SLACK_CHANNEL_ID` | Open Slack in browser → click yourself in DMs → copy the `D...` from the URL |
| `MONITOR_POLL_INTERVAL` | Seconds between mac monitor polls (default: `3`) |

> ⚠️ **Never commit `backend/.env`** — it is gitignored. Only `.env.example` (no real secrets) is committed.

---

## Snowflake Schema

Run this **once** in a Snowflake SQL Worksheet:

```
Paste the contents of backend/db/schema.sql
```

This creates the `DEEP_WORK.AGENT` database with all tables and views.

---

## Composio Setup (Slack + Calendar)

```bash
pip install composio-cli
composio login
composio add slack
composio add googlecalendar
composio connections   # verify both are listed
```

---

## Build Phases

| Phase | What gets built |
|---|---|
| 1 — Chrome Extension | Tab monitoring, popup UI, focus session toggle |
| 2 — FastAPI + CrewAI (Groq) | Observer → Analyzer → Intervener, intent-aware decisions |
| 3 — Snowflake Memory | Session/event/intervention/decision logging |
| 4 — Composio Actions | Slack nudges, Google Calendar read-first + write |
| 5 — Cortex Insights | AI peak hour predictions + focus dashboard |
| 6 — macOS Monitor | VS Code, Terminal, Figma, YouTube app-level monitoring |

**Minimum winning demo (Phases 1–3)**: intent-aware block + Slack nudge + live Snowflake log.

See `phases/` for step-by-step implementation guides.

---

## GitHub Push Flow

```bash
# First push (owner)
git add .
git commit -m "chore: project scaffold v2"
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```

**For teammates (after cloning):**
```bash
git clone https://github.com/<your-org>/<repo>.git
cd DeepWorkAgent
make setup
cp backend/.env.example backend/.env   # fill in GROQ_API_KEY + other secrets
```

---

## Project Structure

```
DeepWorkAgent/
├── Makefile                       ← one-command dev setup
├── .gitignore
├── README.md
├── phases/                        ← step-by-step implementation guides
├── backend/
│   ├── requirements.txt           ← Python deps
│   ├── .env.example               ← safe to commit — no secrets
│   ├── .env                       ← gitignored — your real secrets
│   ├── main.py                    ← FastAPI app + /event + /insights
│   ├── crew.py                    ← CrewAI crew (Groq LLM)
│   ├── models.py                  ← Pydantic models
│   ├── llm.py                     ← Groq LLM factory (Phase 0)
│   ├── agents/                    ← Observer, Analyzer, Intervener
│   ├── db/                        ← Snowflake client + logger
│   ├── actions/                   ← Composio Slack + Calendar
│   ├── insights/                  ← Cortex AI analyst
│   └── system_agent/              ← Mac system monitor (Phase 6)
│       └── mac_monitor.py
└── extension/
    ├── package.json               ← Node deps
    ├── manifest.json              ← Chrome Manifest V3
    ├── vite.config.js
    └── src/
        ├── background/            ← Service worker: tab monitoring
        ├── popup/                 ← Extension popup UI
        ├── dashboard/             ← Focus insights dashboard
        └── content/               ← Overlay injected into blocked pages
```
