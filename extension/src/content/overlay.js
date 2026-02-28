// Deep Work Agent - Content Script (Overlay & Nudge UI)
// Runs on all web pages to handle overlay injection and user interactions

// Track currently displayed overlay/nudge
let currentOverlay = null;
let currentNudge = null;

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AGENT_RESPONSE') {
    handleAgentResponse(request.payload);
    sendResponse({ received: true });
  }
});

// Handle different agent responses
function handleAgentResponse(response) {
  const { action, message, duration = 5000 } = response;
  
  if (action === 'nudge') {
    showNudge(message, duration);
  } else if (action === 'block') {
    showBlock(message);
  } else if (action === 'log') {
    console.log('[Deep Work Agent]', message);
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

console.log('Deep Work Agent - Content script loaded');
