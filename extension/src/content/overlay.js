// Deep Work Agent - Content Script (Overlay & Nudge UI)
// Runs on all web pages to handle overlay injection and user interactions

// Track currently displayed overlay/nudge/dialog
let currentOverlay = null;
let currentNudge = null;
let currentIntentDialog = null;

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AGENT_RESPONSE') {
    handleAgentResponse(request.payload);
    sendResponse({ received: true });
  }
  if (request.type === 'SHOW_INTENT_DIALOG') {
    showIntentDialog(request.question || 'Is this visit work-related?');
    sendResponse({ received: true });
  }
  if (request.type === 'DISMISS_INTENT_DIALOG') {
    if (currentIntentDialog) {
      currentIntentDialog.remove();
      currentIntentDialog = null;
    }
    sendResponse({ received: true });
  }
});

// Handle different agent responses
function handleAgentResponse(response) {
  const { action, message, duration = 5000, ask_question } = response;
  
  if (action === 'nudge' || action === 'show_nudge') {
    showNudge(message, duration);
  } else if (action === 'block' || action === 'block_tab') {
    showBlock(message);
  } else if (action === 'ask') {
    showIntentDialog(ask_question || 'Is this visit work-related?');
  } else if (action === 'log') {
    console.log('[Deep Work Agent]', message);
  } else if (action === 'monitor' || action === 'none') {
    // Silent monitoring - no UI action needed
    console.log('[Deep Work Agent] Monitoring:', message);
  }
}

// Show toast notification (nudge - non-blocking)
function showNudge(message, duration = 5000) {
  // Remove existing nudge
  if (currentNudge) {
    currentNudge.remove();
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'dwa-nudge';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    animation: slideIn 0.3s ease-out;
    max-width: 350px;
    word-wrap: break-word;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    margin-left: auto;
    flex-shrink: 0;
  `;
  closeBtn.onclick = () => toast.remove();
  
  // Add content
  const content = document.createElement('span');
  content.textContent = message;
  
  toast.appendChild(content);
  toast.appendChild(closeBtn);
  
  // Add to page
  document.body.appendChild(toast);
  currentNudge = toast;
  
  // Inject styles for animation
  if (!document.getElementById('dwa-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'dwa-toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Auto-dismiss after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// Show blocking overlay
function showBlock(message) {
  // Remove existing overlay
  if (currentOverlay) {
    currentOverlay.remove();
  }
  
  // Create overlay background
  const overlay = document.createElement('div');
  overlay.id = 'dwa-block-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    animation: fadeIn 0.3s ease-out;
  `;
  
  // Create content card
  const card = document.createElement('div');
  card.style.cssText = `
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 450px;
    text-align: center;
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  
  // Title
  const title = document.createElement('h2');
  title.textContent = '⏸ Focus Time Active';
  title.style.cssText = `
    margin: 0 0 16px 0;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 24px;
    font-weight: 600;
  `;
  
  // Message
  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  messageEl.style.cssText = `
    margin: 0 0 28px 0;
    color: #666;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.6;
  `;
  
  // Dismiss button
  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'I understand, dismiss';
  dismissBtn.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 28px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: transform 0.2s, box-shadow 0.2s;
  `;
  
  dismissBtn.onmouseover = () => {
    dismissBtn.style.transform = 'translateY(-2px)';
    dismissBtn.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
  };
  dismissBtn.onmouseout = () => {
    dismissBtn.style.transform = 'translateY(0)';
    dismissBtn.style.boxShadow = 'none';
  };
  
  dismissBtn.onclick = () => {
    overlay.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => overlay.remove(), 300);
    currentOverlay = null;
  };
  
  // Assemble card
  card.appendChild(title);
  card.appendChild(messageEl);
  card.appendChild(dismissBtn);
  
  // Assemble overlay
  overlay.appendChild(card);
  
  // Inject styles for animation
  if (!document.getElementById('dwa-overlay-styles')) {
    const style = document.createElement('style');
    style.id = 'dwa-overlay-styles';
    style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      @keyframes popIn {
        from {
          transform: scale(0.8);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add to page
  document.body.appendChild(overlay);
  currentOverlay = overlay;
  
  // Prevent scrolling while overlay is shown
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) return; // Don't dismiss on background click
  });
}

