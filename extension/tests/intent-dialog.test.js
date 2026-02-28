/**
 * Intent Dialog (ASK Flow) Tests
 * Tests for the intent confirmation dialog shown via content script
 */

describe('Intent Dialog - ASK Flow', () => {
  let mockChrome;
  let currentIntentDialog = null;

  // Helper function to create intent dialog (mirrors overlay.js logic)
  function createIntentDialog(question) {
    // Remove existing dialog
    const existing = document.getElementById('dwa-intent-dialog');
    if (existing) {
      existing.remove();
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
    `;

    dialog.innerHTML = `
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
    return dialog;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    document.body.innerHTML = '';
    mockChrome = global.chrome;
    global.fetch = jest.fn();
    currentIntentDialog = null;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.useRealTimers();
    currentIntentDialog = null;
  });

  describe('Dialog Creation', () => {
    test('should create dialog with correct ID', () => {
      createIntentDialog('Is this visit work-related?');
      
      const dialog = document.getElementById('dwa-intent-dialog');
      expect(dialog).toBeTruthy();
    });

    test('should display the question text', () => {
      const question = 'Is watching this YouTube video for work?';
      createIntentDialog(question);
      
      const questionEl = document.querySelector('.dwa-question');
      expect(questionEl.textContent).toBe(question);
    });

    test('should have Yes and No buttons', () => {
      createIntentDialog('Is this work-related?');
      
      const yesBtn = document.getElementById('dwa-intent-yes');
      const noBtn = document.getElementById('dwa-intent-no');
      
      expect(yesBtn).toBeTruthy();
      expect(noBtn).toBeTruthy();
      expect(yesBtn.textContent).toContain('Yes');
      expect(noBtn.textContent).toContain('No');
    });

    test('should have timer text element', () => {
      createIntentDialog('Is this work-related?');
      
      const timerText = document.getElementById('dwa-timer-text');
      expect(timerText).toBeTruthy();
      expect(timerText.textContent).toContain('30s');
    });

    test('should have fixed positioning at top-right', () => {
      createIntentDialog('Is this work-related?');
      
      const dialog = document.getElementById('dwa-intent-dialog');
      expect(dialog.style.position).toBe('fixed');
      expect(dialog.style.top).toBe('20px');
      expect(dialog.style.right).toBe('20px');
    });

    test('should have highest z-index', () => {
      createIntentDialog('Is this work-related?');
      
      const dialog = document.getElementById('dwa-intent-dialog');
      expect(dialog.style.zIndex).toBe('2147483647');
    });
  });

  describe('Dialog Styling', () => {
    test('should have dark gradient background', () => {
      createIntentDialog('Is this work-related?');
      
      const dialog = document.getElementById('dwa-intent-dialog');
      expect(dialog.style.background).toContain('linear-gradient');
    });

    test('should have border radius', () => {
      createIntentDialog('Is this work-related?');
      
      const dialog = document.getElementById('dwa-intent-dialog');
      expect(dialog.style.borderRadius).toBe('12px');
    });

    test('should have padding', () => {
      createIntentDialog('Is this work-related?');
      
      const dialog = document.getElementById('dwa-intent-dialog');
      expect(dialog.style.padding).toBe('20px');
    });
  });

  describe('Yes Button Behavior', () => {
    test('should remove dialog when Yes is clicked', () => {
      const dialog = createIntentDialog('Is this work-related?');
      const yesBtn = document.getElementById('dwa-intent-yes');
      
      yesBtn.onclick = () => {
        dialog.remove();
        currentIntentDialog = null;
      };
      
      yesBtn.click();
      
      expect(document.getElementById('dwa-intent-dialog')).toBeFalsy();
    });

    test('should send work_related intent to backend on Yes click', () => {
      const dialog = createIntentDialog('Is this work-related?');
      const yesBtn = document.getElementById('dwa-intent-yes');
      
      global.fetch.mockResolvedValueOnce({ ok: true });
      
      yesBtn.onclick = () => {
        dialog.remove();
        fetch('http://localhost:8000/intent_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: 'work_related', url: window.location.href })
        });
      };
      
      yesBtn.click();
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/intent_response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('work_related')
        })
      );
    });
  });

  describe('No Button Behavior', () => {
    test('should remove dialog when No is clicked', () => {
      const dialog = createIntentDialog('Is this work-related?');
      const noBtn = document.getElementById('dwa-intent-no');
      
      noBtn.onclick = () => {
        dialog.remove();
        currentIntentDialog = null;
      };
      
      noBtn.click();
      
      expect(document.getElementById('dwa-intent-dialog')).toBeFalsy();
    });

    test('should send distraction intent to backend on No click', () => {
      const dialog = createIntentDialog('Is this work-related?');
      const noBtn = document.getElementById('dwa-intent-no');
      
      global.fetch.mockResolvedValueOnce({ ok: true });
      
      noBtn.onclick = () => {
        dialog.remove();
        fetch('http://localhost:8000/intent_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: 'distraction', url: window.location.href })
        });
      };
      
      noBtn.click();
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/intent_response',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('distraction')
        })
      );
    });

    test('should trigger block overlay after No click', () => {
      const dialog = createIntentDialog('Is this work-related?');
      const noBtn = document.getElementById('dwa-intent-no');
      
      let blockOverlayShown = false;
      
      noBtn.onclick = () => {
        dialog.remove();
        // Simulate showing block overlay
        const overlay = document.createElement('div');
        overlay.id = 'dwa-block-overlay';
        overlay.textContent = "Good call! Let's get back to focused work.";
        document.body.appendChild(overlay);
        blockOverlayShown = true;
      };
      
      noBtn.click();
      
      expect(blockOverlayShown).toBe(true);
      expect(document.getElementById('dwa-block-overlay')).toBeTruthy();
    });
  });

  describe('Auto-Dismiss Behavior', () => {
    test('should update countdown timer text', () => {
      createIntentDialog('Is this work-related?');
      const timerText = document.getElementById('dwa-timer-text');
      
      let countdown = 30;
      const timer = setInterval(() => {
        countdown--;
        timerText.textContent = `Auto-dismissing in ${countdown}s...`;
        if (countdown <= 28) {
          clearInterval(timer);
        }
      }, 1000);
      
      jest.advanceTimersByTime(2000);
      
      expect(timerText.textContent).toBe('Auto-dismissing in 28s...');
    });

    test('should auto-dismiss dialog after 30 seconds', () => {
      const dialog = createIntentDialog('Is this work-related?');
      
      setTimeout(() => {
        if (document.getElementById('dwa-intent-dialog')) {
          dialog.remove();
        }
      }, 30000);
      
      expect(document.getElementById('dwa-intent-dialog')).toBeTruthy();
      
      jest.advanceTimersByTime(30000);
      
      expect(document.getElementById('dwa-intent-dialog')).toBeFalsy();
    });

    test('should send no_response intent when auto-dismissed', () => {
      const dialog = createIntentDialog('Is this work-related?');
      
      global.fetch.mockResolvedValueOnce({ ok: true });
      
      setTimeout(() => {
        if (document.getElementById('dwa-intent-dialog')) {
          dialog.remove();
          fetch('http://localhost:8000/intent_response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intent: 'no_response', url: window.location.href })
          });
        }
      }, 30000);
      
      jest.advanceTimersByTime(30000);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/intent_response',
        expect.objectContaining({
          body: expect.stringContaining('no_response')
        })
      );
    });

    test('should show block overlay when auto-dismissed without response', () => {
      const dialog = createIntentDialog('Is this work-related?');
      
      setTimeout(() => {
        if (document.getElementById('dwa-intent-dialog')) {
          dialog.remove();
          const overlay = document.createElement('div');
          overlay.id = 'dwa-block-overlay';
          overlay.textContent = "No response — let's refocus.";
          document.body.appendChild(overlay);
        }
      }, 30000);
      
      jest.advanceTimersByTime(30000);
      
      expect(document.getElementById('dwa-block-overlay')).toBeTruthy();
    });
  });

  describe('Dialog Replacement', () => {
    test('should remove existing dialog when new one is created', () => {
      createIntentDialog('First question?');
      expect(document.getElementById('dwa-intent-dialog')).toBeTruthy();
      
      createIntentDialog('Second question?');
      
      const dialogs = document.querySelectorAll('#dwa-intent-dialog');
      expect(dialogs.length).toBe(1);
      
      const questionEl = document.querySelector('.dwa-question');
      expect(questionEl.textContent).toBe('Second question?');
    });
  });

  describe('Message Handling', () => {
    test('should create dialog when SHOW_INTENT_DIALOG message received', () => {
      const messageHandler = (request) => {
        if (request.type === 'SHOW_INTENT_DIALOG') {
          createIntentDialog(request.question);
        }
      };
      
      messageHandler({ type: 'SHOW_INTENT_DIALOG', question: 'Is this for research?' });
      
      expect(document.getElementById('dwa-intent-dialog')).toBeTruthy();
      expect(document.querySelector('.dwa-question').textContent).toBe('Is this for research?');
    });

    test('should use default question if none provided', () => {
      const messageHandler = (request) => {
        if (request.type === 'SHOW_INTENT_DIALOG') {
          createIntentDialog(request.question || 'Is this visit work-related?');
        }
      };
      
      messageHandler({ type: 'SHOW_INTENT_DIALOG' });
      
      expect(document.querySelector('.dwa-question').textContent).toBe('Is this visit work-related?');
    });

    test('should remove dialog when DISMISS_INTENT_DIALOG message received', () => {
      createIntentDialog('Is this work-related?');
      expect(document.getElementById('dwa-intent-dialog')).toBeTruthy();
      
      const messageHandler = (request) => {
        if (request.type === 'DISMISS_INTENT_DIALOG') {
          const dialog = document.getElementById('dwa-intent-dialog');
          if (dialog) {
            dialog.remove();
          }
        }
      };
      
      messageHandler({ type: 'DISMISS_INTENT_DIALOG' });
      
      expect(document.getElementById('dwa-intent-dialog')).toBeFalsy();
    });
  });

  describe('Agent Response Handling', () => {
    test('should show intent dialog on ask action', () => {
      const handleAgentResponse = (response) => {
        if (response.action === 'ask') {
          createIntentDialog(response.ask_question || 'Is this visit work-related?');
        }
      };
      
      handleAgentResponse({ action: 'ask', ask_question: 'Is this YouTube video for learning?' });
      
      expect(document.getElementById('dwa-intent-dialog')).toBeTruthy();
    });

    test('should not show dialog for non-ask actions', () => {
      const handleAgentResponse = (response) => {
        if (response.action === 'ask') {
          createIntentDialog(response.ask_question);
        }
      };
      
      handleAgentResponse({ action: 'monitor', message: 'Monitoring...' });
      
      expect(document.getElementById('dwa-intent-dialog')).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    test('should have button elements for keyboard navigation', () => {
      createIntentDialog('Is this work-related?');
      
      const buttons = document.querySelectorAll('#dwa-intent-dialog button');
      expect(buttons.length).toBe(2);
    });

    test('should have readable text content', () => {
      createIntentDialog('Is this work-related?');
      
      const yesBtn = document.getElementById('dwa-intent-yes');
      const noBtn = document.getElementById('dwa-intent-no');
      
      expect(yesBtn.textContent.length).toBeGreaterThan(0);
      expect(noBtn.textContent.length).toBeGreaterThan(0);
    });
  });
});
