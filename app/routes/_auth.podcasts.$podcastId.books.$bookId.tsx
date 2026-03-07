import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Book } from "~/types/models";
import styles from "./$podcastId/book-form.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId, bookId } = params;

  if (!podcastId || !bookId) {
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

  // Fetch book
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("podcast_id", podcastId)
    .single();

  if (bookError || !book) {
    throw new Response("Book not found", { status: 404 });
  }

  return json({ book: book as Book }, { headers });
}

export async function action({
  request,
  params,
}: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId, bookId } = params;

  if (request.method === "DELETE") {
    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", bookId)
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
  const author = String(formData.get("author"));
  const status = String(formData.get("status")) as any;
  const bookNotes = formData.get("book_notes") || null;

  if (!title || !author) {
    return json(
      { error: "Title and author are required" },
      { status: 400, headers }
    );
  }

  const { error } = await supabase
    .from("books")
    .update({
      title,
      author,
      status,
      book_notes: bookNotes,
    })
    .eq("id", bookId)
    .eq("podcast_id", podcastId);

  if (error) {
    return json({ error: error.message }, { status: 500, headers });
  }

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function BookDetailPage() {
  const { book } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="book-form">
      <div className="form-header">
        <h2>Edit Book</h2>
      </div>

      <Form method="post" className="form">
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            defaultValue={book.title}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="author">Author *</label>
          <input
            id="author"
            name="author"
            type="text"
            defaultValue={book.author}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={book.status}>
            <option value="upcoming">Upcoming</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="book_notes">Notes</label>
          <textarea
            id="book_notes"
            name="book_notes"
            rows={5}
            defaultValue={book.book_notes || ""}
          />
        </div>

        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Book
          </button>
          <button
            type="submit"
            formMethod="delete"
            className="btn btn-danger"
            onClick={(e) => {
              if (!confirm("Are you sure you want to delete this book?")) {
                e.preventDefault();
              }
            }}
          >
            Delete Book
          </button>
        </div>
      </Form>
    </div>
  );
}
