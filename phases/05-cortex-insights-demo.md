# Phase 5: Cortex AI Insights + Demo Polish

## Goal
Use Snowflake Cortex (Llama running inside Snowflake) to generate personalized insights from your data. Dashboard now shows richer analytics including grace period calibration suggestions, nudge effectiveness scores, and drift pattern analysis — all powered by the new V2 tables.

**New in V2:**
- Insights use new `AGENT_DECISIONS` and `V_NUDGE_EFFECTIVENESS` tables
- Cortex analyzes your YouTube/Slack dwell patterns to suggest grace period adjustments
- Dashboard shows `allow` vs `monitor` vs `block` breakdown — not just interventions
- Demo script updated for full V2 flow including intent check + escalation ladder

**Depends on**: Phases 1–4 fully working

---

## 5.1 Updated File: `backend/insights/cortex_analyst.py`

### New insight functions:

```python
def get_grace_period_recommendations() -> str:
    """
    Ask Cortex to recommend personalized grace period adjustments
    based on actual dwell patterns from AGENT_DECISIONS.

    e.g. "Your YouTube tutorial visits average 9 mins.
          Consider extending your grace period from 12 to 15 mins."
    """
    dwell_data = execute("SELECT * FROM V_DWELL_PATTERNS LIMIT 10")

    return cortex_complete(f"""
        Based on this user's actual browsing dwell patterns:
        {json.dumps(dwell_data)}

        Suggest 1-2 specific grace period adjustments in plain English.
        Reference specific sites and actual numbers from the data.
        Keep it under 2 sentences. No jargon.
    """)

def get_nudge_effectiveness_summary() -> str:
    """
    Tell user how well the agent's interventions are working.
    e.g. "Nudges bring you back 78% of the time.
          Blocks are needed for Twitter — nudges alone don't work there."
    """
    eff_data = execute("SELECT * FROM V_NUDGE_EFFECTIVENESS")

    return cortex_complete(f"""
        Based on this intervention effectiveness data:
        {json.dumps(eff_data)}

        Write one sentence summarizing how well the agent's
        interventions are working for this user.
        Be specific — mention the return rate percentage if available.
    """)

def get_drift_pattern_analysis() -> str:
    """
    Analyze when within-work drift happens most.
    Uses AGENT_DECISIONS verdict breakdown.
    """
    decisions = execute("""
        SELECT verdict, COUNT(*) as count,
               AVG(intent_confidence) as avg_confidence,
               domain
        FROM AGENT_DECISIONS
        WHERE decided_at >= DATEADD('day', -7, CURRENT_TIMESTAMP())
        GROUP BY verdict, domain
        ORDER BY count DESC
        LIMIT 15
    """)

    return cortex_complete(f"""
        Based on these agent decision patterns over the last 7 days:
        {json.dumps(decisions)}

        Identify the most interesting pattern — when does this user
        drift most? What does the agent allow vs. block most?
        One sentence, specific, no jargon.
    """)
```

### Updated `get_full_insights()`:

```python
def get_full_insights() -> dict:
    return {
        "today": { ... },             # Existing
        "peak_hours": [ ... ],        # Existing
        "top_distractions": [ ... ],  # Existing
        "ai_summary": get_ai_weekly_summary(),          # Existing
        "distraction_tip": get_distraction_analysis(),  # Existing
        # New V2 fields:
        "grace_period_tip": get_grace_period_recommendations(),
        "nudge_effectiveness": get_nudge_effectiveness_summary(),
        "drift_pattern": get_drift_pattern_analysis(),
        "decision_breakdown": get_decision_breakdown(),  # allow/monitor/ask/nudge/block counts
    }

def get_decision_breakdown() -> dict:
    """Counts of each verdict type this week."""
    rows = execute("""
        SELECT verdict, COUNT(*) as count
        FROM AGENT_DECISIONS
        WHERE decided_at >= DATEADD('day', -7, CURRENT_TIMESTAMP())
        GROUP BY verdict
    """)
    return {r["VERDICT"]: r["COUNT"] for r in rows}
```

---

## 5.2 Updated Dashboard: `extension/src/dashboard/App.jsx`

New sections added to the dashboard:

### Decision Breakdown (new)
Shows how often the agent allows vs. monitors vs. nudges vs. blocks.
Most users will see mostly `allow` and `monitor` — that means the agent
is smart enough to trust your workflow.

