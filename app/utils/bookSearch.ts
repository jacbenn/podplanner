export interface SearchResult {
  title: string;
  author?: string;
  year?: string;
  coverUrl: string | null;
  isbn?: string;
  coverId?: string;
}

// Search for books from Open Library
export const searchOpenLibrary = async (query: string): Promise<SearchResult[]> => {
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`
    );
    const data = await response.json();

    if (data.docs && data.docs.length > 0) {
      return data.docs.map((doc: any) => ({
        title: doc.title,
        author: doc.author_name?.[0] || "Unknown Author",
        year: doc.first_publish_year?.toString() || "",
        coverUrl: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
        isbn: doc.isbn?.[0],
        coverId: doc.cover_i?.toString(),
      }));
    }
    return [];
  } catch (error) {
    console.error("Open Library search error:", error);
    return [];
  }
};

// Search for books from Google Books (fallback)
export const searchGoogleBooks = async (query: string): Promise<SearchResult[]> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => ({
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.[0] || "Unknown Author",
        year: item.volumeInfo.publishedDate?.substring(0, 4) || "",
        coverUrl:
          item.volumeInfo.imageLinks?.thumbnail ||
          item.volumeInfo.imageLinks?.smallThumbnail ||
          null,
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
      }));
    }
    return [];
  } catch (error) {
    console.error("Google Books search error:", error);
    return [];
  }
};

// Combined search with fallback
export const searchBooks = async (query: string): Promise<SearchResult[]> => {
  let results = await searchOpenLibrary(query);

  // If Open Library returns no results, try Google Books
  if (results.length === 0) {
    results = await searchGoogleBooks(query);
  }

  return results;
};
