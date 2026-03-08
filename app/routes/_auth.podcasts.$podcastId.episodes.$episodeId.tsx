import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs, LinksFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import type { Episode, Book, Podcast } from "~/types/models";
import BookSearch, { links as bookSearchLinks } from "~/components/BookSearch";
import EpisodeTile from "~/components/EpisodeTile";
import styles from "./podcast.css";
import timelineStyles from "./_auth._index.css";
import type { LinksFunction as RemixLinksFunction } from "@remix-run/node";

export const links: RemixLinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: timelineStyles },
  ...bookSearchLinks(),
];

export async function loader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId, episodeId } = params;

  if (!podcastId || !episodeId) {
    throw new Response("Missing parameters", { status: 400 });
  }

  if (episodeId === "new") {
    throw new Response("Invalid episode ID", { status: 400 });
  }

  const { data: accessCheck } = await supabase
    .from("podcast_access")
    .select("*")
    .eq("podcast_id", podcastId)
    .eq("user_id", user.id)
    .single();

  if (!accessCheck) {
    throw new Response("Access denied", { status: 403 });
  }

  const { data: podcast } = await supabase
    .from("podcasts")
    .select("*")
    .eq("id", podcastId)
    .single();

  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .eq("podcast_id", podcastId)
    .single();

  if (episodeError || !episode) {
    throw new Response("Episode not found", { status: 404 });
  }

  let currentBook: Book | null = null;
  if (episode.book_id) {
    const { data: book } = await supabase
      .from("books")
      .select("*")
      .eq("id", episode.book_id)
      .single();
    currentBook = book;
  }

  // Fetch all books assigned to this episode via the junction table
  let books: Book[] = [];
  const { data: episodeBookLinks } = await supabase
    .from("episode_books")
    .select("book_id")
    .eq("episode_id", episodeId);

  if (episodeBookLinks && episodeBookLinks.length > 0) {
    const bookIds = episodeBookLinks.map((link) => link.book_id);
    const { data: episodeBooks } = await supabase
      .from("books")
      .select("*")
      .in("id", bookIds);
    books = episodeBooks || [];
  }

  return json(
    {
      episode: episode as Episode,
      currentBook,
      podcast: podcast as Podcast,
      books: (books || []) as Book[],
    },
    { headers }
  );
}

export async function action({
  request,
  params,
}: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId, episodeId } = params;

  if (request.method === "POST") {
    const formData = await request.formData();
    const title = String(formData.get("title"));
    const episodeNumber = formData.get("episode_number")
      ? Number(formData.get("episode_number"))
      : null;
    const filmingDate = formData.get("filming_date") || null;
    const filmingTime = formData.get("filming_time") || null;
    const status = String(formData.get("status")) as any;
    const notes = formData.get("notes") || null;
    const bookId = formData.get("book_id") || null;

    if (!title) {
      return json({ error: "Title is required" }, { status: 400, headers });
    }

    const { error } = await supabase
      .from("episodes")
      .update({
        title,
        episode_number: episodeNumber,
        filming_date: filmingDate,
        filming_time: filmingTime,
        status,
        book_id: bookId,
        notes,
      })
      .eq("id", episodeId)
      .eq("podcast_id", podcastId);

    if (error) {
      return json({ error: error.message }, { status: 500, headers });
    }

    return json({ success: true }, { headers });
  }

  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const type = formData.get("type");
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

  // Redirect to episode timeline after deleting
  if (type === "episode") {
    return redirect("/", { headers });
  }

  return json({ success: true }, { headers });
}

export default function EpisodeDetailPage() {
  const { episode, currentBook, podcast, books } = useLoaderData<typeof loader>();
  const deleteFetcher = useFetcher();
  const bookFetcher = useFetcher();
  const editFetcher = useFetcher();
  const wasSubmittingBook = useRef(false);
  const [deleteModal, setDeleteModal] = useState<{ type: "episode" | "book"; id: string } | null>(null);
  const [isEditingEpisode, setIsEditingEpisode] = useState(false);

  useEffect(() => {
    if (bookFetcher.state === "submitting") {
      wasSubmittingBook.current = true;
    }
    if (bookFetcher.state === "idle" && wasSubmittingBook.current && bookFetcher.data) {
      wasSubmittingBook.current = false;
      window.location.reload();
    }
  }, [bookFetcher.state, bookFetcher.data]);

  useEffect(() => {
    if (editFetcher.state === "idle" && (editFetcher.data as any)?.success) {
      setIsEditingEpisode(false);
      window.location.reload();
    }
  }, [editFetcher.state, editFetcher.data]);

  const handleDelete = (type: "episode" | "book", id: string) => {
    setDeleteModal({ type, id });
  };

  const confirmDelete = () => {
    if (deleteModal) {
      deleteFetcher.submit(
        { type: deleteModal.type, id: deleteModal.id },
        { method: "delete" }
      );
      setDeleteModal(null);
    }
  };

  const cancelDelete = () => {
    setDeleteModal(null);
  };

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

      {deleteModal && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm Delete</h2>
            <p>
              Are you sure you want to delete this {deleteModal.type}? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleteFetcher.state === "submitting"}
              >
                {deleteFetcher.state === "submitting" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="podcast-content">
        <section className="timeline-section">
          <div className="timeline">
            {episode && (
              <EpisodeTile
                episode={episode}
                podcast={podcast}
                currentBook={currentBook}
                onDelete={() => handleDelete("episode", episode.id)}
                onEdit={() => setIsEditingEpisode(true)}
                showDeleteButton={true}
              />
            )}
          </div>
        </section>

        <section className="books-section">
          <div className="section-header">
            <h2>Books</h2>
          </div>

          <div className="add-book-section">
            <BookSearch
              onSelect={(book) => {
                const formData = new FormData();
                formData.append("title", book.title);
                formData.append("author", book.author);
                formData.append("cover_url", book.cover_url || "");
                formData.append("status", "upcoming");
                formData.append("episode_id", episode.id);

                bookFetcher.submit(formData, {
                  method: "POST",
                  action: `/podcasts/${podcast.id}/books/new`,
                });
              }}
            />
          </div>

          {books.length === 0 ? (
            <p className="empty-state">No books yet</p>
          ) : (
            <div className="books-list">
              {books.map((book) => (
                <div key={book.id} className="book-card-wrapper">
                  <Link
                    to={`/podcasts/${episode.podcast_id}/books/${book.id}`}
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
                    </div>
                  </Link>
                  <div className="delete-form">
                    <button
                      type="button"
                      className="btn-delete"
                      title="Delete book"
                      onClick={() => handleDelete("book", book.id)}
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

      {isEditingEpisode && (
        <div className="modal-overlay" onClick={() => setIsEditingEpisode(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{episode.title}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsEditingEpisode(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {editFetcher.Form && (
              <editFetcher.Form
                method="post"
                className="episode-edit-form"
              >
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  defaultValue={episode.title}
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
                    defaultValue={episode.episode_number || ""}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={episode.status}
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
                    defaultValue={episode.filming_date || ""}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="filming_time">Filming Time</label>
                  <input
                    id="filming_time"
                    name="filming_time"
                    type="time"
                    defaultValue={episode.filming_time || ""}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  defaultValue={episode.notes || ""}
                />
              </div>

              <div className="episode-edit-actions">
                <button type="submit" className="btn btn-primary">
                  Save Episode
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditingEpisode(false)}>
                  Cancel
                </button>
              </div>
              </editFetcher.Form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
