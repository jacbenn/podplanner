import { useState, useEffect } from "react";
import type { SearchResult } from "~/utils/bookSearch";
import styles from "./styles.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

interface BookSearchProps {
  onSelect: (book: {
    title: string;
    author: string;
    cover_url: string | null;
  }) => void;
}

export default function BookSearch({ onSelect }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 2) {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/books/search?q=${encodeURIComponent(query)}`
          );
          const data = await response.json();
          setResults(data.results || []);
          setShowResults(true);
        } catch (error) {
          console.error("Search error:", error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    onSelect({
      title: result.title,
      author: result.author || "",
      cover_url: result.coverUrl,
    });
    setQuery("");
    setShowResults(false);
  };

  return (
    <div className="book-search">
      <input
        type="text"
        placeholder="Search for a book by title or author..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="book-search-input"
      />

      {loading && <div className="book-search-loading">Searching...</div>}

      {showResults && results.length > 0 && (
        <div className="book-search-results">
          {results.map((result, index) => (
            <button
              key={index}
              type="button"
              className="book-search-result"
              onClick={() => handleSelect(result)}
            >
              {result.coverUrl && (
                <img
                  src={result.coverUrl}
                  alt={result.title}
                  className="book-search-cover"
                />
              )}
              <div className="book-search-info">
                <div className="book-search-title">{result.title}</div>
                <div className="book-search-author">
                  {result.author}
                  {result.year && ` (${result.year})`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && !loading && query.length > 2 && (
        <div className="book-search-empty">No books found</div>
      )}
    </div>
  );
}
