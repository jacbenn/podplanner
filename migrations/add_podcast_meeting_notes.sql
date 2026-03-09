CREATE TABLE podcast_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid REFERENCES podcasts(id) ON DELETE CASCADE NOT NULL,
  note_date date NOT NULL,
  agenda text,
  notes text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(podcast_id, note_date)
);

CREATE INDEX idx_podcast_meeting_notes_podcast_date
  ON podcast_meeting_notes(podcast_id, note_date DESC);
