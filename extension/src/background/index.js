// Deep Work Agent - Background Service Worker
// Monitors tab changes and communicates with backend + content scripts

let sessionActive = false;
let tabHistory = {};
let tabDwellTime = {};
let tabStartTime = {};

// Initialize session state from storage
chrome.storage.local.get(['sessionActive'], (result) => {
  sessionActive = result.sessionActive || false;
});

// Listen for tab updates (navigation, title change, loading state)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!sessionActive) return;
  
  // Only fire on complete status to avoid duplicate events
  if (changeInfo.status === 'complete') {
    trackTabEvent(tabId, tab, 'tab_change');
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!sessionActive) return;
  
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    trackTabEvent(tab.id, tab, 'tab_activate');
  });
});

// Main event tracking function
function trackTabEvent(tabId, tab, navigationType) {
  const url = tab.url || '';
  const title = tab.title || '';
  const domain = extractDomain(url);
  
  // Calculate dwell time on previous tab before switching
  let dwellSeconds = 0;
  if (tabStartTime[tabId]) {
    dwellSeconds = Math.floor((Date.now() - tabStartTime[tabId]) / 1000);
  }
  tabStartTime[tabId] = Date.now();
  
  // Track dwell time
  if (!tabDwellTime[tabId]) {
    tabDwellTime[tabId] = 0;
  }
  tabDwellTime[tabId] += dwellSeconds;
  
  // Get tab history for this tab
  if (!tabHistory[tabId]) {
    tabHistory[tabId] = [];
  }
  tabHistory[tabId].push({
    url: url,
    title: title,
    timestamp: Date.now()
  });
  // Keep only last 10 entries
  if (tabHistory[tabId].length > 10) {
    tabHistory[tabId].shift();
  }
  
  // Build event payload matching Person B's schema
  const eventPayload = {
    event: 'tab_change',
    url: url,
    title: title,
    domain: domain,
    isDistraction: null, // Backend will determine this
    is_work: null, // Backend will determine this
    dwell_seconds: dwellSeconds,
    referrer: tab.url ? new URL(tab.url).referrer : '',
    navigation_type: navigationType,
    sessionDurationSeconds: Math.floor(Date.now() / 1000), // Can be calculated on backend
    tabHistory: tabHistory[tabId].slice(-5), // Last 5 entries for context
    source: 'browser'
  };
  
  // Send event to backend (http://localhost:8000/event)
  sendToBackend(eventPayload, tabId);
}

// Send event to backend and handle response
function sendToBackend(eventPayload, tabId) {
  fetch('http://localhost:8000/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload)
  })
    .then(response => response.json())
    .then(data => {
      // Store response in chrome.storage for content script to access
      chrome.storage.local.set({
        [`response_${tabId}`]: {
          ...data,
          timestamp: Date.now()
        }
      });
      
      // Handle different action types from backend
      handleAgentResponse(data, tabId);
    })
    .catch(error => {
      console.error('Backend communication error:', error);
      // Fallback: store error state
      chrome.storage.local.set({
        [`response_${tabId}`]: {
          action: 'error',
          message: 'Backend unreachable',
          timestamp: Date.now()
        }
      });
    });
}

// Handle agent response and dispatch appropriate action
async function handleAgentResponse(response, tabId) {
  const { action, message, ask_question } = response;

  switch (action) {
    case 'block_tab':
    case 'block':
      // Send to content script to show full-page block overlay
      chrome.tabs.sendMessage(tabId, {
        type: 'AGENT_RESPONSE',
        payload: { action: 'block', message: message || "Stay focused!" }
      }).catch(() => {});
      incrementInterventionCount();
      break;

    case 'show_nudge':
    case 'nudge':
      // Send to content script to show toast nudge
      chrome.tabs.sendMessage(tabId, {
        type: 'AGENT_RESPONSE',
        payload: { action: 'nudge', message: message || "Time to refocus?" }
      }).catch(() => {});
      // Also show Chrome notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Deep Work Agent',
        message: message || "Heads up — you might be drifting.",
        priority: 2
      });
      incrementInterventionCount();
      break;

    case 'ask':
      // Send to content script to show intent dialog
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_INTENT_DIALOG',
        question: ask_question || 'Is this visit work-related?'
      }).catch(() => {});
      break;

    case 'monitor':
      // Silent monitoring — log only, no UI
      console.log('[DeepWork] Monitoring - escalation scheduled by backend');
      break;

    case 'none':
    case 'allow':
    default:
      // No action needed
      console.log('[DeepWork] Allowed:', message);
      break;
  }
}

// Increment intervention count in storage
async function incrementInterventionCount() {
  const result = await chrome.storage.local.get(['interventionCount']);
  const count = (result.interventionCount || 0) + 1;
  await chrome.storage.local.set({ interventionCount: count });
}

// Message listener for popup and content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_SESSION') {
    sessionActive = true;
    chrome.storage.local.set({ 
      sessionActive: true,
      sessionStartTime: Date.now(),
      interventionCount: 0
    });
    tabStartTime = {}; // Reset dwell timers
    tabDwellTime = {};
    // Notify backend of session start
    fetch('http://localhost:8000/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'session_start', timestamp: Date.now() })
    }).catch(() => {});
    sendResponse({ success: true, message: 'Session started' });
  } 
  else if (request.type === 'STOP_SESSION') {
    sessionActive = false;
    chrome.storage.local.get(['sessionStartTime'], (result) => {
      const duration = result.sessionStartTime 
        ? Math.floor((Date.now() - result.sessionStartTime) / 1000) 
        : 0;
      chrome.storage.local.set({ sessionActive: false });
      // Notify backend of session end
      fetch('http://localhost:8000/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'session_end', durationSeconds: duration })
      }).catch(() => {});
    });
    sendResponse({ success: true, message: 'Session stopped' });
  }
  else if (request.type === 'GET_SESSION_STATUS') {
    sendResponse({ sessionActive: sessionActive });
  }
  else if (request.type === 'GET_SESSION_STATS') {
    // Return full session stats for popup
    chrome.storage.local.get(['sessionActive', 'sessionStartTime', 'interventionCount'], (result) => {
      const durationSeconds = result.sessionStartTime && result.sessionActive
        ? Math.floor((Date.now() - result.sessionStartTime) / 1000)
        : 0;
      sendResponse({
        sessionActive: result.sessionActive || false,
        sessionStartTime: result.sessionStartTime || null,
        durationSeconds: durationSeconds,
        interventionCount: result.interventionCount || 0
      });
    });
    return true; // Indicate async response
  }
  else if (request.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        sendResponse({
          tabId: tabs[0].id,
          url: tabs[0].url,
          title: tabs[0].title,
          sessionActive: sessionActive
        });
      }
    });
    return true; // Indicate async response
  }
});

// Utility: Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
}

console.log('Deep Work Agent - Background service worker loaded');
