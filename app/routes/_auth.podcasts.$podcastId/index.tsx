import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useFetcher } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Podcast, Episode, Book } from "~/types/models";
import DeleteConfirmation from "~/components/DeleteConfirmation";
import BookSearch from "~/components/BookSearch";
import BookSearchModal from "~/components/BookSearchModal";
import styles from "./podcast.css";
import modalStyles from "~/components/DeleteConfirmation/styles.css";
import bookModalStyles from "~/components/BookSearchModal/styles.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: modalStyles },
  { rel: "stylesheet", href: bookModalStyles },
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

  // Attach book data to episodes
  const booksMap = new Map(books?.map((b) => [b.id, b]) || []);
  const episodesWithBooks = (episodes || []).map((ep) => ({
    ...ep,
    book: ep.book_id ? booksMap.get(ep.book_id) : null,
  }));

  return json(
    {
      podcast: podcast as Podcast,
      episodes: episodesWithBooks as any[],
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

  return json({ success: true }, { headers });
}

export default function PodcastPage() {
  const { podcast, episodes: initialEpisodes, books } = useLoaderData<typeof loader>();
  const deleteFetcher = useFetcher();
  const episodeFetcher = useFetcher();
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [addBookModalOpen, setAddBookModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "episode" | "book" | null;
    id: string | null;
    title: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: "",
  });

  // Reload page when book deletion completes
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      // Reload to refresh the episode/book list
      window.location.reload();
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  const handleDeleteClick = (
    e: React.MouseEvent,
    type: "episode" | "book",
    id: string,
    title: string
  ) => {
    e.preventDefault();
    setDeleteConfirm({
      isOpen: true,
      type,
      id,
      title,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm.id && deleteConfirm.type) {
      deleteFetcher.submit(
        { type: deleteConfirm.type, id: deleteConfirm.id },
        { method: "delete" }
      );
    }
    setDeleteConfirm({ isOpen: false, type: null, id: null, title: "" });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, type: null, id: null, title: "" });
  };

  const deleteMessage =
    deleteConfirm.type === "episode"
      ? `Are you sure you want to delete the episode "${deleteConfirm.title}"? This cannot be undone.`
      : `Are you sure you want to delete the book "${deleteConfirm.title}"? This cannot be undone.`;

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
            <h2>Episode</h2>
          </div>
          {episodes.length === 0 ? (
            <p className="empty-state">No episodes yet</p>
          ) : (
            <div className="episodes-list">
              {episodes.map((episode) => (
                <EpisodeCard
                  key={episode.id}
                  episode={episode}
                  podcast={podcast}
                  onEditClick={() => setEditingEpisodeId(episode.id)}
                  onDeleteClick={(e) =>
                    handleDeleteClick(e, "episode", episode.id, episode.title)
                  }
                />
              ))}
              {editingEpisodeId && (
                <EpisodeEditModal
                  episodeId={editingEpisodeId}
                  episode={episodes.find((e) => e.id === editingEpisodeId)!}
                  podcast={podcast}
                  episodeFetcher={episodeFetcher}
                  onClose={() => setEditingEpisodeId(null)}
                  onDeleteClick={() => {
                    const ep = episodes.find((e) => e.id === editingEpisodeId);
                    if (ep) {
                      handleDeleteClick(new MouseEvent("click") as any, "episode", ep.id, ep.title);
                    }
                    setEditingEpisodeId(null);
                  }}
                />
              )}
            </div>
          )}
        </section>

        <section className="books-section">
          <div className="section-header">
            <h2>Books</h2>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAddBookModalOpen(true)}
            >
              Add Book
            </button>
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
                    {book.cover_url && (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="book-cover-img"
                      />
                    )}
                    <div className="book-info">
                      <h3>{book.title}</h3>
                      <p className="author">{book.author}</p>
                      <span className={`status-badge status-${book.status}`}>
                        {book.status}
                      </span>
                    </div>
                  </Link>
                  <div className="delete-form">
                    <button
                      type="button"
                      className="btn-delete"
                      title="Delete book"
                      onClick={(e) =>
                        handleDeleteClick(e, "book", book.id, book.title)
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DeleteConfirmation
        open={deleteConfirm.isOpen}
        title={
          deleteConfirm.type === "episode" ? "Delete Episode" : "Delete Book"
        }
        message={deleteMessage}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <BookSearchModal
        open={addBookModalOpen}
        onClose={() => setAddBookModalOpen(false)}
        podcastId={podcast.id}
      />
    </div>
  );
}

