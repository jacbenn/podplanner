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
  const episodesWithDetails: EpisodeWithDetails[] = (episodes || []).map(
    (episode) => ({
      ...episode,
      podcast: podcastsMap.get(episode.podcast_id)!,
      book: episode.book_id ? booksMap.get(episode.book_id) : undefined,
    })
  );

  return json(
    {
      userEmail: user.email,
      podcasts,
      episodes: episodesWithDetails,
    },
    { headers }
  );
}

interface LoaderData {
  userEmail: string;
  podcasts: Podcast[];
  episodes: EpisodeWithDetails[];
}

export default function Dashboard() {
  const { userEmail, podcasts, episodes } = useLoaderData<LoaderData>();
  const [showPodcastDropdown, setShowPodcastDropdown] = useState(false);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-top">
          <h1>Episode Timeline</h1>
          {podcasts.length > 0 && (
            <div className="podcast-dropdown-container">
              <button
                className="btn btn-primary"
                onClick={() => setShowPodcastDropdown(!showPodcastDropdown)}
              >
                New Episode
              </button>
              {showPodcastDropdown && (
                <div className="podcast-dropdown-menu">
                  {podcasts.map((podcast) => (
                    <Link
                      key={podcast.id}
                      to={`/podcasts/${podcast.id}/episodes/new`}
                      className="dropdown-item"
                      onClick={() => setShowPodcastDropdown(false)}
                    >
                      <span className="podcast-name">{podcast.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="subtitle">You're logged in as {userEmail}</p>
      </div>

      {episodes.length === 0 ? (
        <div className="empty-state">
          <p>No episodes yet. Start adding episodes to your podcasts!</p>
          {podcasts.length > 0 && (
            <p>
              Visit a podcast to{" "}
              <Link to={`/podcasts/${podcasts[0].id}`}>create an episode</Link>
            </p>
          )}
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
