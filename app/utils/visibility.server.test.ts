import { describe, it, expect, vi } from 'vitest';
import { getVisiblePodcasts, toggleVisibility } from './visibility.server';
import type { Podcast } from '~/types/models';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
};

describe('visibility.server utilities', () => {
  const mockUserId = 'user-123';
  const mockPodcastId = 'podcast-123';

  const mockPodcasts: Podcast[] = [
    {
      id: 'podcast-1',
      name: 'Test Podcast 1',
      slug: 'test-podcast-1',
      description: 'A test podcast',
      accent_color: '#FF0000',
      created_at: '2024-01-01',
    },
    {
      id: 'podcast-2',
      name: 'Test Podcast 2',
      slug: 'test-podcast-2',
      description: 'Another test podcast',
      accent_color: '#00FF00',
      created_at: '2024-01-02',
    },
  ];

  describe('getVisiblePodcasts', () => {
    it('should return podcasts with visibility preferences applied', async () => {
      const mockAccessRows = [
        { podcast_id: 'podcast-1' },
        { podcast_id: 'podcast-2' },
      ];

      const mockPrefs = [
        { podcast_id: 'podcast-1', is_visible: true },
        { podcast_id: 'podcast-2', is_visible: false },
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              data: mockAccessRows,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            in: vi.fn().mockResolvedValueOnce({
              data: mockPodcasts,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              data: mockPrefs,
              error: null,
            }),
          }),
        });

      const results = await getVisiblePodcasts(mockSupabase as any, mockUserId);

      expect(results).toHaveLength(2);
      expect(results[0].is_visible).toBe(true);
      expect(results[1].is_visible).toBe(false);
    });

    it('should return empty array when user has no podcast access', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: [],
            error: null,
          }),
        }),
      });

      const results = await getVisiblePodcasts(mockSupabase as any, mockUserId);

      expect(results).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      });

      const results = await getVisiblePodcasts(mockSupabase as any, mockUserId);

      expect(results).toEqual([]);
    });

    it('should default to is_visible=true for podcasts without preferences', async () => {
      const mockAccessRows = [
        { podcast_id: 'podcast-1' },
        { podcast_id: 'podcast-2' },
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              data: mockAccessRows,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            in: vi.fn().mockResolvedValueOnce({
              data: mockPodcasts,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              data: [], // No preferences
              error: null,
            }),
          }),
        });

      const results = await getVisiblePodcasts(mockSupabase as any, mockUserId);

      expect(results).toHaveLength(2);
      expect(results[0].is_visible).toBe(true);
      expect(results[1].is_visible).toBe(true);
    });
  });

  describe('toggleVisibility', () => {
    it('should call upsert with correct parameters', async () => {
      const mockUpsert = vi.fn().mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        upsert: mockUpsert,
      });

      await toggleVisibility(mockSupabase as any, mockUserId, mockPodcastId, true);

      expect(mockUpsert).toHaveBeenCalledWith({
        user_id: mockUserId,
        podcast_id: mockPodcastId,
        is_visible: true,
      });
    });

    it('should handle toggling visibility off', async () => {
      const mockUpsert = vi.fn().mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        upsert: mockUpsert,
      });

      await toggleVisibility(mockSupabase as any, mockUserId, mockPodcastId, false);

      expect(mockUpsert).toHaveBeenCalledWith({
        user_id: mockUserId,
        podcast_id: mockPodcastId,
        is_visible: false,
      });
    });
  });
});
