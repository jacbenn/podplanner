import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useState } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import BookSearch from "~/components/BookSearch";

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

  return json({}, { headers });
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
  const author = String(formData.get("author"));
  const status = String(formData.get("status")) || "upcoming";
  const bookNotes = formData.get("book_notes") || null;
  const coverUrl = formData.get("cover_url") || null;

  if (!title || !author) {
    return json(
      { error: "Title and author are required" },
      { status: 400, headers }
    );
  }

  const { error } = await supabase.from("books").insert({
    podcast_id: podcastId,
    title,
    author,
    status,
    book_notes: bookNotes,
    cover_url: coverUrl,
  });

  if (error) {
    return json({ error: error.message }, { status: 500, headers });
  }

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function NewBookPage() {
  const actionData = useActionData<typeof action>();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const handleBookSelect = (book: {
    title: string;
    author: string;
    cover_url: string | null;
  }) => {
    setTitle(book.title);
    setAuthor(book.author);
    setCoverUrl(book.cover_url || "");
  };

  return (
    <div className="book-form">
      <div className="form-header">
        <h2>New Book</h2>
      </div>

      <Form method="post" className="form">
        <div className="form-group">
          <label>Search for a book</label>
          <BookSearch onSelect={handleBookSelect} />
        </div>

        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="author" value={author} />
        <input type="hidden" name="cover_url" value={coverUrl} />

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue="upcoming">
            <option value="upcoming">Upcoming</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="book_notes">Notes</label>
          <textarea id="book_notes" name="book_notes" rows={5} />
        </div>

        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!title || !author}>
            Create Book
          </button>
        </div>
      </Form>
    </div>
  );
}
