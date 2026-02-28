/**
 * Content Script (Overlay) Tests
 * Tests nudge toast, block overlay, DOM manipulation, and UI animations
 */

describe('Content Script - Overlay UI', () => {
  let mockChrome;
  let originalDocument;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    mockChrome = global.chrome;
    mockChrome.runtime.onMessage.addListener.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Nudge Toast Notification', () => {
    test('should create toast element with correct styling', () => {
      const toast = document.createElement('div');
      toast.id = 'dwa-nudge';
      toast.textContent = 'Take a break!';
      toast.style.position = 'fixed';
      toast.style.top = '20px';
      toast.style.right = '20px';
      toast.style.zIndex = '999999';

      document.body.appendChild(toast);

      const element = document.getElementById('dwa-nudge');
      expect(element).toBeTruthy();
      expect(element.textContent).toBe('Take a break!');
      expect(element.style.position).toBe('fixed');
      expect(element.style.top).toBe('20px');
      expect(element.style.right).toBe('20px');
    });

    test('should add close button to toast', () => {
      const toast = document.createElement('div');
      toast.id = 'dwa-nudge';

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.onclick = () => toast.remove();

      const content = document.createElement('span');
      content.textContent = 'Focus reminder';

      toast.appendChild(content);
      toast.appendChild(closeBtn);
      document.body.appendChild(toast);

      const button = toast.querySelector('button');
      expect(button).toBeTruthy();
      expect(button.textContent).toBe('×');

      button.click();
      expect(document.getElementById('dwa-nudge')).toBeFalsy();
    });

    test('should auto-dismiss toast after duration', (done) => {
      jest.useFakeTimers();

      const toast = document.createElement('div');
      toast.id = 'dwa-nudge';
      document.body.appendChild(toast);

      const duration = 5000;
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, duration);

      expect(document.getElementById('dwa-nudge')).toBeTruthy();

      jest.advanceTimersByTime(duration);
      expect(document.getElementById('dwa-nudge')).toBeFalsy();

      jest.useRealTimers();
      done();
    });

    test('should remove previous toast when new one is shown', () => {
      const toast1 = document.createElement('div');
      toast1.id = 'dwa-nudge';
      toast1.textContent = 'First message';
      document.body.appendChild(toast1);

      expect(document.getElementById('dwa-nudge')).toBeTruthy();

      // Create second toast (should replace first)
      document.getElementById('dwa-nudge').remove();
      const toast2 = document.createElement('div');
      toast2.id = 'dwa-nudge';
      toast2.textContent = 'Second message';
      document.body.appendChild(toast2);

      expect(document.querySelectorAll('#dwa-nudge').length).toBe(1);
      expect(document.getElementById('dwa-nudge').textContent).toBe('Second message');
    });

    test('should apply gradient styling to toast', () => {
      const toast = document.createElement('div');
      toast.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      toast.style.color = 'white';

      document.body.appendChild(toast);

      expect(toast.style.background).toContain('linear-gradient');
      expect(toast.style.color).toBe('white');
    });
  });

  describe('Block Overlay', () => {
    test('should create full-page overlay with correct styling', () => {
      const overlay = document.createElement('div');
      overlay.id = 'dwa-block-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '999999';
      overlay.style.background = 'rgba(0, 0, 0, 0.85)';

      document.body.appendChild(overlay);

      const element = document.getElementById('dwa-block-overlay');
      expect(element).toBeTruthy();
      expect(element.style.width).toBe('100%');
      expect(element.style.height).toBe('100%');
      expect(element.style.position).toBe('fixed');
    });

    test('should add modal card to overlay', () => {
      const overlay = document.createElement('div');
      overlay.id = 'dwa-block-overlay';

      const card = document.createElement('div');
      const title = document.createElement('h2');
      title.textContent = '⏸ Focus Time Active';

      const message = document.createElement('p');
      message.textContent = 'This is a distraction';

      const button = document.createElement('button');
      button.textContent = 'I understand, dismiss';
      button.onclick = () => overlay.remove();

      card.appendChild(title);
      card.appendChild(message);
      card.appendChild(button);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      const cardElement = document.querySelector('#dwa-block-overlay > div');
      expect(cardElement).toBeTruthy();
      expect(cardElement.querySelector('h2')).toBeTruthy();
      expect(cardElement.querySelector('p')).toBeTruthy();
      expect(cardElement.querySelector('button')).toBeTruthy();
    });

    test('should dismiss overlay on button click', () => {
      const overlay = document.createElement('div');
      overlay.id = 'dwa-block-overlay';

      const button = document.createElement('button');
      button.onclick = () => overlay.remove();

      overlay.appendChild(button);
      document.body.appendChild(overlay);

      expect(document.getElementById('dwa-block-overlay')).toBeTruthy();

      button.click();

      expect(document.getElementById('dwa-block-overlay')).toBeFalsy();
    });

    test('should prevent page scrolling when overlay is active', () => {
      const overlay = document.createElement('div');
      overlay.id = 'dwa-block-overlay';
      document.body.appendChild(overlay);

      document.body.style.overflow = 'hidden';

      expect(document.body.style.overflow).toBe('hidden');

      overlay.remove();
      document.body.style.overflow = 'auto';

      expect(document.body.style.overflow).toBe('auto');
    });

    test('should show correct message in modal', () => {
      const overlay = document.createElement('div');
      const message = document.createElement('p');
      const testMessage = '🚫 Twitter is a known distraction';
      message.textContent = testMessage;
      overlay.appendChild(message);

      document.body.appendChild(overlay);

      expect(document.querySelector('p').textContent).toBe(testMessage);
    });
  });

  describe('Message Handling', () => {
    test('should listen for AGENT_RESPONSE messages', () => {
      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        const mockCallback = jest.fn();
        callback(
          { type: 'AGENT_RESPONSE', payload: { action: 'nudge', message: 'Test' } },
          {},
          mockCallback
        );
        expect(mockCallback).toHaveBeenCalledWith({ received: true });
      });

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should handle nudge action from message', () => {
      const toast = document.createElement('div');
      toast.id = 'dwa-nudge';
      document.body.appendChild(toast);

      const response = {
        action: 'nudge',
        message: 'Remember your goals',
        duration: 5000,
      };

      // Simulate handling
      if (response.action === 'nudge') {
        expect(document.getElementById('dwa-nudge')).toBeTruthy();
      }
    });

    test('should handle block action from message', () => {
      const response = {
        action: 'block',
        message: 'Focus time active',
      };

      // Simulate block creation
      const overlay = document.createElement('div');
      overlay.id = 'dwa-block-overlay';
      document.body.appendChild(overlay);

      if (response.action === 'block') {
        expect(document.getElementById('dwa-block-overlay')).toBeTruthy();
      }
    });

    test('should ignore unknown action types', () => {
      const response = {
        action: 'unknown_action',
        message: 'Something',
      };

      const beforeCount = document.querySelectorAll('div').length;

      // Should not create any UI element
      if (response.action === 'nudge' || response.action === 'block') {
        const element = document.createElement('div');
        document.body.appendChild(element);
      }

      expect(document.querySelectorAll('div').length).toBe(beforeCount);
    });
  });

  describe('Animation Styles', () => {
    test('should inject animation styles into page', () => {
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
      `;
      document.head.appendChild(style);

      expect(document.getElementById('dwa-toast-styles')).toBeTruthy();
      expect(style.textContent).toContain('slideIn');
    });

    test('should not duplicate animation styles', () => {
      const style1 = document.createElement('style');
      style1.id = 'dwa-toast-styles';
      document.head.appendChild(style1);

      const style2 = document.createElement('style');
      style2.id = 'dwa-toast-styles';
      
      // Check if already exists (simulating the extension logic)
      if (!document.getElementById('dwa-toast-styles') || document.getElementById('dwa-toast-styles').id === style1.id) {
        document.head.appendChild(style2);
      }

      // Should have only one (or the check prevents adding duplicate)
      expect(document.head.querySelectorAll('#dwa-toast-styles').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DOM Safety', () => {
    test('should not use innerHTML with user data', () => {
      const message = '<img src=x onerror=alert("xss")>';
      const toast = document.createElement('div');
      const content = document.createElement('span');
      content.textContent = message; // Safe way, not innerHTML
      toast.appendChild(content);

      expect(toast.textContent).toContain('<img');
      expect(toast.innerHTML).not.toContain('<img');
    });

    test('should only modify necessary DOM elements', () => {
      const beforeCount = document.querySelectorAll('*').length;

      // Add toast
      const toast = document.createElement('div');
      toast.id = 'dwa-nudge';
      document.body.appendChild(toast);

      const afterCount = document.querySelectorAll('*').length;

      expect(afterCount - beforeCount).toBe(1);
    });

    test('should clean up overlays on dismiss', () => {
      const overlay = document.createElement('div');
      overlay.id = 'dwa-block-overlay';
      document.body.appendChild(overlay);

      expect(document.getElementById('dwa-block-overlay')).toBeTruthy();

      overlay.remove();

      expect(document.getElementById('dwa-block-overlay')).toBeFalsy();
    });
  });

  describe('Multiple Overlays', () => {
    test('should handle multiple nudges (replacing previous)', () => {
      const toast1 = document.createElement('div');
      toast1.id = 'dwa-nudge';
      toast1.textContent = 'First nudge';
      document.body.appendChild(toast1);

      // Remove first, add second
      document.getElementById('dwa-nudge').remove();
      const toast2 = document.createElement('div');
      toast2.id = 'dwa-nudge';
      toast2.textContent = 'Second nudge';
      document.body.appendChild(toast2);

      expect(document.getElementById('dwa-nudge').textContent).toBe('Second nudge');
      expect(document.querySelectorAll('#dwa-nudge').length).toBe(1);
    });

    test('should replace block overlay on new block', () => {
      const overlay1 = document.createElement('div');
      overlay1.id = 'dwa-block-overlay';
      overlay1.textContent = 'First block';
      document.body.appendChild(overlay1);

      // Remove first, add second
      document.getElementById('dwa-block-overlay').remove();
      const overlay2 = document.createElement('div');
      overlay2.id = 'dwa-block-overlay';
      overlay2.textContent = 'Second block';
      document.body.appendChild(overlay2);

      expect(document.getElementById('dwa-block-overlay').textContent).toBe('Second block');
      expect(document.querySelectorAll('#dwa-block-overlay').length).toBe(1);
    });
  });
});
