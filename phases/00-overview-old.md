# Deep Work Agent: Master Overview

## Project Vision

A persistent background agent that monitors your browser activity in real time, infers what task you're working on, and autonomously intervenes when you drift — blocking distractions, nudging you on Slack, and rescheduling your calendar to protect focus time. Over time it builds a personal productivity model in Snowflake that gets smarter every day.

**Positioning**: *"Not a tool you use. An agent that works for you."*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SENSOR LAYER                                  │
│   Chrome Extension (React + Vite + Manifest V3)                     │
│   Monitors: active tab URL, tab title, idle state, focus events     │
│   Sends: real-time tab change events to backend via REST            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT BACKEND                                 │
│   FastAPI (Python) — receives events, triggers CrewAI crew          │
│                                                                     │
│   CrewAI Agent Crew:                                                │
│   ├── Observer Agent   → infers current task from tab context       │
│   ├── Analyzer Agent   → checks focus state vs. historical patterns │
│   └── Intervener Agent → decides and executes actions               │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌───────────────────────────┐   ┌───────────────────────────────────┐
│        MEMORY LAYER       │   │         ACTION LAYER              │
│   Snowflake               │   │   Composio                        │
│   - Session logs          │   │   - Slack DM (nudge messages)     │
│   - Intervention history  │   │   - Google Calendar (block time)  │
│   - Focus scores          │   │   - Tab blocking (via extension)  │
│   Cortex AI               │   │                                   │
│   - LLM reasoning (Llama) │   │                                   │
│   - Pattern inference     │   │                                   │
└───────────────────────────┘   └───────────────────────────────────┘
```

---

## Phase Dependency Graph

```
Phase 1: Chrome Extension — Tab Monitoring + Backend Ping
  │
  └── Phase 2: FastAPI Backend + CrewAI Agent Crew
        │
        └── Phase 3: Snowflake Memory + Session Logging
              │
              └── Phase 4: Composio Actions (Slack + Calendar)
                    │
                    └── Phase 5: Cortex AI Insights + Demo Polish
```

**Minimum viable demo (Phases 1–3)**: Extension detects tab change → agent reasons → blocks tab + logs to Snowflake.

**Full demo (Phases 1–5)**: All of the above + Slack nudge fires + calendar blocked + Cortex AI shows peak hour predictions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Chrome Extension | React 18 + Vite + Manifest V3 |
| Agent Backend | Python 3.11 + FastAPI + CrewAI |
| LLM | Llama 3 via Snowflake Cortex (`AI_COMPLETE`) |
| Memory | Snowflake (sessions, interventions, focus scores) |
| Integrations | Composio (Slack, Google Calendar) |
| Extension ↔ Backend | REST (HTTP POST on every tab change) |

---

## All New Files

| Phase | Files |
|-------|-------|
| 1 | `extension/manifest.json`, `extension/src/background/index.js`, `extension/src/popup/App.jsx`, `extension/popup.html`, `extension/vite.config.js` |
| 2 | `backend/main.py`, `backend/agents/observer.py`, `backend/agents/analyzer.py`, `backend/agents/intervener.py`, `backend/crew.py`, `backend/models.py` |
| 3 | `backend/db/snowflake_client.py`, `backend/db/schema.sql`, `backend/db/logger.py` |
| 4 | `backend/actions/composio_client.py`, `backend/actions/slack_action.py`, `backend/actions/calendar_action.py` |
| 5 | `backend/insights/cortex_analyst.py`, `extension/src/dashboard/App.jsx`, `extension/dashboard.html` |

---

## Environment Variables

```bash
# Snowflake
SNOWFLAKE_ACCOUNT=your-account-id
SNOWFLAKE_USER=your-user
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_DATABASE=DEEP_WORK
SNOWFLAKE_SCHEMA=AGENT
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=SYSADMIN

# Composio
COMPOSIO_API_KEY=your-composio-key

# CrewAI / LLM
OPENAI_API_KEY=sk-...   # or route through Snowflake Cortex directly

# Extension Backend URL
VITE_BACKEND_URL=http://localhost:8000
```

---

## Package Installation

```bash
# Backend
pip install fastapi uvicorn crewai crewai-tools composio-crewai snowflake-connector-python python-dotenv pydantic

