import { redirect } from "@remix-run/node";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { getSession } from "~/utils/session.server";

export async function requireUser(request: Request) {
  const session = await getSession(request);

  if (!session.has("userId")) {
    throw redirect("/login");
  }

  const userId = session.get("userId");
  const userEmail = session.get("userEmail");
  const { supabase, headers } = createSupabaseServerClient(request);

  return {
    user: { id: userId, email: userEmail },
    supabase,
    headers,
  };
}
