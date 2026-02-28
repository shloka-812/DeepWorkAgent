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
      
      // Send message to content script on this tab
      chrome.tabs.sendMessage(tabId, {
        type: 'AGENT_RESPONSE',
        payload: data
      }).catch(() => {
        // Content script might not be loaded yet, which is fine
      });
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

// Message listener for popup and content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_SESSION') {
    sessionActive = true;
    chrome.storage.local.set({ sessionActive: true });
    tabStartTime = {}; // Reset dwell timers
    tabDwellTime = {};
    sendResponse({ success: true, message: 'Session started' });
  } 
  else if (request.type === 'STOP_SESSION') {
    sessionActive = false;
    chrome.storage.local.set({ sessionActive: false });
    sendResponse({ success: true, message: 'Session stopped' });
  }
  else if (request.type === 'GET_SESSION_STATUS') {
    sendResponse({ sessionActive: sessionActive });
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
