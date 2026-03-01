# Deep Work Agent - Chrome Extension

**Build Person B's responsibility for HOUR 1-2: Tab change listener + Block/Nudge UI**

> This Chrome extension monitors tab changes and accepts AI-driven responses from the backend to nudge or block distracting websites.

## What's Built (HOUR 1-2)

### 📋 Manifest Configuration (`manifest.json`)
- ✅ Chrome Manifest V3
- ✅ Permissions: `tabs`, `activeTab`, `scripting`, `storage`, `alarms`
- ✅ Host permissions for all HTTP/HTTPS sites
- ✅ Background service worker registration
- ✅ Content script for all pages
- ✅ Popup action configuration

### 🔄 Background Service Worker (`src/background/index.js`)
- ✅ Tab change listener (`chrome.tabs.onUpdated`)
- ✅ Tab activation listener (`chrome.tabs.onActivated`)
- ✅ Event collection with schema:
  ```json
  {
    "event": "tab_change",
    "url": "...",
    "title": "...",
    "domain": "...",
    "isDistraction": null,
    "is_work": null,
    "dwell_seconds": 0,
    "referrer": "...",
    "navigation_type": "tab_change",
    "sessionDurationSeconds": 0,
    "tabHistory": [...],
    "source": "browser"
  }
  ```
- ✅ POST events to `http://localhost:8000/event`
- ✅ Store responses in `chrome.storage.local`
- ✅ Message passing with content scripts
- ✅ Session start/stop control

### 🎨 Content Script (`src/content/overlay.js`)
- ✅ **Nudge UI** (non-blocking toast notification)
  - Top-right corner
  - Purple gradient
  - Auto-dismiss after 5s
  - Manual close button
  
- ✅ **Block UI** (full-page overlay)
  - Dark semi-transparent background
  - Centered modal card
  - Message + dismiss button
  - Prevents interaction with page content
  - Smooth animations

- ✅ Message listener for agent responses
- ✅ Dynamic animation injection

### 🎛️ Popup UI (`src/popup/App.jsx`)
- ✅ Session status display
  - Active/inactive indicator
  - Green pulsing dot when monitoring
  - Gray dot when inactive

- ✅ Current tab information
  - Domain
  - Page title
  
- ✅ Control buttons
  - Start/Stop monitoring
  - Toggle between states

- ✅ Backend connectivity indicator
  - Warning if localhost:8000 unreachable

- ✅ Help/Info section
  - Expandable details about how it works

- ✅ Professional UI with gradient background
  - React + CSS styling
  - Responsive design
  - Smooth transitions

### 🔧 Build Configuration (`vite.config.js`)
- ✅ Vite setup with React support
- ✅ Multi-entry build (popup, background, content script)
- ✅ Output to `dist/` folder
- ✅ Terser minification

### 🤖 Mock Backend (`mock_backend.py`)
- ✅ Simple Python HTTP server on localhost:8000
- ✅ Heuristic-based AI decision logic:
  - Social media sites → **block** response
  - News sites → **nudge** response
  - Other sites → **log** response
- ✅ Event logging for debugging
- ✅ Health check endpoint

---

## Quick Start

### Installation

```bash
cd extension
npm install
```

### Development Build

```bash
npm run build
```

Then load `dist/` folder in `chrome://extensions/` (Developer mode).

### Testing

**Terminal 1: Mock Backend**
```bash
python3 mock_backend.py
```

**Terminal 2: Watch Extension**
```bash
npm run dev
```

Then:
1. Install extension from `dist/`
2. Click extension icon
3. Click "Start Monitoring"
4. Visit a website → tab event sent to backend
5. Visit social media site → overlay blocks page
6. Visit news site → toast nudges you

---

## File Structure

