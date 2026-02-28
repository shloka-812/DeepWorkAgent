# Person B - HOUR 1-2 Chrome Extension Setup & Test Guide

> This guide walks through building and testing the core extension components:
> - Tab change listener
> - Nudge/Block overlay UI  
> - Mock backend integration

## Prerequisites

✅ Node.js 18+ installed  
✅ Chrome/Chromium browser  
✅ Python 3 (for mock backend)  
✅ VS Code (recommended)

---

## Step 1: Install Dependencies

```bash
cd /Users/dviona/Desktop/DeepWorkAgent/extension
npm install
```

Expected output: Should install React, Vite, and dependencies listed in package.json.

---

## Step 2: Build the Extension

```bash
npm run build
```

This will:
- Compile React popup UI
- Bundle background service worker (`src/background/index.js`)
- Bundle content script (`src/content/overlay.js`)
- Output to `dist/` folder

**Verify:** Check that `dist/` folder exists with:
- `popup.html` 
- `manifest.json` (copied from root)
- `popup.js` or similar (Vite-bundled)
- `background.js`
- `content.js` or `overlay.js`

---

## Step 3: Install Extension in Chrome

1. **Copy manifest to dist:**
   ```bash
   cp manifest.json dist/
   ```

2. **Open Chrome:**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (top-right toggle)

3. **Load unpacked extension:**
   - Click **Load unpacked**
   - Select the `dist/` folder
   - Extension should appear in the list with icon + "Deep Work Agent"

4. **Verify no errors:**
   - Open DevTools: Right-click extension icon → "Inspect popup"
   - Should see popup UI render with "Deep Work Agent" title

---

## Step 4: Start Mock Backend

In a separate terminal:

```bash
cd /Users/dviona/Desktop/DeepWorkAgent/extension
python3 mock_backend.py
```

Expected output:
```
╔════════════════════════════════════════════════════════════════╗
║          🤖 Mock Backend Server (HOUR 1-2 Testing)           ║
╚════════════════════════════════════════════════════════════════╝

✅ Server running at http://localhost:8000

Endpoints:
  GET  /health          Check server status
  POST /event           Receive tab change events
```

---

## Step 5: Test Tab Change Listener

### Test 5.1: Verify Extension Popup Works

1. Click extension icon in Chrome toolbar
2. Popup should show:
   - "🎯 Deep Work Agent" title
   - Status badge: "Monitoring Inactive" (gray)
   - "▶ Start Monitoring" button
   - Current tab info (domain + title)

### Test 5.2: Start Monitoring & Change Tabs

1. Click **"▶ Start Monitoring"** button
   - Status should change to "Monitoring Active" (green pulsing dot)

2. Open a new tab and visit any website (e.g., `example.com`)

3. **Check backend logs:**
   - Should see output like:
     ```
     📨 Received event:
        URL: https://example.com/
        Domain: example.com
        Title: Example Domain
        Dwell time: 0s
        → Action: log
        → Message: Visiting example.com
     ```

4. **Verify tab listener is working:**  
   - Switch tabs multiple times
   - Each tab change = new POST to `/event`

---

## Step 6: Test Nudge UI

### Test 6.1: Trigger Nudge Response

1. Visit a **news site** (BBC, CNN, Google News, etc.)
2. Check backend logs — should see:
   ```
   → Action: nudge
   → Message: ⏰ You're on {domain}. Remember your focus goal!
   ```

3. **Verify toast notification appears:**
   - Should see non-blocking toast in **top-right corner**
   - Purple gradient background
   - Message text
   - Close button (×)
   - Auto-dismisses after 5 seconds

4. **Test dismissal:**
   - Click × button on toast
   - Toast should fade out immediately

### Test 6.2: Multiple Nudges

1. Visit multiple news sites in succession
2. Each should show a separate toast (old one auto-dismisses)

---

## Step 7: Test Block UI

### Test 7.1: Trigger Block Response

1. Visit a **social media site** (YouTube, Twitter, Instagram, Reddit, TikTok, etc.)
2. Check backend logs — should see:
   ```
   → Action: block
   → Message: 🚫 {domain} is a known distraction. Take a moment to refocus...
   ```

3. **Verify overlay blocks page:**
   - Full-page dark overlay appears
   - Cannot interact with content beneath
   - Modal card in center with:
     - ⏸ "Focus Time Active" title
     - Message about distraction
     - "I understand, dismiss" button
   - Smooth fade-in animation

