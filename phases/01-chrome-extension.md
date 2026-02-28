# Phase 1: Chrome Extension — Tab Monitoring

## Goal
Build the Chrome extension that acts as the agent's eyes and hands in the browser. It monitors every tab change in real time, tracks dwell time on each domain, captures the referrer chain (how the user got to a URL), and pings the FastAPI backend with rich context on every event.

**New in V2:**
- Tracks **dwell time** per domain (critical for grace period logic)
- Captures **referrer** and **navigation type** (direct vs. search vs. link)
- Receives 5 action types: `none / monitor / ask / show_nudge / block_tab`
- Handles **ASK action** — shows an intent confirmation dialog
- Cancels pending escalations when user returns to work

**Depends on**: Nothing — starting point.

---

## 1.1 Install Packages

```bash
mkdir extension && cd extension
npm install react react-dom vite @vitejs/plugin-react
```

---

## 1.2 New File: `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Deep Work Agent",
  "version": "2.0.0",
  "description": "An autonomous agent that understands your workflow and protects your focus.",
  "permissions": [
    "tabs", "storage", "idle", "alarms",
    "declarativeNetRequest", "notifications", "scripting", "webNavigation"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/index.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png" }
  },
  "declarative_net_request": {
    "rule_resources": [{
      "id": "block_rules", "enabled": true, "path": "rules.json"
    }]
  }
}
```

---

## 1.3 New File: `extension/src/background/index.js`

Key additions vs V1:
- **Dwell time tracking**: timestamps when you land on each domain
- **Referrer capture**: records what domain you came from
- **Navigation type**: `direct_type` vs `search_referrer` vs `link_click`
- **Work return detection**: when user returns to a work app, notifies backend to cancel escalations
- **ASK action handler**: shows intent dialog instead of blocking

```javascript
const BACKEND_URL = 'http://localhost:8000';

const WORK_DOMAINS = [
  'github.com', 'stackoverflow.com', 'docs.python.org',
  'developer.mozilla.org', 'notion.so', 'linear.app',
  'figma.com', 'chatgpt.com', 'claude.ai'
];

const DISTRACTION_DOMAINS = [
  'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
  'facebook.com', 'reddit.com', 'twitch.tv', 'netflix.com'
];

// ─── State ───────────────────────────────────────────────────────────
let focusSessionActive = false;
let sessionStartTime = null;
let tabHistory = [];
let dwellTracker = {};      // { domain: { startTime, url } }
let lastWorkDomain = null;  // For work-return detection

// ─── Install ─────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusActive: false, currentTask: null,
    interventionCount: 0, pendingEscalation: null
  });
});

// ─── Tab Change Listener ─────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) await handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await handleTabChange(tab, changeInfo);
  }
});

// ─── Core Tab Handler ─────────────────────────────────────────────────
async function handleTabChange(tab, changeInfo = {}) {
  if (!tab.url || tab.url.startsWith('chrome://')) return;

  const { focusActive } = await chrome.storage.local.get('focusActive');

  const url = new URL(tab.url);
  const domain = url.hostname.replace('www.', '');

  // ── Dwell time calculation ─────────────────────────────────────────
  let dwellSeconds = 0;
  const now = Date.now();

  if (dwellTracker[domain]) {
    dwellSeconds = Math.floor((now - dwellTracker[domain].startTime) / 1000);
  }

  // Start tracking this domain
  dwellTracker[domain] = { startTime: now, url: tab.url };

  // ── Referrer + navigation type ────────────────────────────────────
  const referrer = changeInfo.url ? new URL(changeInfo.url).hostname : null;
  const navigationInfo = getNavigationType(tab.url, referrer);

  // ── Tab history ───────────────────────────────────────────────────
  tabHistory.push({
    url: tab.url, title: tab.title,
    domain, timestamp: now
  });
  if (tabHistory.length > 20) tabHistory.shift();

  // ── Work return detection ─────────────────────────────────────────
  const isWorkDomain = WORK_DOMAINS.some(d => domain.includes(d));
  if (isWorkDomain && !focusActive) {
    await pingBackend({ event: 'work_return', domain, source: 'browser' });
    lastWorkDomain = domain;
    return;
  }

  if (!focusActive) return;

  // ── Classify domain ───────────────────────────────────────────────
  const isDistraction = DISTRACTION_DOMAINS.some(d => domain.includes(d));
  const isWork = WORK_DOMAINS.some(d => domain.includes(d));

  const payload = {
    event: 'tab_change',
    url: tab.url,
    title: tab.title,
    domain,
    isDistraction,
    is_work: isWork,
    dwell_seconds: dwellSeconds,
    referrer: referrer,
    navigation_type: navigationInfo.type,
    sessionDurationSeconds: sessionStartTime
      ? Math.floor((now - sessionStartTime) / 1000) : 0,
    tabHistory: tabHistory.slice(-5),
    source: 'browser'
  };

  const response = await pingBackend(payload);
  if (response) await handleAgentResponse(response);
}

