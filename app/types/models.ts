export interface Podcast {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  accent_color: string;
  created_at: string;
  is_visible?: boolean;
}

export interface Episode {
  id: string;
  podcast_id: string;
  episode_number: number | null;
  title: string;
  book_id: string | null;
  filming_date: string | null;
  filming_time: string | null;
  status: "planning" | "recorded" | "published" | "aired";
  notes: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  podcast_id: string;
  title: string;
  author: string;
  status: "upcoming" | "reading" | "finished";
  book_notes: string | null;
  cover_url: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  podcast_id: string;
  name: string;
  role: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MeetingNote {
  id: string;
  podcast_id: string;
  note_date: string;
  agenda: string | null;
  notes: string | null;
  action_items: ActionItem[];
  created_at: string;
  updated_at: string;
}
