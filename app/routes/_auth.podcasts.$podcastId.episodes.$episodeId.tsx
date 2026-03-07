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

    return json({ success: true }, { headers });
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

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function EpisodeDetailPage() {
  const { podcastId } = useParams();
  const navigate = useNavigate();

  // Redirect to podcast page since editing now happens inline
  useEffect(() => {
    navigate(`/podcasts/${podcastId}`);
  }, [podcastId, navigate]);

  return null;
}
