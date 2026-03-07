import { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import BookSearch from "~/components/BookSearch";
import type { Episode, Book } from "~/types/models";

export async function loader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId, episodeId } = params;

  if (!podcastId || !episodeId) {
    throw new Response("Missing parameters", { status: 400 });
  }

  // Check access
  const { data: accessCheck } = await supabase
    .from("podcast_access")
    .select("*")
    .eq("podcast_id", podcastId)
    .eq("user_id", user.id)
    .single();

  if (!accessCheck) {
    throw new Response("Access denied", { status: 403 });
  }

  // Fetch episode
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .eq("podcast_id", podcastId)
    .single();

  if (episodeError || !episode) {
    throw new Response("Episode not found", { status: 404 });
  }

  // Fetch current book if assigned
  let currentBook: Book | null = null;
  if (episode.book_id) {
    const { data: book } = await supabase
      .from("books")
      .select("*")
      .eq("id", episode.book_id)
      .single();
    currentBook = book;
  }

  return json(
    { episode: episode as Episode, currentBook },
    { headers }
  );
}

export async function action({
  request,
  params,
}: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId, episodeId } = params;

  if (request.method === "DELETE") {
    const { error } = await supabase
      .from("episodes")
      .delete()
      .eq("id", episodeId)
      .eq("podcast_id", podcastId);

    if (error) {
      return json({ error: error.message }, { status: 500, headers });
    }

    return redirect(`/podcasts/${podcastId}`, { headers });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title"));
  const episodeNumber = formData.get("episode_number")
    ? Number(formData.get("episode_number"))
    : null;
  const filmingDate = formData.get("filming_date") || null;
  const filmingTime = formData.get("filming_time") || null;
  const status = String(formData.get("status")) as any;
  const notes = formData.get("notes") || null;
  const bookTitle = formData.get("book_title") || null;
  const bookAuthor = formData.get("book_author") || null;
  const bookCoverUrl = formData.get("book_cover_url") || null;

  if (!title) {
    return json({ error: "Title is required" }, { status: 400, headers });
  }

  let bookId = null;

  // Create new book if one was selected from search
  if (bookTitle && bookAuthor) {
    const { data: newBook, error: bookError } = await supabase
      .from("books")
      .insert({
        podcast_id: podcastId,
        title: bookTitle,
        author: bookAuthor,
        cover_url: bookCoverUrl,
        status: "upcoming",
      })
      .select("id")
      .single();

    if (bookError) {
      return json({ error: bookError.message }, { status: 500, headers });
    }

    bookId = newBook?.id;
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

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function EpisodeDetailPage() {
  const { episode, currentBook } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [bookTitle, setBookTitle] = useState(currentBook?.title || "");
  const [bookAuthor, setBookAuthor] = useState(currentBook?.author || "");
  const [bookCoverUrl, setBookCoverUrl] = useState(currentBook?.cover_url || "");

  const handleBookSelect = (book: {
    title: string;
    author: string;
    cover_url: string | null;
  }) => {
    setBookTitle(book.title);
    setBookAuthor(book.author);
    setBookCoverUrl(book.cover_url || "");
  };

  return (
    <div className="episode-form">
      <div className="form-header">
        <h2>Edit Episode</h2>
      </div>

      <Form method="post" className="form">
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

        <div className="form-row">
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

        <div className="form-row">
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
          <label>Book (optional)</label>
          <BookSearch onSelect={handleBookSelect} />
          {currentBook && <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Current: <strong>{currentBook.title}</strong> by {currentBook.author}</p>}
        </div>

        <input type="hidden" name="book_title" value={bookTitle} />
        <input type="hidden" name="book_author" value={bookAuthor} />
        <input type="hidden" name="book_cover_url" value={bookCoverUrl} />

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={5}
            defaultValue={episode.notes || ""}
          />
        </div>

        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Episode
          </button>
          <button
            type="submit"
            formMethod="delete"
            className="btn btn-danger"
            onClick={(e) => {
              if (!confirm("Are you sure you want to delete this episode?")) {
                e.preventDefault();
              }
            }}
          >
            Delete Episode
          </button>
        </div>
      </Form>
    </div>
  );
}
