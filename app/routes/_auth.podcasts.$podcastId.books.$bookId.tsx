import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useFetcher, useNavigate, useParams } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import BookSearch from "~/components/BookSearch";
import DeleteConfirmation from "~/components/DeleteConfirmation";
import modalStyles from "~/components/DeleteConfirmation/styles.css";
import type { Book } from "~/types/models";
import type { LinksFunction } from "@remix-run/node";

interface ActionData {
  error?: string;
  success?: boolean;
}

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: modalStyles },
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

    return json({ success: true }, { headers });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title"));
  const author = String(formData.get("author"));
  const status = String(formData.get("status")) as any;
  const bookNotes = formData.get("book_notes") || null;
  const coverUrl = formData.get("cover_url") || null;

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
      cover_url: coverUrl,
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
  const actionData = useActionData<ActionData>();
  const { podcastId } = useParams();
  const navigate = useNavigate();
  const deleteFetcher = useFetcher();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [coverUrl, setCoverUrl] = useState(book.cover_url || "");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Handle deletion response
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      // Deletion completed, navigate back to podcast page
      navigate(`/podcasts/${podcastId}`);
    }
  }, [deleteFetcher.state, deleteFetcher.data, navigate, podcastId]);

  const handleBookSelect = (selectedBook: {
    title: string;
    author: string;
    cover_url: string | null;
  }) => {
    setTitle(selectedBook.title);
    setAuthor(selectedBook.author);
    setCoverUrl(selectedBook.cover_url || "");
  };

  return (
    <div className="book-form">
      <div className="form-header">
        <h2>Edit Book</h2>
        <div className="book-current-info">
          <p><strong>{book.title}</strong> by {book.author}</p>
        </div>
      </div>

      <Form method="post" className="form" id="book-form">
        <div className="form-group">
          <label>Search to update book details</label>
          <BookSearch onSelect={handleBookSelect} />
        </div>

        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="author" value={author} />
        <input type="hidden" name="cover_url" value={coverUrl} />

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
            type="button"
            className="btn btn-danger"
            onClick={() => setDeleteConfirm(true)}
          >
            Delete Book
          </button>
        </div>
      </Form>

      <DeleteConfirmation
        open={deleteConfirm}
        title="Delete Book"
        message={`Are you sure you want to delete the book "${book.title}"? This cannot be undone.`}
        onConfirm={() => {
          deleteFetcher.submit({}, { method: "delete" });
          setDeleteConfirm(false);
        }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
