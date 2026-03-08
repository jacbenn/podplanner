import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { getVisiblePodcasts } from "~/utils/visibility.server";
import type { Podcast, Episode, Book } from "~/types/models";
import CalendarView, {
  links as calendarViewLinks,
} from "~/components/CalendarView";

interface EpisodeWithDetails extends Episode {
  podcast: Podcast;
  book?: Book;
}

export const links: LinksFunction = () => [...calendarViewLinks()];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers, supabase } = await requireUser(request);
  const allPodcasts = await getVisiblePodcasts(supabase, user.id);

  // Only include visible podcasts
  const podcasts = allPodcasts.filter((p) => p.is_visible !== false);

  if (podcasts.length === 0) {
    return json(
      { userEmail: user.email, episodes: [] },
      { headers }
    );
  }

  const podcastIds = podcasts.map((p) => p.id);

  // Fetch all episodes for visible podcasts (no upcoming-only filter)
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .in("podcast_id", podcastIds)
    .order("filming_date", { ascending: true });

  // Fetch books for all episodes that have a book_id
  const bookIds = (episodes || [])
    .filter((e) => e.book_id)
    .map((e) => e.book_id);

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .in("id", bookIds);

  const booksMap = new Map(books?.map((b) => [b.id, b]) ?? []);
  const podcastsMap = new Map(podcasts.map((p) => [p.id, p]));

  // Combine episodes with their podcast and book data
  const allEpisodes: EpisodeWithDetails[] = (episodes || []).map((episode) => ({
    ...episode,
    podcast: podcastsMap.get(episode.podcast_id)!,
    book: episode.book_id ? booksMap.get(episode.book_id) : undefined,
  }));

  return json(
    {
      userEmail: user.email,
      episodes: allEpisodes,
    },
    { headers }
  );
}

interface LoaderData {
  userEmail: string;
  episodes: EpisodeWithDetails[];
}

export default function Calendar() {
  const { userEmail, episodes } = useLoaderData<LoaderData>();

  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <h1>Episode Calendar</h1>
        <p className="subtitle">You're logged in as {userEmail}</p>
      </div>

      {episodes.length === 0 ? (
        <div className="empty-state">
          <p>No episodes yet. Start adding episodes to your podcasts!</p>
        </div>
      ) : (
        <CalendarView episodes={episodes} />
      )}
    </div>
  );
}
