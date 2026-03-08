import { useState, useEffect, useRef } from "react";
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
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setQuery("");
        setResults([]);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
    <div className="book-search" ref={searchRef}>
      <div className="book-search-input-group">
        <div className="book-search-input-wrapper">
          <input
            type="text"
            placeholder="Search for a book..."
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

        <button
          type="button"
          className="book-search-add-btn"
          disabled={!query.trim()}
          onClick={() => {
            if (query.trim()) {
              // Trigger search on button click if there are results
              if (results.length > 0) {
                handleSelect(results[0]);
              }
            }
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
