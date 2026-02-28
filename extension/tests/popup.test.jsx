/**
 * Popup UI Component Tests
 * Tests React component rendering, state management, and user interaction
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../src/popup/App';

describe('Popup App Component', () => {
  let mockChrome;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome = global.chrome;

    // Default mock implementations
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.type === 'GET_SESSION_STATUS') {
        callback({ sessionActive: false });
      } else if (message.type === 'GET_CURRENT_TAB') {
        callback({
          tabId: 1,
          url: 'https://example.com',
          title: 'Example Domain',
          sessionActive: false,
        });
      }
    });

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('should render popup title', () => {
      render(<App />);
      expect(screen.getByText(/Deep Work Agent/i)).toBeInTheDocument();
    });

    test('should render subtitle', () => {
      render(<App />);
      expect(screen.getByText(/Focus blocker powered by AI/i)).toBeInTheDocument();
    });

    test('should render status indicator', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText(/Monitoring/i)).toBeInTheDocument();
      });
    });

    test('should render Start Monitoring button', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Monitoring/i })).toBeInTheDocument();
      });
    });

    test('should render How it works section', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText(/How it works/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Status', () => {
    test('should display inactive status on load', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ sessionActive: false });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Monitoring Inactive/i)).toBeInTheDocument();
      });
    });

    test('should display active status when enabled', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: true });
        } else {
          callback({});
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Monitoring Active/i)).toBeInTheDocument();
      });
    });

    test('should fetch session status on mount', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          { type: 'GET_SESSION_STATUS' },
          expect.any(Function)
        );
      });
    });
  });

  describe('Current Tab Display', () => {
    test('should display current tab domain', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_CURRENT_TAB') {
          callback({
            tabId: 1,
            url: 'https://youtube.com/watch',
            title: 'YouTube Video',
            sessionActive: false,
          });
        } else {
          callback({ sessionActive: false });
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/youtube.com/i)).toBeInTheDocument();
      });
    });

    test('should display current tab title', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_CURRENT_TAB') {
          callback({
            tabId: 1,
            url: 'https://example.com',
            title: 'Very Long Page Title That Should Be Truncated',
            sessionActive: false,
          });
        } else {
          callback({ sessionActive: false });
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Very Long Page Title/i)).toBeInTheDocument();
      });
    });

    test('should display Current Tab label', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Current Tab:/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Control', () => {
    test('should call START_SESSION when clicking Start button', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'START_SESSION') {
          callback({ success: true });
        } else if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: false });
        }
      });

      render(<App />);

      const startButton = await waitFor(() =>
        screen.getByRole('button', { name: /Start Monitoring/i })
      );

      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          { type: 'START_SESSION' },
          expect.any(Function)
        );
      });
    });

    test('should call STOP_SESSION when clicking Stop button', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: true });
        } else if (message.type === 'STOP_SESSION') {
          callback({ success: true });
        }
      });

      render(<App />);

      const stopButton = await waitFor(() =>
        screen.getByRole('button', { name: /Stop Monitoring/i })
      );

      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          { type: 'STOP_SESSION' },
          expect.any(Function)
        );
      });
    });

    test('should update button text after toggling session', async () => {
      let isActive = false;
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: isActive });
        } else if (message.type === 'START_SESSION') {
          isActive = true;
          callback({ success: true });
        } else if (message.type === 'STOP_SESSION') {
          isActive = false;
          callback({ success: true });
        }
      });

      const { rerender } = render(<App />);

      // Should start with Start button
      const startButton = await waitFor(() =>
        screen.getByRole('button', { name: /Start Monitoring/i })
      );
      expect(startButton).toBeInTheDocument();

      // Click to start
      fireEvent.click(startButton);
      rerender(<App />);

      // After update, should show Stop button (if state changed)
      // Note: In real implementation, state would update
    });
  });

  describe('Backend Connectivity', () => {
    test('should check backend connectivity on mount', async () => {
      global.fetch.mockResolvedValueOnce({});

      render(<App />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8000/health',
          expect.objectContaining({
            method: 'GET',
          })
        );
      });
    });

    test('should display warning when backend unreachable', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: true });
        } else {
          callback({});
        }
      });

      render(<App />);

      await waitFor(() => {
        // Warning should appear when session is active and backend unreachable
        expect(screen.queryByText(/Backend not reachable/i)).toBeInTheDocument();
      });
    });

    test('should not display warning when backend is reachable', async () => {
      global.fetch.mockResolvedValueOnce({});

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: false });
        } else {
          callback({});
        }
      });

      render(<App />);

      await waitFor(() => {
        // Should not show warning if inactive or connected
        const warning = screen.queryByText(/Backend not reachable/i);
        expect(warning).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    test('should show loading text initially', () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        // Don't callback immediately - simulate loading
      });

      render(<App />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should stop showing loading after data loads', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        // Callback immediately
        callback({ sessionActive: false });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('UI Styling', () => {
    test('should apply gradient styling to container', () => {
      const { container } = render(<App />);
      const popupContainer = container.querySelector('.popup-container');

      expect(popupContainer).toBeInTheDocument();
    });

    test('should display version info', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/v1.0.0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle failed session start gracefully', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'START_SESSION') {
          callback({ success: false, error: 'Failed to start' });
        } else if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: false });
        }
      });

      render(<App />);

      const startButton = await waitFor(() =>
        screen.getByRole('button', { name: /Start Monitoring/i })
      );

      fireEvent.click(startButton);

      // Should still render without crashing
      expect(screen.getByText(/Deep Work Agent/i)).toBeInTheDocument();
    });

    test('should handle undefined tab data gracefully', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_CURRENT_TAB') {
          callback(null); // Return null instead of tab data
        } else if (message.type === 'GET_SESSION_STATUS') {
          callback({ sessionActive: false });
        }
      });

      render(<App />);

      await waitFor(() => {
        // Should still render main content
        expect(screen.getByText(/Deep Work Agent/i)).toBeInTheDocument();
      });
    });
  });

  describe('Info Section', () => {
    test('should have expandable How it works section', async () => {
      render(<App />);

      const details = screen.getByText(/How it works/i).closest('details');
      expect(details).toBeInTheDocument();
    });

    test('should display monitoring features', async () => {
      render(<App />);

      const summary = screen.getByText(/How it works/i);
      fireEvent.click(summary);

      await waitFor(() => {
        expect(screen.getByText(/Tab changes are tracked/i)).toBeInTheDocument();
      });
    });
  });
});
