import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTab, setCurrentTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);

  // Load initial state
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: 'GET_SESSION_STATUS' },
      (response) => {
        setSessionActive(response.sessionActive);
        setLoading(false);
      }
    );

    // Get current tab info
    chrome.runtime.sendMessage(
      { type: 'GET_CURRENT_TAB' },
      (response) => {
        if (response) {
          setCurrentTab(response);
        }
      }
    );

    // Check backend connectivity (optional, for UI feedback)
    checkBackendConnectivity();
  }, []);

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
        if (response.success) {
          setSessionActive(newState);
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="header">
        <h1>🎯 Deep Work Agent</h1>
        <p className="subtitle">Focus blocker powered by AI</p>
      </div>

      {/* Status Section */}
      <div className="status-section">
        <div className="status-badge">
          <span className={`status-indicator ${sessionActive ? 'active' : 'inactive'}`}></span>
          <span className="status-text">
            {sessionActive ? 'Monitoring Active' : 'Monitoring Inactive'}
          </span>
        </div>
        
        {currentTab && (
          <div className="current-tab">
            <p className="label">Current Tab:</p>
            <p className="domain">{new URL(currentTab.url).hostname}</p>
            <p className="title" title={currentTab.title}>{currentTab.title}</p>
          </div>
        )}

        {!backendConnected && sessionActive && (
          <div className="warning">
            ⚠️ Backend not reachable at localhost:8000
          </div>
        )}
      </div>

      {/* Control Section */}
      <div className="control-section">
        <button
          className={`toggle-button ${sessionActive ? 'active' : 'inactive'}`}
          onClick={handleToggleSession}
        >
          {sessionActive ? '⏸ Stop Monitoring' : '▶ Start Monitoring'}
        </button>
      </div>

      {/* Info Section */}
      <div className="info-section">
        <details>
          <summary>ℹ️ How it works</summary>
          <p>
            When monitoring is active:
          </p>
          <ul>
            <li>Tab changes are tracked</li>
            <li>Events sent to backend for analysis</li>
            <li>AI determines if page is a distraction</li>
            <li>You'll see nudges or blocks as needed</li>
          </ul>
        </details>
      </div>

      {/* Footer */}
      <div className="footer">
        <small>v1.0.0</small>
      </div>
    </div>
  );
}

export default App;
