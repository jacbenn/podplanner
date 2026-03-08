import { useState } from "react";
import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { getVisiblePodcasts } from "~/utils/visibility.server";
import type { Podcast, Episode, Book } from "~/types/models";
import EpisodeTile from "~/components/EpisodeTile";
import styles from "./_auth._index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

interface EpisodeWithDetails extends Episode {
  podcast: Podcast;
  book?: Book;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers, supabase } = await requireUser(request);
  const podcasts = await getVisiblePodcasts(supabase, user.id);

  if (podcasts.length === 0) {
    return json(
      { userEmail: user.email, podcasts: [], episodes: [] },
      { headers }
    );
  }

  const podcastIds = podcasts.map((p) => p.id);

  // Fetch all episodes for visible podcasts
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .in("podcast_id", podcastIds)
    .order("filming_date", { ascending: false });

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
  const allEpisodes: EpisodeWithDetails[] = (episodes || []).map(
    (episode) => ({
      ...episode,
      podcast: podcastsMap.get(episode.podcast_id)!,
      book: episode.book_id ? booksMap.get(episode.book_id) : undefined,
    })
  );

  // Filter to show only past episodes (before today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastEpisodes = allEpisodes.filter((episode) => {
    if (!episode.filming_date) return false; // Don't show episodes without dates
    const filmingDate = new Date(episode.filming_date);
    filmingDate.setHours(0, 0, 0, 0);
    return filmingDate < today;
  });

  return json(
    {
      userEmail: user.email,
      podcasts,
      episodes: pastEpisodes,
    },
    { headers }
  );
}

interface LoaderData {
  userEmail: string;
  podcasts: Podcast[];
  episodes: EpisodeWithDetails[];
}

export default function PastEpisodes() {
  const { userEmail, podcasts, episodes } = useLoaderData<LoaderData>();
  const [showPodcastDropdown, setShowPodcastDropdown] = useState(false);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-top">
          <h1>Past Episodes</h1>
          <Link to="/" className="btn btn-secondary">
            Back to Timeline
          </Link>
        </div>
        <p className="subtitle">You're logged in as {userEmail}</p>
      </div>

      {episodes.length === 0 ? (
        <div className="empty-state">
          <p>No past episodes yet.</p>
        </div>
      ) : (
        <section className="timeline-section">
          <div className="timeline">
            {episodes.map((episode) => (
              <EpisodeTile
                key={episode.id}
                episode={episode}
                podcast={episode.podcast}
                currentBook={episode.book}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
