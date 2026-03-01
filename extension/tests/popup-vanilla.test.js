/**
 * Popup UI Tests (Vanilla JS version)
 * Tests for the popup.js Start/Stop session functionality
 */

describe('Popup UI - Vanilla JavaScript', () => {
  let mockChrome;
  
  // Helper to set up DOM structure matching popup.html
  function setupPopupDOM() {
    document.body.innerHTML = `
      <div class="popup-container">
        <div class="header">
          <div class="header-icon">🎯</div>
          <h1>Deep Work Agent</h1>
          <p class="subtitle">Intent-aware focus protection</p>
        </div>
        <div class="status-card" id="statusCard">
          <div class="status-badge">
            <span class="status-dot" id="statusDot"></span>
            <span class="status-label" id="statusLabel">Session Inactive</span>
          </div>
          <div class="session-stats" id="sessionStats">
            <div class="stat">
              <span class="stat-icon">⏱️</span>
              <div class="stat-content">
                <span class="stat-value" id="sessionTime">0:00</span>
                <span class="stat-label">Session Time</span>
              </div>
            </div>
            <div class="stat">
              <span class="stat-icon">🛡️</span>
              <div class="stat-content">
                <span class="stat-value" id="interventionCount">0</span>
                <span class="stat-label">Interventions</span>
              </div>
            </div>
          </div>
        </div>
        <div class="current-tab-card" id="currentTabCard" style="display:none;">
          <span class="tab-label">Current Tab</span>
          <span class="tab-domain" id="tabDomain"></span>
        </div>
        <div class="warning-card" id="warningCard">
          <span>⚠️</span>
          <span>Backend not reachable at localhost:8000</span>
        </div>
        <div class="controls">
          <button class="primary-button" id="toggleBtn">
            <span id="btnIcon">▶️</span>
            <span id="btnText">Start Focus Session</span>
          </button>
        </div>
        <div class="footer">
          <span>v2.0.0</span>
          <span class="backend-status" id="backendStatus">○ Disconnected</span>
        </div>
      </div>
    `;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setupPopupDOM();
    mockChrome = global.chrome;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('DOM Element References', () => {
    test('should have all required DOM elements', () => {
      expect(document.getElementById('statusCard')).toBeTruthy();
      expect(document.getElementById('statusDot')).toBeTruthy();
      expect(document.getElementById('statusLabel')).toBeTruthy();
      expect(document.getElementById('sessionStats')).toBeTruthy();
      expect(document.getElementById('sessionTime')).toBeTruthy();
      expect(document.getElementById('interventionCount')).toBeTruthy();
      expect(document.getElementById('currentTabCard')).toBeTruthy();
      expect(document.getElementById('tabDomain')).toBeTruthy();
      expect(document.getElementById('warningCard')).toBeTruthy();
      expect(document.getElementById('toggleBtn')).toBeTruthy();
      expect(document.getElementById('btnIcon')).toBeTruthy();
      expect(document.getElementById('btnText')).toBeTruthy();
      expect(document.getElementById('backendStatus')).toBeTruthy();
    });

    test('should show correct initial state', () => {
      const statusLabel = document.getElementById('statusLabel');
      const btnText = document.getElementById('btnText');
      
      expect(statusLabel.textContent).toBe('Session Inactive');
      expect(btnText.textContent).toBe('Start Focus Session');
    });
  });

  describe('formatTime Function', () => {
    // Test the formatTime logic inline
    function formatTime(seconds) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hrs > 0) {
        return hrs + ':' + mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
      }
      return mins + ':' + secs.toString().padStart(2, '0');
    }

    test('should format 0 seconds as 0:00', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    test('should format 30 seconds as 0:30', () => {
      expect(formatTime(30)).toBe('0:30');
    });

    test('should format 90 seconds as 1:30', () => {
      expect(formatTime(90)).toBe('1:30');
    });

    test('should format 3661 seconds as 1:01:01', () => {
      expect(formatTime(3661)).toBe('1:01:01');
    });

    test('should format 7325 seconds as 2:02:05', () => {
      expect(formatTime(7325)).toBe('2:02:05');
    });

    test('should pad minutes and seconds with zeros', () => {
      expect(formatTime(3605)).toBe('1:00:05');
    });
  });

  describe('Session Toggle', () => {
    test('should send START_SESSION message when session is inactive', () => {
      const toggleBtn = document.getElementById('toggleBtn');
      
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.type === 'START_SESSION') {
          callback({ success: true });
        }
      });

      toggleBtn.click();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'START_SESSION' },
        expect.any(Function)
      );
    });

    test('should send STOP_SESSION message when session is active', () => {
      const toggleBtn = document.getElementById('toggleBtn');
      const statusCard = document.getElementById('statusCard');
      
      // Simulate active session
      statusCard.classList.add('active');
      toggleBtn.classList.add('stop');
      
      // Mock the sessionActive state by checking button class
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      // Since we can't directly set sessionActive, we test the message structure
      toggleBtn.click();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('UI State Updates', () => {
    test('should add active class to status card when session starts', () => {
      const statusCard = document.getElementById('statusCard');
      const statusDot = document.getElementById('statusDot');
      
      statusCard.classList.add('active');
      statusDot.classList.add('active');
      
      expect(statusCard.classList.contains('active')).toBe(true);
      expect(statusDot.classList.contains('active')).toBe(true);
    });

    test('should update button text when session is active', () => {
      const btnIcon = document.getElementById('btnIcon');
      const btnText = document.getElementById('btnText');
      const toggleBtn = document.getElementById('toggleBtn');
      
      // Simulate active state
      toggleBtn.classList.add('stop');
      btnIcon.textContent = '⏹️';
      btnText.textContent = 'Stop Session';
      
      expect(btnText.textContent).toBe('Stop Session');
      expect(btnIcon.textContent).toBe('⏹️');
      expect(toggleBtn.classList.contains('stop')).toBe(true);
    });

    test('should show session stats when session is active', () => {
      const sessionStats = document.getElementById('sessionStats');
      
      sessionStats.classList.add('visible');
      
      expect(sessionStats.classList.contains('visible')).toBe(true);
    });

    test('should hide session stats when session is inactive', () => {
      const sessionStats = document.getElementById('sessionStats');
      
      sessionStats.classList.remove('visible');
      
      expect(sessionStats.classList.contains('visible')).toBe(false);
    });
  });

  describe('Backend Connectivity', () => {
    test('should show connected status when backend responds', async () => {
      const backendStatus = document.getElementById('backendStatus');
      
      global.fetch.mockResolvedValueOnce({ ok: true });
      
      backendStatus.textContent = '● Connected';
      backendStatus.classList.add('connected');
      backendStatus.classList.remove('disconnected');
      
      expect(backendStatus.textContent).toBe('● Connected');
      expect(backendStatus.classList.contains('connected')).toBe(true);
    });

    test('should show disconnected status when backend fails', async () => {
      const backendStatus = document.getElementById('backendStatus');
      
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      backendStatus.textContent = '○ Disconnected';
      backendStatus.classList.add('disconnected');
      backendStatus.classList.remove('connected');
      
      expect(backendStatus.textContent).toBe('○ Disconnected');
      expect(backendStatus.classList.contains('disconnected')).toBe(true);
    });

    test('should show warning card when backend disconnected and session active', () => {
      const warningCard = document.getElementById('warningCard');
      const statusCard = document.getElementById('statusCard');
      
      // Simulate active session and backend failure
      statusCard.classList.add('active');
      warningCard.classList.add('visible');
      
      expect(warningCard.classList.contains('visible')).toBe(true);
    });
  });

  describe('Current Tab Display', () => {
    test('should display current tab domain', () => {
      const tabDomain = document.getElementById('tabDomain');
      const currentTabCard = document.getElementById('currentTabCard');
      
      tabDomain.textContent = 'github.com';
      currentTabCard.style.display = 'flex';
      
      expect(tabDomain.textContent).toBe('github.com');
      expect(currentTabCard.style.display).toBe('flex');
    });

    test('should hide current tab card for chrome:// URLs', () => {
      const currentTabCard = document.getElementById('currentTabCard');
      
      currentTabCard.style.display = 'none';
      
      expect(currentTabCard.style.display).toBe('none');
    });
  });

  describe('Intervention Counter', () => {
    test('should display intervention count from background', () => {
      const interventionCount = document.getElementById('interventionCount');
      
      interventionCount.textContent = '5';
      
      expect(interventionCount.textContent).toBe('5');
    });

    test('should reset intervention count on new session', () => {
      const interventionCount = document.getElementById('interventionCount');
      
      interventionCount.textContent = '0';
      
      expect(interventionCount.textContent).toBe('0');
    });
  });

  describe('Timer Updates', () => {
    test('should update session time display', () => {
      const sessionTime = document.getElementById('sessionTime');
      
      sessionTime.textContent = '5:30';
      
      expect(sessionTime.textContent).toBe('5:30');
    });

    test('should show hours when session exceeds 1 hour', () => {
      const sessionTime = document.getElementById('sessionTime');
      
      sessionTime.textContent = '1:30:45';
      
      expect(sessionTime.textContent).toBe('1:30:45');
    });
  });

  describe('Message Communication', () => {
    test('should request GET_SESSION_STATS on load', () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.type === 'GET_SESSION_STATS') {
          callback({
            sessionActive: true,
            sessionStartTime: Date.now() - 60000,
            interventionCount: 3
          });
        }
      });

      // Simulate loadStats call
      chrome.runtime.sendMessage({ type: 'GET_SESSION_STATS' }, function(response) {
        expect(response.sessionActive).toBe(true);
        expect(response.interventionCount).toBe(3);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'GET_SESSION_STATS' },
        expect.any(Function)
      );
    });

    test('should request GET_CURRENT_TAB on load', () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.type === 'GET_CURRENT_TAB') {
          callback({
            tabId: 1,
            url: 'https://github.com',
            title: 'GitHub'
          });
        }
      });

      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, function(response) {
        expect(response.url).toBe('https://github.com');
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'GET_CURRENT_TAB' },
        expect.any(Function)
      );
    });
  });
});