```
Agent Decisions This Week
allow    ████████████████  142  (legitimate work visits)
monitor  ██████            48   (borderline — watched then cleared)
nudge    ████              31   (soft reminder sent)
ask      ██                14   (intent was unclear)
block    ██                12   (clear distraction blocked)
```

### Nudge Effectiveness (new)
```
Nudge effectiveness: 78% return rate
Blocks: needed for Twitter — nudges don't work there
```

### Grace Period Tip (new, powered by Cortex)
```
✦ Cortex Calibration Tip
Your YouTube tutorial visits average 9 mins.
Consider extending your grace period to 15 mins.
```

---

## 5.3 Demo Script (Updated for V2 — 3 Minutes)

### Minute 1 — Setup (30 sec)

- Open Chrome, click 🎯 popup — show "Idle"
- Point to calendar on screen: "9–11 AM: Write applyPlan() + unit tests"
- Click **Start Focus Session**
- Show console log: `[Calendar] Current task: Write applyPlan() + unit tests`
- *"The agent just read my calendar. It now knows exactly what I should be doing."*

### Minute 2 — The Workflows (90 sec)

**Scene 1 — Legitimate YouTube (30 sec)**
- Open VS Code, then Google `fastapi dependency injection tutorial`
- Click a YouTube result → specific video URL
- Point to terminal: agent returns `action: monitor`
- *"Specific video from a Google search during a coding session — the agent let me through. It knows the difference."*

**Scene 2 — YouTube homepage (30 sec)**
- Close that tab, type `youtube.com` directly
- Intent dialog appears: *"Is this visit work-related?"*
- Click ❌ No → block overlay fires
- *"Typed YouTube directly — intent unclear. Agent asked. I said no. Blocked."*

**Scene 3 — Escalation ladder (30 sec)**
- Start new YouTube specific video, wait
- *"If I stay too long..."* — at the 12-min mark nudge fires
- Show Slack message: *"12 mins on YouTube during your applyPlan() block."*
- *"I didn't respond — 3 minutes later, blocked."*

### Minute 3 — The Memory (30 sec)

- Open the dashboard tab
- Show decision breakdown: "142 allows, 12 blocks — the agent trusts my workflow"
- Show Cortex AI grace period tip: *"This insight was generated by Llama running inside Snowflake on my own data"*
- *"Every session makes it smarter. It learns your YouTube dwell patterns,
   whether nudges work on you, your peak hours — all inside Snowflake, all private."*

---

## 5.4 Updated Q&A for Judges

**"How is this different from a simple website blocker?"**
A blocker has rules. We have a crew of agents that reasons. We allowed 142 visits this week that a dumb blocker would have blocked — YouTube tutorials, Slack in project channels, Medium articles. We only intervened 12 times. A blocker would have fired hundreds of times and destroyed the user's flow.

**"What if I watch YouTube tutorials legitimately?"**
That's exactly what we designed for. A specific video URL arriving from a Google search gets a 12-minute grace period. The homepage gets an intent dialog immediately. We track your actual YouTube dwell patterns in Snowflake and Cortex suggests personalizing your grace period based on real data.

**"What's the Snowflake + Cortex angle?"**
Three things: (1) All agent memory — sessions, decisions, patterns — lives in Snowflake. (2) The Analyzer Agent pulls your behavioral history on every decision. (3) Cortex runs Llama directly on those tables for insights — no data leaves your account, no external API call. The LLM and the data are in the same place.

**"What LLM do you use?"**
Groq's Llama 3.1-70b for real-time agent decisions — it's free, open source, and fast enough for sub-3-second responses. Snowflake Cortex for analytics — same Llama family, runs inside Snowflake. We use Llama throughout, which fits the Llama Lounge theme.

---

## 5.5 Final Verification Checklist

- [ ] `/insights` endpoint returns all V2 fields including `decision_breakdown`
- [ ] `grace_period_tip` generates from actual dwell data after 2+ sessions
- [ ] `nudge_effectiveness` shows real return rate after 3+ interventions
- [ ] Dashboard decision breakdown chart renders correctly
- [ ] Demo runs cleanly: monitor → nudge → block escalation ladder visible
- [ ] Intent dialog appears on `ask` action, both yes/no paths work
- [ ] Calendar task name appears in Slack messages
- [ ] Cortex insights load in dashboard (may take 5–10 sec)
- [ ] GitHub repo is public, README has architecture diagram
- [ ] 1-minute demo video recorded