# Extension
cd extension
npm install react react-dom vite @vitejs/plugin-react
```

---

## Build Order (24-hour hackathon)

| Time | Goal |
|------|------|
| Hour 1–2 | Phase 1: Extension tab detection + backend ping |
| Hour 3–5 | Phase 2: CrewAI crew reasoning + tab blocking |
| Hour 6–7 | Phase 3: Snowflake logging |
| Hour 8–9 | Phase 4: Composio Slack nudge |
| Hour 10 | Phase 5: Cortex insights + demo polish |

**Cut if time is short**: Calendar blocking (Phase 4), Cortex insights dashboard (Phase 5). The minimum demo that wins is: tab opens → agent blocks it → Slack message fires → Snowflake log updates live.

---

## Boilerplate Setup

Run these once at the very start — before touching any phase file — to scaffold the full project skeleton.

### Step 0: Root Structure

```bash
mkdir -p DeepWorkAgent && cd DeepWorkAgent

# Backend skeleton
mkdir -p backend/{agents,db,actions,insights}
touch backend/{main.py,crew.py,models.py,.env}
touch backend/agents/{__init__.py,observer.py,analyzer.py,intervener.py}
touch backend/db/{__init__.py,snowflake_client.py,schema.sql,logger.py}
touch backend/actions/{__init__.py,composio_client.py,slack_action.py,calendar_action.py}
touch backend/insights/{__init__.py,cortex_analyst.py}

# Extension skeleton
mkdir -p extension/src/{background,popup,dashboard,content}
mkdir -p extension/icons
touch extension/{manifest.json,popup.html,dashboard.html,vite.config.js,package.json,rules.json}
touch extension/src/background/index.js
touch extension/src/popup/{main.jsx,App.jsx}
touch extension/src/dashboard/{main.jsx,App.jsx}
touch extension/src/content/overlay.js
```

Expected layout after running the above:

```
DeepWorkAgent/
├── backend/
│   ├── main.py
│   ├── crew.py
│   ├── models.py
│   ├── .env
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── observer.py
│   │   ├── analyzer.py
│   │   └── intervener.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── snowflake_client.py
│   │   ├── schema.sql
│   │   └── logger.py
│   ├── actions/
│   │   ├── __init__.py
│   │   ├── composio_client.py
│   │   ├── slack_action.py
│   │   └── calendar_action.py
│   └── insights/
│       ├── __init__.py
│       └── cortex_analyst.py
└── extension/
    ├── manifest.json
    ├── popup.html
    ├── dashboard.html
    ├── vite.config.js
    ├── package.json
    ├── rules.json
    ├── icons/
    └── src/
        ├── background/
        │   └── index.js
        ├── popup/
        │   ├── main.jsx
        │   └── App.jsx
        ├── dashboard/
        │   ├── main.jsx
        │   └── App.jsx
        └── content/
            └── overlay.js
```

---

### Step 1: Backend — Python Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

pip install fastapi uvicorn crewai crewai-tools composio-crewai composio-core \
            snowflake-connector-python python-dotenv pydantic langchain-openai
```

---

### Step 2: Extension — Node Dependencies

```bash
cd ../extension
npm init -y
npm install react react-dom vite @vitejs/plugin-react
```

Add these scripts to `extension/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

### Step 3: `.env` Template

Copy this into `backend/.env` and fill in your values:

```bash
# ── OpenAI / LLM ──────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Snowflake ─────────────────────────────────────────────
SNOWFLAKE_ACCOUNT=your-account-locator    # e.g. abc12345.us-east-1
SNOWFLAKE_USER=your-username
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_DATABASE=DEEP_WORK
SNOWFLAKE_SCHEMA=AGENT
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=SYSADMIN

# ── Composio ──────────────────────────────────────────────
COMPOSIO_API_KEY=your-composio-key

# ── Slack ─────────────────────────────────────────────────
SLACK_CHANNEL_ID=C0XXXXXXXXX             # Your personal DM channel ID

# ── Extension ─────────────────────────────────────────────
VITE_BACKEND_URL=http://localhost:8000
```

---

### Step 4: `.gitignore`

Create `DeepWorkAgent/.gitignore`:

```gitignore
# Python
backend/venv/
backend/__pycache__/
backend/**/__pycache__/
backend/.env
*.pyc

# Node
extension/node_modules/
extension/dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

---

### Step 5: Quick-Start Run Commands

Once all phase files are filled in, boot the system with:

```bash
# Terminal 1 — Backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Extension (build once, then load unpacked)
cd extension && npm run build
# Chrome → chrome://extensions → Developer mode → Load unpacked → select dist/
```

Health-check:

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

