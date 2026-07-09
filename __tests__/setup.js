/**
 * Test setup file for Jest
 */

// Setup global mocks before tests run
beforeAll(() => {
  // Mock fetch API if needed
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('')
    })
  );

  // Mock XMLHttpRequest for userscript compatibility
  global.XMLHttpRequest = jest.fn(() => ({
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    readyState: 4,
    status: 200,
    responseText: '',
    addEventListener: jest.fn()
  }));
});

afterAll(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
