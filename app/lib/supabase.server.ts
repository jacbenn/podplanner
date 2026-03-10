import pkg from "@supabase/ssr";
const { createServerClient, parseCookieHeader, serializeCookieHeader } = pkg;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export function createSupabaseServerClient(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env: SUPABASE_URL and SUPABASE_ANON_KEY are required. " +
        "Copy .env.example to .env and add your project URL and anon key from " +
        "https://supabase.com/dashboard/project/_/settings/api"
    );
  }

  const headers = new Headers();

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            headers.append(
              "Set-Cookie",
              serializeCookieHeader(name, value, options)
            );
          });
        },
      },
    }
  );

  return { supabase, headers };
}