interface EpisodeCardProps {
  episode: Episode & { book?: Book | null };
  podcast: Podcast;
  onEditClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
}

function EpisodeCard({
  episode,
  onEditClick,
  onDeleteClick,
}: EpisodeCardProps) {
  return (
    <div className="episode-card-wrapper">
      <button
        type="button"
        className="episode-card"
        onClick={onEditClick}
      >
        <div className="episode-main">
          <div>
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
          </div>
          {episode.book && episode.book.cover_url && (
            <div className="episode-book-cover">
              <img
                src={episode.book.cover_url}
                alt={episode.book.title}
                title={episode.book.title}
              />
            </div>
          )}
        </div>
      </button>

      <div className="delete-form">
        <button
          type="button"
          className="btn-delete"
          title="Delete episode"
          onClick={onDeleteClick}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface EpisodeEditModalProps {
  episodeId: string;
  episode: Episode & { book?: Book | null };
  podcast: Podcast;
  episodeFetcher: ReturnType<typeof useFetcher>;
  onClose: () => void;
  onDeleteClick: () => void;
}

function EpisodeEditModal({
  episodeId,
  episode,
  podcast,
  episodeFetcher,
  onClose,
  onDeleteClick,
}: EpisodeEditModalProps) {
  const Form = episodeFetcher.Form;
  const [formData, setFormData] = useState({
    title: episode.title,
    episode_number: episode.episode_number || "",
    status: episode.status,
    filming_date: episode.filming_date || "",
    filming_time: episode.filming_time || "",
    notes: episode.notes || "",
    book_title: episode.book?.title || "",
    book_author: episode.book?.author || "",
    book_cover_url: episode.book?.cover_url || "",
  });

  const handleBookSelect = (book: {
    title: string;
    author: string;
    cover_url: string | null;
  }) => {
    setFormData({
      ...formData,
      book_title: book.title,
      book_author: book.author,
      book_cover_url: book.cover_url || "",
    });
  };

  // Close on successful submission
  useEffect(() => {
    if (episodeFetcher.state === "idle" && episodeFetcher.data?.success !== false) {
      if (episodeFetcher.data && Object.keys(episodeFetcher.data).length > 0) {
        onClose();
      }
    }
  }, [episodeFetcher.state, episodeFetcher.data, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{episode.title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <Form
          method="post"
          action={`/podcasts/${podcast.id}/episodes/${episodeId}`}
          className="episode-edit-form"
        >
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          <div className="episode-edit-fields">
            <div className="form-group">
              <label htmlFor="episode_number">Episode Number</label>
              <input
                id="episode_number"
                name="episode_number"
                type="number"
                value={formData.episode_number}
                onChange={(e) =>
                  setFormData({ ...formData, episode_number: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
              >
                <option value="planning">Planning</option>
                <option value="recorded">Recorded</option>
                <option value="published">Published</option>
                <option value="aired">Aired</option>
              </select>
            </div>
          </div>

          <div className="episode-edit-fields">
            <div className="form-group">
              <label htmlFor="filming_date">Filming Date</label>
              <input
                id="filming_date"
                name="filming_date"
                type="date"
                value={formData.filming_date}
                onChange={(e) =>
                  setFormData({ ...formData, filming_date: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="filming_time">Filming Time</label>
              <input
                id="filming_time"
                name="filming_time"
                type="time"
                value={formData.filming_time}
                onChange={(e) =>
                  setFormData({ ...formData, filming_time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label>Book (optional)</label>
            <BookSearch onSelect={handleBookSelect} />
            {formData.book_title && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Current: <strong>{formData.book_title}</strong> by{" "}
                {formData.book_author}
              </p>
            )}
          </div>

          <input type="hidden" name="book_title" value={formData.book_title} />
          <input type="hidden" name="book_author" value={formData.book_author} />
          <input
            type="hidden"
            name="book_cover_url"
            value={formData.book_cover_url}
          />

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>

          <div className="episode-edit-actions">
            <button type="submit" className="btn btn-primary">
              Save Episode
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={(e) => {
                e.preventDefault();
                onDeleteClick();
              }}
            >
              Delete Episode
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
