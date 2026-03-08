import { useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useNavigate, useParams } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
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

  // Reject "new" as an episode ID - it should use the .new route
  if (episodeId === "new") {
    throw new Response("Invalid episode ID", { status: 400 });
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

  // Fetch existing episode
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
    { episode: episode as Episode, currentBook, isNew: false },
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

    return json({ success: true }, { headers });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const title = formData.get("title");
  const episodeNumber = formData.get("episode_number")
    ? Number(formData.get("episode_number"))
    : null;
  const filmingDate = formData.get("filming_date") || null;
  const filmingTime = formData.get("filming_time") || null;
  const status = formData.get("status") || null;
  const notes = formData.get("notes") || null;
  const bookId = formData.get("book_id") || null;

  // Fetch current episode to check if book_id is already set
  const { data: currentEpisode } = await supabase
    .from("episodes")
    .select("book_id")
    .eq("id", episodeId)
    .eq("podcast_id", podcastId)
    .single();

  // Build update object with only provided fields
  const updateData: Record<string, any> = {};
  if (title) updateData.title = title;
  if (episodeNumber !== null) updateData.episode_number = episodeNumber;
  if (filmingDate) updateData.filming_date = filmingDate;
  if (filmingTime) updateData.filming_time = filmingTime;
  if (status) updateData.status = status;
  if (notes) updateData.notes = notes;
  // Only set book_id if it's not already set (preserve first book selected)
  if (bookId !== null && !currentEpisode?.book_id) {
    updateData.book_id = bookId;
  }

  if (Object.keys(updateData).length === 0) {
    return json({ error: "No fields to update" }, { status: 400, headers });
  }

  // Update existing episode
  const { error } = await supabase
    .from("episodes")
    .update(updateData)
    .eq("id", episodeId)
    .eq("podcast_id", podcastId);

  if (error) {
    return json({ error: error.message }, { status: 500, headers });
  }

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function EpisodeDetailPage() {
  const { podcastId } = useParams();
  const navigate = useNavigate();

  // Redirect to podcast page - editing happens inline on the podcast detail page
  useEffect(() => {
    navigate(`/podcasts/${podcastId}`);
  }, [podcastId, navigate]);

  return null;
}
