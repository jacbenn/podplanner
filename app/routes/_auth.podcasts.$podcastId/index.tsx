import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Outlet, Form } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Podcast, Episode, Book } from "~/types/models";
import styles from "./podcast.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (!podcastId) {
    throw new Response("Podcast ID required", { status: 400 });
  }

  // Check user has access to this podcast
  const { data: accessCheck, error: accessError } = await supabase
    .from("podcast_access")
    .select("*")
    .eq("podcast_id", podcastId)
    .eq("user_id", user.id)
    .single();

  if (accessError || !accessCheck) {
    throw new Response("You don't have access to this podcast", {
      status: 403,
    });
  }

  // Fetch podcast
  const { data: podcast, error: podcastError } = await supabase
    .from("podcasts")
    .select("*")
    .eq("id", podcastId)
    .single();

  if (podcastError || !podcast) {
    throw new Response("Podcast not found", { status: 404 });
  }

  // Fetch episodes
  const { data: episodes, error: episodesError } = await supabase
    .from("episodes")
    .select("*")
    .eq("podcast_id", podcastId)
    .order("filming_date", { ascending: true });

  // Fetch books
  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("*")
    .eq("podcast_id", podcastId)
    .order("created_at", { ascending: false });

  if (episodesError || booksError) {
    throw new Response("Failed to load podcast data", { status: 500 });
  }

  return json(
    {
      podcast: podcast as Podcast,
      episodes: (episodes || []) as Episode[],
      books: (books || []) as Book[],
    },
    { headers }
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const type = formData.get("type"); // "episode" or "book"
  const id = formData.get("id");

  if (!type || !id) {
    return json({ error: "Missing type or id" }, { status: 400 });
  }

  const { error } = await supabase
    .from(type === "episode" ? "episodes" : "books")
    .delete()
    .eq("id", id)
    .eq("podcast_id", podcastId);

  if (error) {
    return json({ error: error.message }, { status: 500, headers });
  }

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function PodcastPage() {
  const { podcast, episodes, books } = useLoaderData<typeof loader>();

  return (
    <div
      className="podcast-page"
      style={{ "--podcast-accent": podcast.accent_color } as any}
    >
      <div className="podcast-header">
        <h1>{podcast.name}</h1>
        {podcast.description && (
          <p className="description">{podcast.description}</p>
        )}
      </div>

      <div className="podcast-content">
        <section className="episodes-section">
          <div className="section-header">
            <h2>Episodes</h2>
            <Link to="episodes/new" className="btn btn-primary">
              New Episode
            </Link>
          </div>
          {episodes.length === 0 ? (
            <p className="empty-state">No episodes yet</p>
          ) : (
            <div className="episodes-list">
              {episodes.map((episode) => (
                <div key={episode.id} className="episode-card-wrapper">
                  <Link
                    to={`episodes/${episode.id}`}
                    className="episode-card"
                  >
                    <div className="episode-header">
                      {episode.episode_number && (
                        <span className="episode-num">#{episode.episode_number}</span>
                      )}
                      <h3>{episode.title}</h3>
                    </div>
                    {episode.filming_date && (
                      <p className="filming-date">
                        📅 {new Date(episode.filming_date).toLocaleDateString()}
                        {episode.filming_time && ` at ${episode.filming_time}`}
                      </p>
                    )}
                    <span className={`status-badge status-${episode.status}`}>
                      {episode.status}
                    </span>
                  </Link>
                  <Form method="post" className="delete-form">
                    <input type="hidden" name="type" value="episode" />
                    <input type="hidden" name="id" value={episode.id} />
                    <button
                      type="submit"
                      className="btn-delete"
                      onClick={(e) => {
                        if (!confirm("Delete this episode?")) {
                          e.preventDefault();
                        }
                      }}
                      title="Delete episode"
                    >
                      ✕
                    </button>
                  </Form>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="books-section">
          <div className="section-header">
            <h2>Books</h2>
            <Link to="books/new" className="btn btn-primary">
              New Book
            </Link>
          </div>
          {books.length === 0 ? (
            <p className="empty-state">No books yet</p>
          ) : (
            <div className="books-list">
              {books.map((book) => (
                <div key={book.id} className="book-card-wrapper">
                  <Link
                    to={`books/${book.id}`}
                    className="book-card"
                  >
                    <h3>{book.title}</h3>
                    <p className="author">{book.author}</p>
                    <span className={`status-badge status-${book.status}`}>
                      {book.status}
                    </span>
                  </Link>
                  <Form method="post" className="delete-form">
                    <input type="hidden" name="type" value="book" />
                    <input type="hidden" name="id" value={book.id} />
                    <button
                      type="submit"
                      className="btn-delete"
                      onClick={(e) => {
                        if (!confirm("Delete this book?")) {
                          e.preventDefault();
                        }
                      }}
                      title="Delete book"
                    >
                      ✕
                    </button>
                  </Form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Outlet />
    </div>
  );
}
