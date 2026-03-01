import '@testing-library/jest-dom';

// Mock chrome API globally for all tests
global.chrome = {
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
    },
    onActivated: {
      addListener: jest.fn(),
    },
    get: jest.fn(),
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

// Mock fetch globally
global.fetch = jest.fn();
