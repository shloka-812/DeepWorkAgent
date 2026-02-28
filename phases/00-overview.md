# Deep Work Agent: Master Overview

## Project Vision

A persistent background agent that monitors your browser AND entire Mac system in real time, infers what task you're working on from your calendar and activity, and autonomously intervenes when you drift — with precision, not blunt force. It understands that a developer watching a FastAPI tutorial on YouTube is working. It knows the difference between Slack in your project channel vs. Slack in #random. It reads your calendar to know what you *should* be doing, and escalates gradually rather than blocking immediately.

**Positioning**: *"Not a tool you use. An agent that works for you — and actually understands your workflow."*

---

## What's New vs. V1

| Area | V1 | V2 (Current) |
|---|---|---|
| LLM | OpenAI GPT-4o-mini | **Groq Llama 3.1-70b** (free, fast) + Snowflake Cortex |
| Agent actions | block / nudge / none | **allow / monitor / ask / nudge / block** |
| Calendar | Write focus blocks | **Read existing tasks** → informs agent decisions |
| Distraction logic | Binary (distraction = block) | **Intent + grace period + escalation ladder** |
| YouTube during coding | Block immediately | **Allow if specific video URL via search, monitor** |
| Slack during coding | Block after grace period | **Allow in project channel, escalate in #random** |
| Agent output | One decision | **Decision + full escalation schedule** |
| System monitoring | Browser only | **Full Mac** (VS Code, Terminal, Figma, etc.) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SENSOR LAYER                                  │
│   Chrome Extension (React + Vite + Manifest V3)                     │
│   + mac_monitor.py (Python background process)                      │
│   Monitors: tabs, apps, window titles, idle state, referrer chain   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT BACKEND (FastAPI)                       │
│                                                                      │
│   Calendar fetch → get_current_and_next_event() via Composio        │
│   Unified context = browser + mac + calendar                         │
│                                                                      │
│   CrewAI Agent Crew (Groq Llama 3.1-70b):                          │
│   ├── Observer   → intent classification + grace period status       │
│   ├── Analyzer   → 5-factor verdict (allow/monitor/ask/nudge/block) │
│   └── Intervener → crafts message + full escalation schedule        │
│                                                                      │
│   Escalation Scheduler → asyncio timers, cancellable on refocus     │
└─────────────────────────────────────────────────────────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────────────┐
│      MEMORY LAYER         │   │         ACTION LAYER              │
│   Snowflake               │   │   Composio                        │
│   - Session logs          │   │   - Slack DM                      │
│   - Intervention history  │   │   - Google Calendar (read-first)  │
│   - Agent decisions       │   │   - Tab blocking (via extension)  │
│   - Focus scores          │   │   - macOS notifications           │
│   Cortex AI (Llama)       │   │                                   │
│   - Insights + summaries  │   │                                   │
└───────────────────────────┘   └───────────────────────────────────┘
```

---

## Phase Dependency Graph

```
Phase 1: Chrome Extension — Tab Monitoring + Backend Ping
  │
  └── Phase 2: FastAPI Backend + CrewAI Agent Crew (Groq LLM)
        │
        └── Phase 3: Snowflake Memory + Session Logging
              │
              └── Phase 4: Composio Actions (Slack + Calendar read-first)
                    │
                    └── Phase 5: Cortex AI Insights + Dashboard
                          │
                          └── Phase 6: macOS System Monitor (mac_monitor.py)
