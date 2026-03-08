import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchOpenLibrary, searchGoogleBooks, searchBooks } from './bookSearch';

global.fetch = vi.fn();

describe('bookSearch utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchOpenLibrary', () => {
    it('should return formatted results from Open Library API', async () => {
      const mockResponse = {
        docs: [
          {
            title: 'The Great Gatsby',
            author_name: ['F. Scott Fitzgerald'],
            first_publish_year: 1925,
            cover_i: 12345,
            isbn: ['9780743273565'],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockResponse,
      });

      const results = await searchOpenLibrary('gatsby');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        year: '1925',
        coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
        isbn: '9780743273565',
        coverId: '12345',
      });
    });

    it('should handle missing cover and author data', async () => {
      const mockResponse = {
        docs: [
          {
            title: 'Unknown Book',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockResponse,
      });

      const results = await searchOpenLibrary('unknown');

      expect(results[0]).toEqual({
        title: 'Unknown Book',
        author: 'Unknown Author',
        year: '',
        coverUrl: null,
        isbn: undefined,
        coverId: undefined,
      });
    });

    it('should return empty array on error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const results = await searchOpenLibrary('test');

      expect(results).toEqual([]);
    });

    it('should return empty array when no docs found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ docs: [] }),
      });

      const results = await searchOpenLibrary('nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('searchGoogleBooks', () => {
    it('should return formatted results from Google Books API', async () => {
      const mockResponse = {
        items: [
          {
            volumeInfo: {
              title: '1984',
              authors: ['George Orwell'],
              publishedDate: '1949-06-08',
              imageLinks: {
                thumbnail: 'https://example.com/cover.jpg',
              },
              industryIdentifiers: [{ identifier: '9780451524935' }],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockResponse,
      });

      const results = await searchGoogleBooks('1984');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        title: '1984',
        author: 'George Orwell',
        year: '1949',
        coverUrl: 'https://example.com/cover.jpg',
        isbn: '9780451524935',
      });
    });

    it('should handle missing data gracefully', async () => {
      const mockResponse = {
        items: [
          {
            volumeInfo: {
              title: 'Minimal Book',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockResponse,
      });

      const results = await searchGoogleBooks('minimal');

      expect(results[0]).toEqual({
        title: 'Minimal Book',
        author: 'Unknown Author',
        year: '',
        coverUrl: null,
        isbn: undefined,
      });
    });

    it('should return empty array on error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API error'));

      const results = await searchGoogleBooks('test');

      expect(results).toEqual([]);
    });
  });

  describe('searchBooks', () => {
    it('should try Open Library first', async () => {
      const mockOpenLibraryResponse = {
        docs: [
          {
            title: 'Test Book',
            author_name: ['Test Author'],
            first_publish_year: 2020,
            cover_i: 123,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockOpenLibraryResponse,
      });

      const results = await searchBooks('test');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Book');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fallback to Google Books if Open Library returns empty', async () => {
      const mockGoogleResponse = {
        items: [
          {
            volumeInfo: {
              title: 'Google Book',
              authors: ['Google Author'],
              publishedDate: '2021',
            },
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ json: async () => ({ docs: [] }) })
        .mockResolvedValueOnce({ json: async () => mockGoogleResponse });

      const results = await searchBooks('test');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Google Book');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