4. **Test dismissal:**
   - Click "I understand, dismiss"
   - Overlay fades out, page content accessible again

5. **Test re-blocking:**
   - Visit the distraction site again
   - Should block again (each tab change re-checks)

---

## Step 8: Test Stop Monitoring

1. Click **"⏸ Stop Monitoring"** button in popup
   - Status should change to "Monitoring Inactive"

2. Visit a distraction site
   - **No overlay, no nudges** (session is paused)

3. Check backend logs
   - **No new events** post to `/event`

4. Click **"▶ Start Monitoring"** again
   - Resume tracking

---

## Step 9: Check Background Service Worker

1. In `chrome://extensions/`, find Deep Work Agent
2. Click **"Service Worker"** link (or "Inspect" → "ServiceWorker")
3. Should see console logs:
   ```
   Deep Work Agent - Background service worker loaded
   ```

4. **Verify message passing:**
   - Open DevTools Console for any tab
   - In background service worker DevTools:
     - Should see `console.log` on tab events
     - No errors about undefined `chrome.tabs.onUpdated`

---

## Step 10: Check Content Script

1. Open **any webpage** while monitoring is active
2. Right-click → **Inspect** → Switch to **Console**
3. Should see:
   ```
   Deep Work Agent - Content script loaded
   ```

4. **Verify message reception:**
   - After backend responds with nudge/block
   - Content script console should show message event received
   - Overlay/toast should render

---

## Debugging Checklist

| Issue | Solution |
|-------|----------|
| Extension not installing | Check `manifest.json` syntax, ensure `dist/manifest.json` exists |
| Popup won't load | Check popup.html path in manifest is correct, npm build succeeded |
| Tab listener not firing | Check `chrome://extensions/` → Deep Work Agent has "Service Worker" running |
| Backend unreachable | Verify `python3 mock_backend.py` is running on port 8000, check for port conflicts |
| Overlay not appearing | Open DevTools → Console, look for JS errors in content script |
| Toast appears but no message | Check message object structure matches `{action, message}` in background.js |
| Status badge not updating | Browser might need refresh (Ctrl+R) after code changes |

---

## Common Errors & Fixes

### Error: "Unchecked runtime.lastError"
- Extension trying to send message to unloaded content script
- **Fix:** Add `.catch()` to `chrome.tabs.sendMessage()` calls (already done in code)

### Error: "Cannot read property 'url' of undefined"
- Tab object incomplete
- **Fix:** Check tab.url exists before using it

### Mock backend not responding
- Port 8000 already in use
- **Fix:** Kill other process: `lsof -i :8000 | awk 'NR!=1 {print $2}' | xargs kill`

---

## File Structure Verification

Expected structure after `npm run build`:

```
extension/
├── manifest.json              ✅
├── popup.html                 ✅  
├── package.json               ✅
├── vite.config.js             ✅
├── mock_backend.py            ✅
├── dist/
│   ├── manifest.json          (copied)
│   ├── popup.html             
│   ├── popup.js               (Vite output)
│   ├── background.js          (Vite output)
│   ├── content.js or overlay.js (Vite output)
│   └── (other bundled files)
└── src/
    ├── background/
    │   └── index.js           ✅
    ├── content/
    │   └── overlay.js         ✅
    ├── popup/
    │   ├── App.jsx            ✅
    │   ├── App.css            ✅
    │   └── main.jsx           ✅
    └── dashboard/
        ├── App.jsx            
        └── main.jsx
```

---

## Next Steps (HOUR 3-4)

After HOUR 1-2 completion:

✅ **Person B HOUR 1-2 complete when:**
- [ ] Extension installs and popup loads
- [ ] Tab listener fires → backend receives events
- [ ] Nudge toast appears on news sites
- [ ] Block overlay appears on social media sites
- [ ] No JS console errors
- [ ] Start/Stop monitoring buttons work

**HOUR 3-4 builds on this:**
- Intent dialog (ASK flow) in popup
- Enhanced popup UI (settings, session info)
- (SQL worksheet for Snowflake is independent)

---

## Questions?

When you reach the **HOUR 5 sync point**, Person A will have the real backend running.  
You'll swap `http://localhost:8000` for the actual Person A backend endpoint and test:
- Real agent responses (Observer, Analyzer, Intervener)
- Integration with ChromeOS system events
- Escalation timers and Slack notifications

Good luck! 🚀