```

**Minimum viable demo (Phases 1–3)**: Extension detects tab → intent-aware agent reasons → blocks or monitors → logs to Snowflake.

**Full demo (Phases 1–6)**: All of above + Slack nudge + calendar task context + Cortex insights + VS Code/YouTube app monitoring.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Chrome Extension | React 18 + Vite + Manifest V3 |
| Mac System Monitor | Python 3.11 + AppleScript + pyobjc |
| Agent Backend | Python 3.11 + FastAPI + CrewAI |
| Agent LLM | **Groq Llama 3.1-70b** (real-time decisions) |
| Insights LLM | **Snowflake Cortex Llama 3.1** (analytics) |
| Memory | Snowflake (sessions, events, interventions, decisions) |
| Integrations | Composio (Slack, Google Calendar) |

---

## All Files

| Phase | New Files |
|-------|-------|
| 0 | `backend/llm.py` ← new |
| 1 | `extension/manifest.json`, `extension/src/background/index.js`, `extension/src/popup/App.jsx`, `extension/popup.html`, `extension/vite.config.js` |
| 2 | `backend/main.py`, `backend/crew.py`, `backend/models.py`, `backend/agents/observer.py`, `backend/agents/analyzer.py`, `backend/agents/intervener.py` |
| 3 | `backend/db/snowflake_client.py`, `backend/db/schema.sql`, `backend/db/logger.py` |
| 4 | `backend/actions/composio_client.py`, `backend/actions/slack_action.py`, `backend/actions/calendar_action.py` |
| 5 | `backend/insights/cortex_analyst.py`, `extension/src/dashboard/App.jsx` |
| 6 | `backend/system_agent/mac_monitor.py`, `com.deepworkagent.monitor.plist`, `install_mac_monitor.sh` |

---

## Environment Variables

```bash
# ── LLM ──────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_xxxx          # Free at console.groq.com — PRIMARY LLM
OPENAI_API_KEY=sk-...          # Optional fallback only

# ── Snowflake ─────────────────────────────────────────────────────────
SNOWFLAKE_ACCOUNT=abc12345.us-east-1
SNOWFLAKE_USER=your-user
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_DATABASE=DEEP_WORK
SNOWFLAKE_SCHEMA=AGENT
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=SYSADMIN

# ── Composio ──────────────────────────────────────────────────────────
COMPOSIO_API_KEY=your-composio-key
SLACK_CHANNEL_ID=C0XXXXXXXXX

# ── App ───────────────────────────────────────────────────────────────
BACKEND_URL=http://localhost:8000
MONITOR_POLL_INTERVAL=3
ENV=development
```

---

## Package Installation

```bash
# Backend
pip install fastapi uvicorn crewai crewai-tools \
            langchain-groq groq \
            langchain-openai openai \
            composio-crewai composio-core \
            snowflake-connector-python \
            python-dotenv requests httpx

# Mac monitor (additional)
pip install pyobjc-framework-Quartz

# Extension
cd extension && npm install
```

---

## Build Order (24-hour hackathon)

| Time | Phase | Goal |
|------|-------|------|
| Hour 1–2 | 1 | Extension tab detection + backend ping |
| Hour 3–4 | 2 | CrewAI crew + Groq LLM + intent reasoning |
| Hour 5–6 | 3 | Snowflake logging |
| Hour 7–8 | 4 | Composio Slack nudge + calendar read |
| Hour 9 | 5 | Cortex insights dashboard |
| Hour 10 | 6 | Mac monitor + demo polish |

**Cut if time is short**: Phase 6 (mac monitor), Phase 5 calendar proactive blocking.
The minimum winning demo: intent-aware block + Slack nudge + Snowflake live log.

---

## The Whitelist (Built Into Observer Agent)

Apps that get grace periods instead of immediate blocks:

| App/Domain | Grace Period | Notes |
|---|---|---|
| `youtube.com` (specific video) | 12 mins | Specific URL via search = likely tutorial |
| `youtube.com` (homepage/feed) | 0 mins | Typed directly = aimless browsing |
| `slack.com` (project channel) | 10 mins | Work channel = work |
| `slack.com` (#random etc.) | 2 mins | Off-topic channel = drift |
| `medium.com` | Never block | Reading = always research |
| `stackoverflow.com` | Never block | Always work |
| `github.com` | Never block | Always work |
| `chatgpt.com` | Never block | AI tool = work |
| `twitter.com` | 0 mins | No grace period |

---

## The Escalation Ladder (New in V2)

Instead of binary block/allow, the agent returns a full escalation schedule:

```
Minute 0   → ALLOW (YouTube specific video, via search)
Minute 12  → NUDGE "12 mins on YouTube. Still the tutorial?"
Minute 15  → BLOCK "applyPlan() has 35 mins left."
```

If user returns to work at any point → all pending escalations are cancelled.
