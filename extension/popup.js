// Deep Work Agent - Popup Script
// State
let sessionActive = false;
let sessionStartTime = null;
let timerInterval = null;

// DOM elements
const statusCard = document.getElementById('statusCard');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const sessionStats = document.getElementById('sessionStats');
const sessionTime = document.getElementById('sessionTime');
const interventionCount = document.getElementById('interventionCount');
const currentTabCard = document.getElementById('currentTabCard');
const tabDomain = document.getElementById('tabDomain');
const warningCard = document.getElementById('warningCard');
const toggleBtn = document.getElementById('toggleBtn');
const btnIcon = document.getElementById('btnIcon');
const btnText = document.getElementById('btnText');
const backendStatus = document.getElementById('backendStatus');
const summaryBtn = document.getElementById('summaryBtn');
const summaryDashboard = document.getElementById('summaryDashboard');
const summaryClose = document.getElementById('summaryClose');

// Format time as MM:SS or H:MM:SS
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return hrs + ':' + mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
    }
    return mins + ':' + secs.toString().padStart(2, '0');
}

// Update UI based on session state
function updateUI() {
    if (sessionActive) {
        statusCard.classList.add('active');
        statusDot.classList.add('active');
        statusLabel.textContent = 'Focus Session Active';
        sessionStats.classList.add('visible');
        toggleBtn.classList.add('stop');
        btnIcon.textContent = '⏹️';
        btnText.textContent = 'Stop Session';
    } else {
        statusCard.classList.remove('active');
        statusDot.classList.remove('active');
        statusLabel.textContent = 'Session Inactive';
        sessionStats.classList.remove('visible');
        toggleBtn.classList.remove('stop');
        btnIcon.textContent = '▶️';
        btnText.textContent = 'Start Focus Session';
    }
}

// Update timer display
function updateTimer() {
    if (sessionActive && sessionStartTime) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        sessionTime.textContent = formatTime(elapsed);
    }
}

// Load session stats from background
function loadStats() {
    chrome.runtime.sendMessage({ type: 'GET_SESSION_STATS' }, function(response) {
        if (response) {
            sessionActive = response.sessionActive || false;
            sessionStartTime = response.sessionStartTime || null;
            interventionCount.textContent = response.interventionCount || 0;
            updateUI();
            updateTimer();
        }
    });
}

// Load current tab info
function loadCurrentTab() {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, function(response) {
        if (response && response.url && !response.url.startsWith('chrome://')) {
            try {
                var url = new URL(response.url);
                tabDomain.textContent = url.hostname;
                currentTabCard.style.display = 'flex';
            } catch (e) {
                currentTabCard.style.display = 'none';
            }
        } else {
            currentTabCard.style.display = 'none';
        }
    });
}

// Check backend connectivity
function checkBackend() {
    fetch('http://localhost:8000/health', { method: 'GET' })
        .then(function(res) {
            backendStatus.textContent = '● Connected';
            backendStatus.classList.add('connected');
            backendStatus.classList.remove('disconnected');
            warningCard.classList.remove('visible');
        })
        .catch(function() {
            backendStatus.textContent = '○ Disconnected';
            backendStatus.classList.add('disconnected');
            backendStatus.classList.remove('connected');
            if (sessionActive) {
                warningCard.classList.add('visible');
            }
        });
}

// Toggle session
function toggleSession() {
    var messageType = sessionActive ? 'STOP_SESSION' : 'START_SESSION';
    chrome.runtime.sendMessage({ type: messageType }, function(response) {
        if (response && response.success) {
            sessionActive = !sessionActive;
            if (sessionActive) {
                sessionStartTime = Date.now();
                interventionCount.textContent = '0';
            } else {
                sessionStartTime = null;
                warningCard.classList.remove('visible');
            }
            updateUI();
        }
    });
}

// Event listeners
toggleBtn.addEventListener('click', toggleSession);
summaryBtn.addEventListener('click', function() {
    summaryDashboard.classList.add('visible');
});
summaryClose.addEventListener('click', function() {
    summaryDashboard.classList.remove('visible');
});

// Initialize
loadStats();
loadCurrentTab();
checkBackend();

// Update timer every second
timerInterval = setInterval(function() {
    updateTimer();
    loadStats();
}, 1000);

// Check backend every 5 seconds
setInterval(checkBackend, 5000);
