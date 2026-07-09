/**
 * Test suite for utility functions
 */

describe('Utility Functions', () => {
  describe('path utilities', () => {
    test('should normalize Windows paths to Unix paths', () => {
      const normalizePath = (path) => path.replace(/\\/g, '/').replace(/\/$/, '');
      expect(normalizePath('some\\path\\to\\images')).toBe('some/path/to/images');
      expect(normalizePath('some/path/to/images/')).toBe('some/path/to/images');
    });

    test('should extract filename from path', () => {
      const path = '/some/path/to/file.html';
      const fileName = path.split('/').pop();
      expect(fileName).toBe('file.html');
    });

    test('should remove extension from filename', () => {
      const fileName = 'page.html';
      const slug = fileName.replace(/\.html$/i, '');
      expect(slug).toBe('page');
    });
  });

  describe('string utilities', () => {
    test('should check if string ends with pattern', () => {
      const str = 'test.html';
      expect(str.endsWith('.html')).toBe(true);
      expect(str.endsWith('.js')).toBe(false);
    });

    test('should handle case-insensitive matching', () => {
      const str = 'test.HTML';
      expect(str.toLowerCase().endsWith('.html')).toBe(true);
    });
  });

  describe('array utilities', () => {
    test('should filter empty values', () => {
      const arr = [1, 0, false, null, undefined, '', 2, 3];
      const filtered = arr.filter(Boolean);
      expect(filtered).toEqual([1, 2, 3]);
    });

    test('should deduplicate array', () => {
      const arr = [1, 2, 2, 3, 3, 3];
      const unique = [...new Set(arr)];
      expect(unique).toEqual([1, 2, 3]);
    });
  });
});

describe('Date utilities', () => {
  test('should format date correctly', () => {
    const date = new Date('2026-07-09T15:30:00Z');
    const formatted = date.toISOString().split('T')[0];
    expect(formatted).toBe('2026-07-09');
  });

  test('should extract time from date', () => {
    const date = new Date('2026-07-09T15:30:00Z');
    const time = date.toTimeString().split(' ')[0].substring(0, 5);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});