// ─── Navigation Type Detection ────────────────────────────────────────
function getNavigationType(url, referrer) {
  if (!referrer) {
    return { type: 'direct_type', label: 'typed directly' };
  }
  if (referrer.includes('google.') || referrer.includes('bing.')
      || referrer.includes('duckduckgo.')) {
    return { type: 'search_referrer', label: 'came from search' };
  }
  return { type: 'link_click', label: `came from ${referrer}` };
}

// ─── Handle Agent Response ────────────────────────────────────────────
async function handleAgentResponse(response) {
  const { action, message, ask_question } = response;

  switch (action) {
    case 'block_tab':
      await blockCurrentTab(message);
      break;

    case 'show_nudge':
      await showNotification(message);
      break;

    case 'ask':
      // Show intent dialog — let user confirm if visit is work-related
      await showIntentDialog(ask_question || 'Is this visit work-related?');
      break;

    case 'monitor':
      // Silent — backend handles escalation timers
      console.log(`[DeepWork] Monitoring — escalation scheduled`);
      break;

    case 'none':
    default:
      break;
  }

  // Increment intervention count for non-none actions
  if (action && action !== 'none' && action !== 'monitor') {
    const { interventionCount } = await chrome.storage.local.get('interventionCount');
    await chrome.storage.local.set({
      interventionCount: (interventionCount || 0) + 1
    });
  }
}

// ─── Block Tab ────────────────────────────────────────────────────────
async function blockCurrentTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectBlockOverlay,
    args: [message || "Stay in your flow."],
  });
}

// ─── Intent Dialog (ASK action) ───────────────────────────────────────
async function showIntentDialog(question) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectIntentDialog,
    args: [question],
  });
}

