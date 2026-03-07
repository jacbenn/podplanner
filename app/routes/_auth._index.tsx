import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { getVisiblePodcasts } from "~/utils/visibility.server";
import type { Podcast, Episode, Book } from "~/types/models";
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

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-top">
          <h1>Episode Timeline</h1>
          {podcasts.length > 0 && (
            <Link to={`/podcasts/${podcasts[0].id}/episodes/new`} className="btn btn-primary">
              New Episode
            </Link>
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
              <div
                key={episode.id}
                className="timeline-item"
                style={{
                  "--podcast-accent": episode.podcast.accent_color,
                } as any}
              >
                <div className="timeline-date">
                  {episode.filming_date
                    ? new Date(episode.filming_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        weekday: "short",
                      })
                    : "No date"}
                  {episode.filming_time && (
                    <div className="timeline-time">{episode.filming_time}</div>
                  )}
                </div>

                <div className="timeline-content">
                  <div className="timeline-main">
                    <div className="episode-header">
                      <h3>
                        <Link to={`/podcasts/${episode.podcast_id}/episodes/${episode.id}`}>
                          {episode.title}
                        </Link>
                      </h3>
                      <span className="podcast-tag">{episode.podcast.name}</span>
                    </div>

                    {episode.episode_number && (
                      <p className="episode-number">
                        Episode #{episode.episode_number}
                      </p>
                    )}

                    {episode.book && (
                      <div className="book-info">
                        <strong>📖 Book:</strong>{" "}
                        <Link to={`/podcasts/${episode.podcast_id}/books/${episode.book.id}`}>
                          {episode.book.title}
                        </Link>{" "}
                        by {episode.book.author}
                        <span className={`book-status status-${episode.book.status}`}>
                          {episode.book.status}
                        </span>
                      </div>
                    )}

                    <div className="episode-footer">
                      <span className={`status-badge status-${episode.status}`}>
                        {episode.status}
                      </span>
                      {episode.notes && (
                        <p className="episode-notes">{episode.notes}</p>
                      )}
                    </div>
                  </div>

                  {episode.book && episode.book.cover_url && (
                    <div className="timeline-book-cover">
                      <img
                        src={episode.book.cover_url}
                        alt={episode.book.title}
                        title={episode.book.title}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
