import type { SupabaseClient } from "@supabase/supabase-js";
import type { Podcast } from "~/types/models";

export async function getVisiblePodcasts(
  supabase: SupabaseClient,
  userId: string
): Promise<Podcast[]> {
  // Get all podcasts the user has access to with their details
  const { data: accessRows } = await supabase
    .from("podcast_access")
    .select("podcast_id, podcasts(*)")
    .eq("user_id", userId);

  if (!accessRows || accessRows.length === 0) {
    return [];
  }

  // Get their visibility preferences
  const { data: prefs } = await supabase
    .from("user_visibility_prefs")
    .select("podcast_id, is_visible")
    .eq("user_id", userId);

  const prefMap = new Map(prefs?.map((p) => [p.podcast_id, p.is_visible]) ?? []);

  return (accessRows as any[]).map((row) => ({
    ...(row.podcasts as Podcast),
    is_visible: prefMap.get(row.podcast_id) ?? true,
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