// ─── Overlay Injection ────────────────────────────────────────────────
function injectBlockOverlay(message) {
  const existing = document.getElementById('dwa-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dwa-overlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(8,8,8,0.97);z-index:2147483647;
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;font-family:-apple-system,sans-serif;color:#fff;
  `;
  overlay.innerHTML = `
    <div style="text-align:center;max-width:440px;padding:40px;">
      <div style="font-size:48px;margin-bottom:16px">🎯</div>
      <div style="font-size:11px;letter-spacing:3px;color:#22c55e;
                  text-transform:uppercase;margin-bottom:14px">Focus Block Active</div>
      <p style="font-size:17px;font-weight:600;margin-bottom:28px;line-height:1.5">${message}</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="dwa-break" style="background:transparent;border:1px solid #333;
          color:#666;padding:11px 22px;border-radius:8px;font-size:13px;cursor:pointer">
          5-min break
        </button>
        <button id="dwa-focus" style="background:#22c55e;border:none;color:#000;
          padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          Back to work ✅
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('dwa-focus').onclick = () => overlay.remove();
  document.getElementById('dwa-break').onclick = () => {
    overlay.innerHTML = `<p style="color:#666;font-size:16px">Break started. Back in 5 minutes.</p>`;
    setTimeout(() => overlay.remove(), 300000);
  };
}

// ─── Intent Dialog Injection (for ASK action) ─────────────────────────
function injectIntentDialog(question) {
  const existing = document.getElementById('dwa-intent');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.id = 'dwa-intent';
  dialog.style.cssText = `
    position:fixed;top:20px;right:20px;width:300px;
    background:#1a1a1a;border:1px solid #333;border-radius:12px;
    padding:16px;z-index:2147483647;font-family:-apple-system,sans-serif;
    box-shadow:0 8px 32px rgba(0,0,0,0.6);
    animation:slideIn 0.3s ease;
  `;
  dialog.innerHTML = `
    <style>@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}</style>
    <div style="font-size:11px;color:#22c55e;letter-spacing:2px;
                text-transform:uppercase;margin-bottom:10px">🎯 Quick check</div>
    <p style="font-size:13px;color:#ddd;margin-bottom:14px;line-height:1.5">${question}</p>
    <div style="display:flex;gap:8px">
      <button id="dwa-yes" style="flex:1;background:#22c55e;border:none;color:#000;
        padding:9px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">
        ✅ Yes, it's work
      </button>
      <button id="dwa-no" style="flex:1;background:transparent;border:1px solid #333;
        color:#666;padding:9px;border-radius:7px;font-size:12px;cursor:pointer">
        ❌ No, distraction
      </button>
    </div>`;
  document.body.appendChild(dialog);

  // Yes → dismiss, let user continue, report back to backend
  document.getElementById('dwa-yes').onclick = () => {
    dialog.remove();
    // Tell backend user confirmed work intent → cancel escalations
    fetch('http://localhost:8000/intent_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'work_related' })
    }).catch(() => {});
  };

  // No → block immediately
  document.getElementById('dwa-no').onclick = () => {
    dialog.remove();
    injectBlockOverlay("Good call. Let's get back to it.");
    fetch('http://localhost:8000/intent_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'distraction' })
    }).catch(() => {});
  };

  // Auto-dismiss after 30s if no response (treat as distraction)
  setTimeout(() => {
    if (document.getElementById('dwa-intent')) {
      dialog.remove();
      injectBlockOverlay("No response — back to work.");
    }
  }, 30000);
}

// ─── Notification ─────────────────────────────────────────────────────
async function showNotification(message) {
  chrome.notifications.create({
    type: 'basic', iconUrl: 'icons/icon48.png',
    title: 'Deep Work Agent', message: message || '',
    priority: 2
  });
}

// ─── Backend Communication ────────────────────────────────────────────
async function pingBackend(payload) {
  try {
    const res = await fetch(`${BACKEND_URL}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Session Controls ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'START_FOCUS') {
    focusSessionActive = true;
    sessionStartTime = Date.now();
    dwellTracker = {};
    await chrome.storage.local.set({ focusActive: true });
    await pingBackend({ event: 'session_start', timestamp: sessionStartTime });
    sendResponse({ success: true });
  }
  if (msg.type === 'STOP_FOCUS') {
    focusSessionActive = false;
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    await chrome.storage.local.set({ focusActive: false });
    await pingBackend({ event: 'session_end', durationSeconds: duration });
    sessionStartTime = null;
    sendResponse({ success: true });
  }
  return true;
});
```

---

## 1.4 Verification Checklist

- [ ] Extension loads in Chrome without errors
- [ ] Popup shows Idle / Focus Active states correctly
- [ ] Tab changes send events to `http://localhost:8000/event`
- [ ] Dwell time increases correctly on the same domain
- [ ] `navigation_type` is `search_referrer` when arriving from Google
- [ ] `navigation_type` is `direct_type` when typing URL directly
- [ ] Block overlay appears on `block_tab` response
- [ ] Intent dialog appears on `ask` response with yes/no buttons
- [ ] "Yes it's work" dismisses dialog and calls `/intent_response`
- [ ] "No, distraction" triggers block overlay
- [ ] `show_nudge` fires macOS notification (not overlay)
- [ ] `monitor` action does nothing visible (silent)
- [ ] Start/Stop session correctly flips `focusActive` in storage
