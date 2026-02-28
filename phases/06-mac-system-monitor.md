# Phase 6: macOS System Monitor

## Goal
Extend the agent's visibility to the entire Mac — not just Chrome tabs. A lightweight Python background process monitors the active application and window title using AppleScript, classifies them as work/distraction, and sends events to the same FastAPI backend that the Chrome extension uses. Both sensors feed one unified agent crew.

**No changes to mac_monitor.py core logic in V2** — the existing implementation is correct. Changes in this phase are to how the unified context is built in `main.py` and how the Observer Agent uses Mac context alongside the new intent signals.

**Depends on**: Phase 2 (FastAPI backend must be running)

---

## 6.1 What mac_monitor.py Is

Not a library — a plain Python script you run in the background.

```
mac_monitor.py
    │
    ├── AppleScript (built into macOS)
    │   → "what app is open right now?"
    │   → "what is the window title?"
    │
    ├── pyobjc-framework-Quartz (pip install, optional)
    │   → "how many seconds since last keyboard/mouse input?"
    │
    └── requests (pip install)
        → "POST to FastAPI /event every time app switches"
```

It polls every 3 seconds. Only fires a backend event when the app or
window title actually changes — not on every poll.

---

## 6.2 Install

```bash
pip install requests python-dotenv pyobjc-framework-Quartz
```

---

## 6.3 App Classification (Built Into mac_monitor.py)

```python
WORK_APPS = {
    "Code":       "coding",      # VS Code
    "Cursor":     "coding",      # Cursor IDE
    "Zed":        "coding",
    "PyCharm":    "coding",
    "Terminal":   "coding",
    "iTerm2":     "coding",
    "Warp":       "coding",
    "Figma":      "design",
    "Sketch":     "design",
    "Notion":     "writing",
    "Obsidian":   "writing",
    "Linear":     "project_management",
    "Slack":      "communication",  # grey area — watch window title
}

DISTRACTION_APPS = {
    "YouTube":   "entertainment",
    "Netflix":   "entertainment",
    "Spotify":   "entertainment",
    "Messages":  "social",
    "Discord":   "social",
    "TikTok":    "social",
}
```

---

## 6.4 Task Inference From Window Title

mac_monitor.py parses window titles to give the Observer Agent
more specific context before the LLM even runs:

| App | Window Title | Inferred Task |
|---|---|---|
| VS Code | `main.py — deep-work-agent` | `Editing main.py in deep-work-agent` |
| VS Code | `planner.py — deep-work-agent` | `Editing planner.py in deep-work-agent` |
| Terminal | `deep-work-agent — python -m pytest` | `Running tests in Terminal` |
| Figma | `iOS App Redesign` | `Designing in Figma — iOS App Redesign` |
| Notion | `Sprint Planning` | `Writing in Notion — Sprint Planning` |

This pre-classification means the Observer Agent's LLM call is cheaper
and faster — it gets a specific starting point rather than raw data.

---

## 6.5 How V2 Backend Uses Mac Context

In `backend/main.py`, `_build_unified_context()` merges both sensors:

```python
def _build_unified_context(event: TabEvent) -> dict:
    return {
        # Browser context (Chrome extension)
        "url":              agent_context.get("current_url"),
        "title":            agent_context.get("current_tab_title"),
        "domain":           event.domain,
        "navigation_type":  event.navigation_type,   # NEW in V2
        "referrer":         event.referrer,           # NEW in V2
        "dwell_seconds":    event.dwell_seconds,      # NEW in V2

        # Mac context (mac_monitor.py)
        "app":              agent_context.get("current_app"),
        "window_title":     agent_context.get("current_window"),
        "inferred_task_mac": event.inferred_task,

        # Calendar context (fetched at session start)
        "calendar":         agent_context.get("calendar", {}),  # NEW in V2

        # Classification
        "isDistraction":    event.is_distraction,
        "is_work":          event.is_work,
        "category":         event.category,

        # Session
        "sessionDurationSeconds": event.sessionDurationSeconds or 0,
        "tabHistory":       event.tabHistory or [],
        "last_known_task":  agent_context.get("inferred_task"),
    }
```

