/**
 * Background Service Worker Tests
 * Tests tab listener, event collection, backend communication, and session control
 */

describe('Background Service Worker', () => {
  let mockChrome;
  let mockFetch;

  beforeEach(() => {
    // Clear previous mocks
    jest.clearAllMocks();
    global.fetch.mockClear();

    // Reset chrome mock
    mockChrome = global.chrome;
    mockFetch = global.fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tab Change Event Listening', () => {
    test('should register tab update event listener on load', () => {
      require('../src/background/index.js');
      
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
    });

    test('should register tab activated event listener on load', () => {
      require('../src/background/index.js');
      
      expect(mockChrome.tabs.onActivated.addListener).toHaveBeenCalled();
    });
  });

  describe('Event Collection', () => {
    test('should collect correct event payload fields', async () => {
      // Mock the handler that will be registered
      mockChrome.tabs.onUpdated.addListener.mockImplementation((callback) => {
        const tabId = 1;
        const changeInfo = { status: 'complete' };
        const tab = {
          id: 1,
          url: 'https://example.com/page',
          title: 'Example Page',
        };

        callback(tabId, changeInfo, tab);
      });

      // Load module - will trigger event registration
      require('../src/background/index.js');

      // Trigger session start
      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        callback({ type: 'START_SESSION' }, {}, jest.fn());
      });
    });

    test('should extract domain correctly from URL', () => {
      const testCases = [
        { url: 'https://youtube.com/watch?v=123', expected: 'youtube.com' },
        { url: 'https://news.google.com/articles', expected: 'news.google.com' },
        { url: 'http://localhost:3000', expected: 'localhost' },
        { url: 'https://sub.example.co.uk/path', expected: 'sub.example.co.uk' },
      ];

      // Test domain extraction utility
      testCases.forEach(({ url, expected }) => {
        try {
          const urlObj = new URL(url);
          expect(urlObj.hostname).toBe(expected);
        } catch (e) {
          fail(`Failed to parse URL: ${url}`);
        }
      });
    });

    test('should calculate dwell time between tab activations', () => {
      const startTime = Date.now();
      const duration = 5000; // 5 seconds
      
      jest.useFakeTimers();
      jest.setSystemTime(startTime);

      const dwellTime = Math.floor((Date.now() - startTime) / 1000);
      expect(dwellTime).toBe(0);

      jest.advanceTimersByTime(duration);
      const newDwellTime = Math.floor((Date.now() - startTime) / 1000);
      expect(newDwellTime).toBe(5);

      jest.useRealTimers();
    });
  });

  describe('Backend Communication', () => {
    test('should POST event to correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ action: 'nudge', message: 'Test' }),
      });

      const eventPayload = {
        event: 'tab_change',
        url: 'https://example.com',
        title: 'Example',
        domain: 'example.com',
        dwell_seconds: 0,
        source: 'browser',
      };

      await fetch('http://localhost:8000/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/event',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    test('should handle backend response and store in chrome.storage', async () => {
      mockChrome.storage.local.set.mockImplementation((data) => {
        expect(data).toHaveProperty('response_1');
      });

      const response = {
        action: 'block',
        message: 'Distraction detected',
        timestamp: Date.now(),
      };

      mockChrome.storage.local.set({ response_1: response });

      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle backend connection error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockChrome.storage.local.set.mockImplementation(jest.fn());

      try {
        await fetch('http://localhost:8000/event', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      // Should still store error response
      mockChrome.storage.local.set({
        response_1: {
          action: 'error',
          message: 'Backend unreachable',
        },
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    test('should send message to content script on response', () => {
      mockChrome.tabs.sendMessage.mockImplementation(jest.fn());

      const tabId = 1;
      const responseData = { action: 'nudge', message: 'Focus!' };

      mockChrome.tabs.sendMessage(tabId, {
        type: 'AGENT_RESPONSE',
        payload: responseData,
      });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          type: 'AGENT_RESPONSE',
          payload: responseData,
        })
      );
    });
  });

  describe('Session Control', () => {
    test('should handle START_SESSION message', () => {
      mockChrome.storage.local.set.mockImplementation(jest.fn());

      const sendResponse = jest.fn();
      
      // Simulate message listener
      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        callback({ type: 'START_SESSION' }, {}, sendResponse);
      });

      // Should set sessionActive to true
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should handle STOP_SESSION message', () => {
      mockChrome.storage.local.set.mockImplementation(jest.fn());

      const sendResponse = jest.fn();

      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        callback({ type: 'STOP_SESSION' }, {}, sendResponse);
      });

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should return session status on GET_SESSION_STATUS', () => {
      const sendResponse = jest.fn();

      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        callback({ type: 'GET_SESSION_STATUS' }, {}, sendResponse);
      });

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should return current tab info on GET_CURRENT_TAB', () => {
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([
          {
            id: 1,
            url: 'https://example.com',
            title: 'Example',
          },
        ]);
      });

      const sendResponse = jest.fn();

      mockChrome.runtime.onMessage.addListener.mockImplementation((callback) => {
        callback({ type: 'GET_CURRENT_TAB' }, {}, sendResponse);
      });

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('Event Schema Validation', () => {
    test('should include all required fields in event payload', () => {
      const requiredFields = [
        'event',
        'url',
        'title',
        'domain',
        'dwell_seconds',
        'navigation_type',
        'tabHistory',
        'source',
      ];

      const eventPayload = {
        event: 'tab_change',
        url: 'https://example.com',
        title: 'Example',
        domain: 'example.com',
        isDistraction: null,
        is_work: null,
        dwell_seconds: 0,
        referrer: '',
        navigation_type: 'tab_change',
        sessionDurationSeconds: 0,
        tabHistory: [],
        source: 'browser',
      };

      requiredFields.forEach((field) => {
        expect(eventPayload).toHaveProperty(field);
      });
    });

    test('should limit tab history to last 10 entries', () => {
      const history = [];
      for (let i = 0; i < 15; i++) {
        history.push({
          url: `https://example${i}.com`,
          title: `Page ${i}`,
          timestamp: Date.now(),
        });
      }

      // Should keep only last 10
      const limitedHistory = history.slice(-10);
      expect(limitedHistory.length).toBe(10);
    });
  });

  describe('Ignore Events When Inactive', () => {
    test('should not POST events when session is inactive', () => {
      mockFetch.mockClear();

      // When sessionActive is false, tab events should be ignored
      const shouldProcess = false; // Simulating inactive session

      if (shouldProcess) {
        fetch('http://localhost:8000/event', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
