import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { searchBooks } from "~/utils/bookSearch";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return json({ results: [] });
  }

  try {
    const results = await searchBooks(query);
    return json({ results });
  } catch (error) {
    console.error("Book search error:", error);
    return json({ results: [], error: "Failed to search books" }, { status: 500 });
  }
}