The Observer Agent now receives VS Code window title + calendar task
+ browser URL all at once. It can triangulate with high confidence:

```
Mac says:      "Editing planner.py — deep-work-agent"
Calendar says: "Write applyPlan() + unit tests (47 mins left)"
Browser:       "youtube.com/watch?v=fastapi-tutorial"
Referrer:      "google.com/search?q=fastapi+dependency"

Observer:      "Writing applyPlan() in Python, watching FastAPI tutorial"
Intent:        work_related (0.95)
Action:        monitor (specific video, within grace period)
```

---

## 6.6 Work-Return Cancels Escalations

When mac_monitor detects a return to a work app during an active escalation:

```python
# In mac_monitor.py — when app switches back to VS Code/Terminal
if is_work and was_previously_distraction:
    requests.post(f"{BACKEND_URL}/event", json={
        "event": "work_return",
        "app": app,
        "source": "mac_system"
    })
```

Backend cancels pending escalation timers immediately:

```python
# In main.py
if event.event == "work_return":
    key = get_escalation_key(...)
    cancel_escalations(key)
    return AgentResponse(action=ActionType.NONE)
```

This is the feature that makes the agent feel respectful rather than
nagging — if you returned to work, it shuts up.

---

## 6.7 Install as Background Service

```bash
chmod +x install_mac_monitor.sh
./install_mac_monitor.sh
```

The script:
1. Installs Python dependencies
2. Patches the launchd plist with your correct paths
3. Registers with `launchctl` to auto-start on login
4. Starts the service immediately

---

## 6.8 macOS Permissions (Required Once)

Two permission prompts will appear the first time:

**Accessibility** — for AppleScript to query app names:
```
System Settings → Privacy & Security → Accessibility → add Terminal
```

**Automation** — for AppleScript to send commands:
```
System Settings → Privacy & Security → Automation → Terminal → System Events ✅
```

---

## 6.9 Manual Controls

```bash
# Development (foreground, verbose)
python backend/system_agent/mac_monitor.py --verbose

# Check service is running
launchctl list | grep deepworkagent

# View live logs
tail -f ~/Library/Logs/deep-work-agent.log

# Stop service
launchctl stop com.deepworkagent.monitor

# Start service
launchctl start com.deepworkagent.monitor

# Full uninstall
launchctl unload ~/Library/LaunchAgents/com.deepworkagent.monitor.plist
rm ~/Library/LaunchAgents/com.deepworkagent.monitor.plist
```

---

## 6.10 The Demo This Enables

Without Phase 6 (browser-only):
```
Judge: "What if I'm coding in VS Code?"
You:   "The extension can't see that."
```

With Phase 6:
```
1. Close Chrome entirely
2. Open VS Code → monitor logs "Editing planner.py — deep-work-agent"
3. CMD+TAB to YouTube (the app, not browser)
4. macOS notification fires in 3 seconds
5. Slack DM arrives
6. Show Snowflake: AGENT_DECISIONS row, source="mac_system"
7. CMD+TAB back to VS Code
8. "The escalation was cancelled the moment I returned to VS Code."
```

*"We see the whole Mac. And we stop watching the moment you're back to work."*

---

## 6.11 Verification Checklist

- [ ] `python mac_monitor.py --verbose` starts without errors
- [ ] macOS prompts for Accessibility permission — grant it
- [ ] Switching to VS Code logs `🟢 Code | filename — project`
- [ ] Switching to YouTube app logs `🔴 YouTube`
- [ ] `GET /context` shows `current_app` updating correctly
- [ ] Focus session active + YouTube → macOS notification fires
- [ ] Slack DM also fires for mac-sourced distraction
- [ ] Snowflake `TAB_EVENTS` shows `source=mac_system` rows
- [ ] Returning to VS Code cancels pending escalation (check logs)
- [ ] `install_mac_monitor.sh` completes without errors
- [ ] `launchctl list | grep deepworkagent` shows service running
- [ ] After Mac reboot — service auto-starts (verify with launchctl)
- [ ] Chrome extension and mac_monitor running simultaneously — no duplicate events
