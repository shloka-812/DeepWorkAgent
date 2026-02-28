document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const taskDescription = document.getElementById('taskDescription');

  // Load initial state
  chrome.storage.local.get(['focusActive', 'currentTask'], (result) => {
    updateUI(result.focusActive, result.currentTask);
  });

  // Also check with background script to ensure sync
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
      updateUI(response.focusActive, null);
    }
  });

  toggleBtn.addEventListener('click', () => {
    chrome.storage.local.get('focusActive', (result) => {
      const isCurrentlyActive = result.focusActive || false;
      const newActiveState = !isCurrentlyActive;
      
      const msgType = newActiveState ? 'START_FOCUS' : 'STOP_FOCUS';
      
      toggleBtn.disabled = true;
      toggleBtn.textContent = 'Updating...';

      chrome.runtime.sendMessage({ type: msgType }, (response) => {
        if (response && response.success) {
          updateUI(newActiveState, null);
        } else {
          // Revert UI on failure
          updateUI(isCurrentlyActive, null);
        }
      });
    });
  });

  function updateUI(isActive, currentTask) {
    if (isActive) {
      statusIndicator.textContent = 'Active Focus Block';
      statusIndicator.className = 'status-badge status-active pulse';
      
      toggleBtn.textContent = 'Stop Focus Session';
      toggleBtn.className = 'btn-stop';
      
      // We would ideally fetch the current task from the backend here
      taskDescription.textContent = currentTask || "Monitoring activity and shielding your focus.";
      taskDescription.style.color = '#e5e7eb';
    } else {
      statusIndicator.textContent = 'Idle';
      statusIndicator.className = 'status-badge status-inactive';
      
      toggleBtn.textContent = 'Start Focus Session';
      toggleBtn.className = 'btn-start';
      
      taskDescription.textContent = "Not currently in a focus session. Distractions are allowed.";
      taskDescription.style.color = '#9ca3af';
    }
    toggleBtn.disabled = false;
  }
});
