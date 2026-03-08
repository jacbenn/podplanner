-- Create junction table for episode-book relationships
CREATE TABLE IF NOT EXISTS episode_books (
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE NOT NULL,
  book_id uuid REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (episode_id, book_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_episode_books_episode_id ON episode_books(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_books_book_id ON episode_books(book_id);

-- Migrate existing data from episodes.book_id to episode_books
INSERT INTO episode_books (episode_id, book_id, position)
SELECT id, book_id, 0
FROM episodes
WHERE book_id IS NOT NULL
ON CONFLICT (episode_id, book_id) DO NOTHING;