```
extension/
├── manifest.json              # Chrome manifest configuration
├── popup.html                 # Popup entry point
├── vite.config.js             # Vite build config
├── mock_backend.py            # For testing (HOUR 1-2)
├── TESTING_GUIDE.md           # Detailed test steps
├── package.json               # Dependencies
│
└── src/
    ├── background/
    │   └── index.js           # Service worker (tab listener)
    │
    ├── content/
    │   └── overlay.js         # Content script (nudge/block UI)
    │
    ├── popup/
    │   ├── main.jsx           # React entry
    │   ├── App.jsx            # Popup component
    │   └── App.css            # Popup styles
    │
    └── dashboard/             # (HOUR 8-9)
        ├── main.jsx
        └── App.jsx
```

---

## Integration Points (for Person A)

### Backend Endpoint Required
```
POST http://localhost:8000/event
```

**Request payload:**
```json
{
  "event": "tab_change",
  "url": "https://...",
  "title": "...",
  "domain": "...",
  "isDistraction": null,
  "is_work": null,
  "dwell_seconds": 0,
  "referrer": "...",
  "navigation_type": "tab_change",
  "sessionDurationSeconds": 0,
  "tabHistory": [...],
  "source": "browser"
}
```

**Response format (expected by content script):**
```json
{
  "action": "nudge" | "block" | "log",
  "message": "...",
  "duration": 5000
}
```

where:
- `action`: 
  - `"nudge"` → show toast (5-10s)
  - `"block"` → full-page overlay (until dismissed)
  - `"log"` → no UI action
  
- `message`: Text to display to user

- `duration`: milliseconds (optional, used by nudges)

---

## Testing Checklist

- [ ] Extension installs without errors
- [ ] Popup UI loads with "Deep Work Agent" title
- [ ] Tab listener fires on page navigation
- [ ] Events POST to backend with correct schema
- [ ] Nudge toast appears on appropriate sites (top-right, auto-dismiss)
- [ ] Block overlay appears on distraction sites (full-page, centered)
- [ ] Overlay dismiss button works
- [ ] Start/Stop monitoring button toggles
- [ ] No events sent when monitoring inactive
- [ ] Console shows no JS errors
- [ ] Background service worker running

---

## Known Limitations (HOUR 1-2)

⚠️ **Not yet implemented:**
- No real AI analysis (using mock heuristics)
- No Snowflake logging
- No Slack notifications
- No escalation timers
- No mac_monitor integration
- No dashboard insights
- No calendar integration
- No Composio actions

These come in **HOUR 3-9** after Person A backend is ready.

---

## Performance Notes

- **Minimal overhead:** Tab listener uses native Chrome events
- **No DOM scanning:** Content script only injects UI on demand
- **Storage efficient:** Only keeps last 10 tab history entries per tab
- **Network-bound:** Performance depends on Person A's backend response time

---

## Security Considerations

✅ **Safe practices already implemented:**
- No eval() or innerHTML with user data
- Message passing only between extension and same extension
- Content scripts sandboxed per site
- Service worker ephemeral (no persistent state except chrome.storage)
- No cross-domain requests except to localhost backend (CORS-friendly)

---

## Next Phase (HOUR 3-4)

When Person A backend is ready at HOUR 5:

1. Replace `http://localhost:8000` with actual Person A backend URL
2. Person B adds:
   - Intent dialog (ASK flow) in popup
   - Sessiontype info in popup
   - User preferences UI
3. Test full integration with real agents (Observer, Analyzer, Intervener)

---

## Support

For issues during HOUR 1-2, check:
1. `TESTING_GUIDE.md` - Step-by-step verification
2. Browser DevTools Console (both popup and background service worker)
3. Mock backend logs (should see POST requests)
4. `chrome://extensions/` → Extension details → Errors tab

**Questions for Person A:**
- What's the actual backend base URL for HOUR 5?
- What response format should we expect?
- Should we add request authentication headers?
- Any rate limiting or timeout expectations?

---

Created: HOUR 1-2  
Status: ✅ Core extension complete, ready for integration at HOUR 5 sync point
