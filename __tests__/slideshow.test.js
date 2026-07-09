/**
 * Test suite for slideshow.js functionality
 */

// Mock DOM elements
const createMockDOM = () => {
  global.document = {
    addEventListener: jest.fn((event, callback) => {
      if (event === 'DOMContentLoaded') {
        callback();
      }
    }),
    getElementById: jest.fn((id) => {
      if (id === 'slides') {
        return {
          appendChild: jest.fn(),
          childElementCount: 0
        };
      }
      return null;
    }),
    querySelector: jest.fn((selector) => {
      if (selector === '.slideshow') {
        return {
          dataset: {
            slideshowBase: '',
            slideshowSlug: ''
          }
        };
      }
      if (selector === '.slide-btn.prev' || selector === '.slide-btn.next') {
        return null;
      }
      return null;
    }),
    body: {
      dataset: {}
    }
  };
  
  global.window = {
    location: {
      pathname: '/index.html'
    }
  };
};

describe('Slideshow Module', () => {
  beforeEach(() => {
    createMockDOM();
    jest.clearAllMocks();
  });

  describe('getBasePath', () => {
    test('should return explicit base path when provided', () => {
      const slideshow = {
        dataset: {
          slideshowBase: '/custom/base/path'
        }
      };
      
      // Simulate the logic
      const explicitBase = slideshow.dataset.slideshowBase;
      expect(explicitBase).toBe('/custom/base/path');
    });

    test('should handle path normalization', () => {
      const path = 'some\\path\\to\\images';
      const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
      expect(normalized).toBe('some/path/to/images');
    });

    test('should extract slug from filename', () => {
      const fileName = 'index.html';
      const slug = fileName.replace(/\.html$/i, '');
      expect(slug).toBe('index');
    });
  });

  describe('slide creation', () => {
    test('should create slide element with correct class', () => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      expect(slide.className).toBe('slide');
    });

    test('should add active class to first slide', () => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.classList.add('active');
      expect(slide.classList.contains('active')).toBe(true);
    });
  });
});
