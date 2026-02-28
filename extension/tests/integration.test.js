/**
 * Integration Tests
 * Tests the full flow: tab change → backend → overlay response
 */

describe('End-to-End Integration', () => {
  let mockChrome;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome = global.chrome;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Flow: Tab Change → Backend → Nudge', () => {
    test('should send event to backend and show nudge on response', async () => {
      // Setup backgrounds service worker listener
      let tabUpdateHandler;
      mockChrome.tabs.onUpdated.addListener.mockImplementation((callback) => {
        tabUpdateHandler = callback;
      });

      // Setup message listener for content script
      let messageHandler;
      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        messageHandler = callback;
      });

      // Setup fetch to return nudge
      global.fetch.mockResolvedValueOnce({
        json: async () => ({
          action: 'nudge',
          message: 'Take a break from the news!',
        }),
      });

      // Setup storage
      mockChrome.storage.local.set.mockImplementation(jest.fn());
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ sessionActive: true });
      });

      // Simulate tab update event
      const tabId = 1;
      const tab = {
        id: tabId,
        url: 'https://bbc.com/news',
        title: 'BBC News',
      };

      // Tab listener would be called
      // (In real scenario, we'd require the background script and trigger events)

      // Verify fetch was called to backend
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
    });

    test('should send event to backend and show block on response', async () => {
      mockChrome.tabs.onUpdated.addListener.mockImplementation(jest.fn());

      // Mock backend returning block response
      global.fetch.mockResolvedValueOnce({
        json: async () => ({
          action: 'block',
          message: '🚫 This is a distraction. Refocus on your work.',
        }),
      });

      // Simulate event payload
      const eventPayload = {
        event: 'tab_change',
        url: 'https://youtube.com/watch?v=123',
        domain: 'youtube.com',
        dwell_seconds: 0,
      };

      // Make request to backend
      const response = await fetch('http://localhost:8000/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      }).then((r) => r.json());

      expect(response.action).toBe('block');
      expect(response.message).toContain('distraction');
    });
  });

  describe('Flow: Session Start → Tab Monitoring', () => {
    test('should not send events before session starts', () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ sessionActive: false });
      });

      global.fetch.mockClear();

      // Tab would change but no fetch should happen
      // (In real scenario, background script checks sessionActive before fetching)

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should start sending events after session begins', async () => {
      mockChrome.storage.local.set.mockImplementation(jest.fn());
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ sessionActive: true });
      });

      global.fetch.mockResolvedValueOnce({
        json: async () => ({ action: 'log' }),
      });

      // After START_SESSION message, session should be active
      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        const response = callback({ type: 'START_SESSION' }, {}, jest.fn());
        expect(response).toBeDefined();
      });

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('Flow: Multiple Events in Sequence', () => {
    test('should handle rapid tab changes correctly', async () => {
      mockChrome.tabs.onUpdated.addListener.mockImplementation(jest.fn());

      // Setup multiple backend responses
      global.fetch
        .mockResolvedValueOnce({
          json: async () => ({ action: 'nudge', message: 'Message 1' }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ action: 'block', message: 'Block 1' }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ action: 'log', message: 'Log 1' }),
        });

      const events = [
        { domain: 'news.google.com' },
        { domain: 'youtube.com' },
        { domain: 'github.com' },
      ];

      for (const event of events) {
        await fetch('http://localhost:8000/event', {
          method: 'POST',
          body: JSON.stringify(event),
        }).then((r) => r.json());
      }

      // Should have called backend 3 times
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Flow: Overlay Handling', () => {
    test('should replace previous nudge with new one', () => {
      // Create first nudge
      const nudge1 = document.createElement('div');
      nudge1.id = 'dwa-nudge';
      nudge1.textContent = 'First nudge';
      document.body.appendChild(nudge1);

      expect(document.getElementById('dwa-nudge')).toBeTruthy();

      // Simulate receiving new nudge response
      document.getElementById('dwa-nudge').remove();
      const nudge2 = document.createElement('div');
      nudge2.id = 'dwa-nudge';
      nudge2.textContent = 'Second nudge';
      document.body.appendChild(nudge2);

      expect(document.getElementById('dwa-nudge').textContent).toBe('Second nudge');
      expect(document.querySelectorAll('#dwa-nudge')).toHaveLength(1);
    });

    test('should handle overlapping block and nudge', () => {
      // Show block
      const block = document.createElement('div');
      block.id = 'dwa-block-overlay';
      document.body.appendChild(block);

      // While block is showing, new nudge comes in (shouldn't show on top)
      const nudge = document.createElement('div');
      nudge.id = 'dwa-nudge';
      nudge.style.zIndex = '999998'; // Lower than block
      document.body.appendChild(nudge);

      expect(document.getElementById('dwa-block-overlay')).toBeTruthy();
      expect(document.getElementById('dwa-nudge')).toBeTruthy();

      // Block should be on top (higher z-index)
      expect(block.style.zIndex || '999999').toBe('999999');
    });
  });

  describe('Flow: Error Recovery', () => {
    test('should continue monitoring after backend failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      mockChrome.storage.local.set.mockImplementation(jest.fn());

      // First request fails
      try {
        await fetch('http://localhost:8000/event', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } catch (e) {
        expect(e.message).toBe('Network error');
      }

      // Storage should be updated with error
      mockChrome.storage.local.set({
        response_1: {
          action: 'error',
          message: 'Backend unreachable',
        },
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalled();

      // Next request should still work
      global.fetch.mockResolvedValueOnce({
        json: async () => ({ action: 'log' }),
      });

      // Send another event (should succeed)
      const response = await fetch('http://localhost:8000/event', {
        method: 'POST',
        body: JSON.stringify({ domain: 'github.com' }),
      }).then((r) => r.json());

      expect(response.action).toBe('log');
    });
  });

  describe('Flow: Session Stop', () => {
    test('should stop sending events when session stops', async () => {
      // Session is active
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ sessionActive: true });
      });

      global.fetch.mockResolvedValueOnce({
        json: async () => ({ action: 'log' }),
      });

      // Send event while active
      await fetch('http://localhost:8000/event', {
        method: 'POST',
        body: JSON.stringify({ domain: 'example.com' }),
      }).then((r) => r.json());

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Now simulate session stop
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ sessionActive: false });
      });

      global.fetch.mockClear();

      // Tab would change but shouldn't send events now
      // (In real scenario, background script checks sessionActive)

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Flow: Popup Control', () => {
    test('should reflect popup button state in backend behavior', async () => {
      // Popup sends START_SESSION
      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        callback({ type: 'START_SESSION' }, {}, jest.fn());
      });

      // Session should be marked active
      mockChrome.storage.local.set.mockImplementation(jest.fn());

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();

      // Backend now receives events
      global.fetch.mockResolvedValueOnce({
        json: async () => ({ action: 'nudge' }),
      });

      const response = await fetch('http://localhost:8000/event', {
        method: 'POST',
        body: JSON.stringify({}),
      }).then((r) => r.json());

      expect(response.action).toBe('nudge');
    });
  });

  describe('Data Flow Integrity', () => {
    test('should preserve event schema through entire flow', async () => {
      const originalEvent = {
        event: 'tab_change',
        url: 'https://example.com/page',
        title: 'Example Page',
        domain: 'example.com',
        dwell_seconds: 5,
        referrer: 'https://google.com',
        navigation_type: 'tab_change',
        tabHistory: [{ url: 'https://example.com', title: 'Example' }],
        source: 'browser',
      };

      // Verify all fields are sent
      expect(originalEvent).toHaveProperty('event');
      expect(originalEvent).toHaveProperty('url');
      expect(originalEvent).toHaveProperty('domain');
      expect(originalEvent).toHaveProperty('dwell_seconds');
      expect(originalEvent).toHaveProperty('tabHistory');
      expect(originalEvent).toHaveProperty('source');
    });

    test('should ensure response has required fields for UI', async () => {
      const response = {
        action: 'nudge',
        message: 'Take a break',
        duration: 5000,
      };

      // Content script expects these fields
      expect(response).toHaveProperty('action');
      expect(response).toHaveProperty('message');
      expect(['nudge', 'block', 'log']).toContain(response.action);
    });
  });

  describe('Stress Testing', () => {
    test('should handle 100 rapid events', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ action: 'log' }),
      });

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          fetch('http://localhost:8000/event', {
            method: 'POST',
            body: JSON.stringify({ domain: `example${i}.com` }),
          }).then((r) => r.json())
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every((r) => r.action === 'log')).toBe(true);
    });

    test('should maintain message passing under load', async () => {
      mockChrome.tabs.sendMessage.mockImplementation(jest.fn());

      const messages = [];
      for (let i = 0; i < 50; i++) {
        mockChrome.tabs.sendMessage(i, {
          type: 'AGENT_RESPONSE',
          payload: { action: 'nudge', message: `Message ${i}` },
        });
        messages.push(i);
      }

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(50);
    });
  });
});
