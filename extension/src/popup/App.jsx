import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTab, setCurrentTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [interventionCount, setInterventionCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update session timer
  const updateSessionStats = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: 'GET_SESSION_STATS' },
      (response) => {
        if (response) {
          setSessionActive(response.sessionActive);
          setSessionDuration(response.durationSeconds || 0);
          setInterventionCount(response.interventionCount || 0);
          setSessionStartTime(response.sessionStartTime);
        }
        setLoading(false);
      }
    );
  }, []);

  // Load initial state and set up timer
  useEffect(() => {
    updateSessionStats();
    
    // Get current tab info
    chrome.runtime.sendMessage(
      { type: 'GET_CURRENT_TAB' },
      (response) => {
        if (response) {
          setCurrentTab(response);
        }
      }
    );

    // Check backend connectivity
    checkBackendConnectivity();

    // Update timer every second when session is active
    const interval = setInterval(() => {
      updateSessionStats();
    }, 1000);

    return () => clearInterval(interval);
  }, [updateSessionStats]);

  const checkBackendConnectivity = () => {
    fetch('http://localhost:8000/health', {
      method: 'GET',
      mode: 'no-cors'
    })
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  };

  const handleToggleSession = () => {
    const newState = !sessionActive;
    
    const messageType = newState ? 'START_SESSION' : 'STOP_SESSION';
    chrome.runtime.sendMessage(
      { type: messageType },
      (response) => {
        if (response && response.success) {
          setSessionActive(newState);
          if (newState) {
            setSessionDuration(0);
            setInterventionCount(0);
          }
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="header">
        <div className="header-icon">🎯</div>
        <h1>Deep Work Agent</h1>
        <p className="subtitle">Intent-aware focus protection</p>
      </div>

      {/* Session Status */}
      <div className={`status-card ${sessionActive ? 'active' : 'inactive'}`}>
        <div className="status-header">
          <div className="status-badge">
            <span className={`status-dot ${sessionActive ? 'active' : 'inactive'}`}></span>
            <span className="status-label">
              {sessionActive ? 'Focus Session Active' : 'Session Inactive'}
            </span>
          </div>
        </div>

        {sessionActive && (
          <div className="session-stats">
            <div className="stat">
              <span className="stat-icon">⏱️</span>
              <div className="stat-content">
                <span className="stat-value">{formatTime(sessionDuration)}</span>
                <span className="stat-label">Session Time</span>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon">🛡️</span>
              <div className="stat-content">
                <span className="stat-value">{interventionCount}</span>
                <span className="stat-label">Interventions</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Tab */}
      {currentTab && currentTab.url && !currentTab.url.startsWith('chrome://') && (
        <div className="current-tab-card">
          <span className="tab-label">Current Tab</span>
          <span className="tab-domain">{new URL(currentTab.url).hostname}</span>
        </div>
      )}

      {/* Backend Status */}
      {!backendConnected && sessionActive && (
        <div className="warning-card">
          <span className="warning-icon">⚠️</span>
          <span>Backend not reachable at localhost:8000</span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="controls">
        <button
          className={`primary-button ${sessionActive ? 'stop' : 'start'}`}
          onClick={handleToggleSession}
        >
          {sessionActive ? (
            <>
              <span className="btn-icon">⏹️</span>
              Stop Session
            </>
          ) : (
            <>
              <span className="btn-icon">▶️</span>
              Start Focus Session
            </>
          )}
        </button>
      </div>

      {/* Info Section */}
      <details className="info-details">
        <summary>ℹ️ How it works</summary>
        <div className="info-content">
          <p>When active, the agent:</p>
          <ul>
            <li>Monitors your tab changes</li>
            <li>Assesses intent with AI</li>
            <li>Asks clarifying questions (ASK)</li>
            <li>Escalates: nudge → block</li>
          </ul>
        </div>
      </details>

      {/* Footer */}
      <div className="footer">
        <span>v2.0.0</span>
        <span className={`backend-status ${backendConnected ? 'connected' : 'disconnected'}`}>
          {backendConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
    </div>
  );
}

export default App;
