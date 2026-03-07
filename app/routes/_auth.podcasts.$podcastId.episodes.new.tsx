import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import styles from "./$podcastId/episode-form.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (!podcastId) {
    throw new Response("Podcast ID required", { status: 400 });
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

  // Fetch books for this podcast
  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("podcast_id", podcastId)
    .order("created_at", { ascending: false });

  return json({ books: books || [] }, { headers });
}

export async function action({
  request,
  params,
}: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

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
  const status = String(formData.get("status")) || "planning";
  const bookId = formData.get("book_id") || null;
  const notes = formData.get("notes") || null;

  if (!title) {
    return json({ error: "Title is required" }, { status: 400, headers });
  }

  const { error } = await supabase
    .from("episodes")
    .insert({
      podcast_id: podcastId,
      title,
      episode_number: episodeNumber,
      filming_date: filmingDate,
      filming_time: filmingTime,
      status,
      book_id: bookId,
      notes,
    });

  if (error) {
    return json({ error: error.message }, { status: 500, headers });
  }

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function NewEpisodePage() {
  const { books } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="episode-form">
      <div className="form-header">
        <h2>New Episode</h2>
      </div>

      <Form method="post" className="form">
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input id="title" name="title" type="text" required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="episode_number">Episode Number</label>
            <input id="episode_number" name="episode_number" type="number" />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue="planning">
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
            <input id="filming_date" name="filming_date" type="date" />
          </div>

          <div className="form-group">
            <label htmlFor="filming_time">Filming Time</label>
            <input id="filming_time" name="filming_time" type="time" />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="book_id">Book (optional)</label>
          <select id="book_id" name="book_id" defaultValue="">
            <option value="">None</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} by {book.author}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={5} />
        </div>

        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create Episode
          </button>
        </div>
      </Form>
    </div>
  );
}
