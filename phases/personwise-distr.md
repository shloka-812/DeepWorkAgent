Plan A — "Backend First" (Safest for Demo)
Person A owns the entire backend spine. Person B builds everything that wraps around it.
The logic here is that the backend is the riskiest part — CrewAI + Groq + Snowflake + Composio all talking together is where most bugs will hide. Getting that solid first means Person B always has a real backend to test against.
HOUR 1-2
Person A                                Person B
────────────────────────────────────    ────────────────────────────────────
FastAPI skeleton + /event endpoint      Chrome extension manifest + background.js
models.py (agree together at hour 1)   Tab change listener (hits mock backend)
Groq LLM setup + verify response       Block overlay + nudge UI

HOUR 3-4
Person A                                Person B
────────────────────────────────────    ────────────────────────────────────
Observer Agent (LLM call #1)            Intent dialog (ASK flow)
Analyzer Agent (LLM call #2)            Popup UI (Start/Stop session)
Intervener Agent (LLM call #3)          Snowflake schema (SQL worksheet)
                                        ← fully independent, just SQL

HOUR 5   ◄── SYNC POINT
Person A runs backend, Person B points extension at it
Test: tab change → agent response → overlay fires
Fix integration bugs together (~45 mins)

HOUR 6-7
Person A                                Person B
────────────────────────────────────    ────────────────────────────────────
Escalation scheduler (asyncio timers)   Snowflake logger functions
Composio Slack setup                    mac_monitor.py core loop
Calendar read integration               mac → backend event sending

HOUR 8-9
Person A                                Person B
────────────────────────────────────    ────────────────────────────────────
Cortex insights functions               Dashboard UI (uses /insights endpoint)
/insights API endpoint                  mac_monitor permissions + launchd

HOUR 10
Joint demo rehearsal — run full flow: monitor → nudge → block ladder
Test Chrome + mac_monitor simultaneously (duplicate event check)
Best for: Teams where one person is stronger in Python/ML and the other in frontend. Low risk of integration failure at demo time.
Risk: Person A has a heavier load in hours 1-4. Person B is mostly unblocked but has less critical work early on.