// ─── Intent Dialog (ASK action) ───────────────────────────────────────
// Shows a dialog asking user if their visit is work-related
function showIntentDialog(question) {
  // Remove existing dialog
  if (currentIntentDialog) {
    currentIntentDialog.remove();
  }

  const dialog = document.createElement('div');
  dialog.id = 'dwa-intent-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
    padding: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 40px rgba(34, 197, 94, 0.1);
    animation: dwaSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  dialog.innerHTML = `
    <style>
      @keyframes dwaSlideIn {
        from { transform: translateX(20px) scale(0.95); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes dwaPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      #dwa-intent-dialog .dwa-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      #dwa-intent-dialog .dwa-icon {
        font-size: 20px;
        animation: dwaPulse 2s ease-in-out infinite;
      }
      #dwa-intent-dialog .dwa-label {
        font-size: 11px;
        color: #22c55e;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 600;
      }
      #dwa-intent-dialog .dwa-question {
        font-size: 14px;
        color: #e0e0e0;
        line-height: 1.5;
        margin-bottom: 16px;
      }
      #dwa-intent-dialog .dwa-buttons {
        display: flex;
        gap: 10px;
      }
      #dwa-intent-dialog .dwa-btn {
        flex: 1;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      #dwa-intent-dialog .dwa-btn-yes {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        color: #000;
      }
      #dwa-intent-dialog .dwa-btn-yes:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
      }
      #dwa-intent-dialog .dwa-btn-no {
        background: transparent;
        border: 1px solid #444;
        color: #888;
      }
      #dwa-intent-dialog .dwa-btn-no:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: #666;
        color: #aaa;
      }
      #dwa-intent-dialog .dwa-timer {
        font-size: 10px;
        color: #555;
        text-align: center;
        margin-top: 12px;
      }
    </style>
    <div class="dwa-header">
      <span class="dwa-icon">🎯</span>
      <span class="dwa-label">Quick check</span>
    </div>
    <p class="dwa-question">${question}</p>
    <div class="dwa-buttons">
      <button class="dwa-btn dwa-btn-yes" id="dwa-intent-yes">✅ Yes, it's work</button>
      <button class="dwa-btn dwa-btn-no" id="dwa-intent-no">❌ No, distraction</button>
    </div>
    <p class="dwa-timer" id="dwa-timer-text">Auto-dismissing in 30s...</p>
  `;

  document.body.appendChild(dialog);
  currentIntentDialog = dialog;

  // Handle "Yes" button - user confirms work intent
  document.getElementById('dwa-intent-yes').onclick = () => {
    dialog.remove();
    currentIntentDialog = null;
    // Notify backend that user confirmed work intent
    fetch('http://localhost:8000/intent_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'work_related', url: window.location.href })
    }).catch((err) => console.error('[DeepWork] Intent response error:', err));
    // Show brief confirmation
    showNudge('✅ Got it! Continue working.', 2000);
  };

  // Handle "No" button - user admits distraction
  document.getElementById('dwa-intent-no').onclick = () => {
    dialog.remove();
    currentIntentDialog = null;
    // Notify backend that user admitted distraction
    fetch('http://localhost:8000/intent_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'distraction', url: window.location.href })
    }).catch((err) => console.error('[DeepWork] Intent response error:', err));
    // Show block overlay
    showBlock("Good call! Let's get back to focused work.");
  };

  // Auto-dismiss after 30s with countdown
  let countdown = 30;
  const timerText = document.getElementById('dwa-timer-text');
  const timer = setInterval(() => {
    countdown--;
    if (timerText) {
      timerText.textContent = `Auto-dismissing in ${countdown}s...`;
    }
    if (countdown <= 0) {
      clearInterval(timer);
      if (currentIntentDialog) {
        dialog.remove();
        currentIntentDialog = null;
        // No response = treat as distraction
        fetch('http://localhost:8000/intent_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: 'no_response', url: window.location.href })
        }).catch(() => {});
        showBlock("No response — let's refocus.");
      }
    }
  }, 1000);
}

console.log('Deep Work Agent - Content script loaded');
