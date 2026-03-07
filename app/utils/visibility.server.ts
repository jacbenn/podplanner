import type { SupabaseClient } from "@supabase/supabase-js";
import type { Podcast } from "~/types/models";

export async function getVisiblePodcasts(
  supabase: SupabaseClient,
  userId: string
): Promise<Podcast[]> {
  // Get podcast IDs the user has access to
  const { data: accessRows, error: accessError } = await supabase
    .from("podcast_access")
    .select("podcast_id")
    .eq("user_id", userId);

  console.log("Access rows:", accessRows, "Error:", accessError);

  if (!accessRows || accessRows.length === 0) {
    return [];
  }

  const podcastIds = accessRows.map((row) => row.podcast_id);

  // Get the podcast details
  const { data: podcasts, error: podcastError } = await supabase
    .from("podcasts")
    .select("*")
    .in("id", podcastIds);

  console.log("Podcasts:", podcasts, "Error:", podcastError);

  if (!podcasts) {
    return [];
  }

  // Get their visibility preferences
  const { data: prefs } = await supabase
    .from("user_visibility_prefs")
    .select("podcast_id, is_visible")
    .eq("user_id", userId);

  const prefMap = new Map(prefs?.map((p) => [p.podcast_id, p.is_visible]) ?? []);

  return (podcasts as Podcast[]).map((podcast) => ({
    ...podcast,
    is_visible: prefMap.get(podcast.id) ?? true,
  }));
}

export async function toggleVisibility(
  supabase: SupabaseClient,
  userId: string,
  podcastId: string,
  isVisible: boolean
) {
  return supabase
    .from("user_visibility_prefs")
    .upsert({ user_id: userId, podcast_id: podcastId, is_visible: isVisible });
}
