import { useState, useEffect, useRef } from "react";
import { useFetcher } from "@remix-run/react";
import type { SearchResult } from "~/utils/bookSearch";
import { searchBooks } from "~/utils/bookSearch";
import "./styles.css";

interface BookSearchModalProps {
  open: boolean;
  onClose: () => void;
  podcastId: string;
}

export default function BookSearchModal({
  open,
  onClose,
  podcastId,
}: BookSearchModalProps) {
  const fetcher = useFetcher();
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search when input changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchInput.trim().length >= 2) {
        setIsSearching(true);
        const results = await searchBooks(searchInput);
        setSearchResults(results);
        setShowDropdown(true);
        setIsSearching(false);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close modal and reload when book is created
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      onClose();
      window.location.reload();
    }
  }, [fetcher.state, fetcher.data, onClose]);

  const handleSelectBook = (result: SearchResult) => {
    const formData = new FormData();
    formData.append("title", result.title);
    formData.append("author", result.author || "Unknown Author");
    formData.append("cover_url", result.coverUrl || "");
    formData.append("status", "upcoming");

    fetcher.submit(formData, {
      method: "POST",
      action: `/podcasts/${podcastId}/books/new`,
    });

    setSearchInput("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Search and Add Book</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div
            className="book-search-container"
            ref={dropdownRef}
          >
            <div className="input-wrapper">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by book title or author..."
                className="search-input"
                autoFocus
              />
              {isSearching && (
                <div className="input-loading">
                  <span className="spinner">⟳</span>
                </div>
              )}
            </div>

            {/* Dropdown with search results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="search-result-item"
                    onClick={() => handleSelectBook(result)}
                  >
                    <div className="search-result-cover">
                      {result.coverUrl ? (
                        <img
                          src={result.coverUrl}
                          alt={`${result.title} cover`}
                          className="search-result-cover-img"
                        />
                      ) : (
                        <div className="search-result-cover-placeholder">
                          📖
                        </div>
                      )}
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-title">
                        {result.title}
                      </div>
                      <div className="search-result-meta">
                        {result.author && <span>{result.author}</span>}
                        {result.year && (
                          <span className="search-result-year">
                            {" "}
                            ({result.year})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showDropdown &&
              !isSearching &&
              searchResults.length === 0 &&
              searchInput.trim().length >= 2 && (
                <div className="search-dropdown">
                  <div className="search-no-results">
                    No books found. Try a different search term.
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
