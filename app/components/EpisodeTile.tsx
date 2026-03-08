import { Link } from "@remix-run/react";
import type { Episode, Book, Podcast } from "~/types/models";

interface EpisodeTileProps {
  episode: Episode;
  podcast: Podcast;
  currentBook?: Book | null;
  onDelete?: (episodeId: string) => void;
  onEdit?: () => void;
  showDeleteButton?: boolean;
}

export default function EpisodeTile({
  episode,
  podcast,
  currentBook,
  onDelete,
  onEdit,
  showDeleteButton = false,
}: EpisodeTileProps) {
  // Use Link if no onEdit handler, button if onEdit is provided
  const TileWrapper = onEdit ? "button" : Link;
  const tileProps = onEdit
    ? {
        type: "button" as const,
        onClick: onEdit,
        style: {
          background: "none",
          border: "none",
          cursor: "pointer",
          width: "100%",
          font: "inherit",
          textAlign: "left" as const,
          padding: 0,
          margin: 0,
        },
      }
    : { to: `/podcasts/${episode.podcast_id}/episodes/${episode.id}` };

  return (
    <div
      className="timeline-item episode-tile"
      style={{
        "--podcast-accent": podcast.accent_color,
      } as any}
    >
      <TileWrapper
        className="episode-tile-link"
        {...tileProps}
      >
        <div className="timeline-date">
          {episode.filming_date
            ? new Date(episode.filming_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                weekday: "short",
              })
            : "No date"}
          {episode.filming_time && (
            <div className="timeline-time">{episode.filming_time}</div>
          )}
        </div>

        <div className="timeline-content">
          <div className="timeline-main">
            <span className="podcast-tag">{podcast.name}</span>
            <div className="episode-header">
              <h3>{episode.title}</h3>
            </div>

            {episode.episode_number && (
              <p className="episode-number">Episode #{episode.episode_number}</p>
            )}

            {currentBook && (
              <div className="book-info">
                <strong>📖 Book:</strong>{" "}
                <span onClick={(e) => e.stopPropagation()}>
                  <Link to={`/podcasts/${episode.podcast_id}/books/${currentBook.id}`}>
                    {currentBook.title}
                  </Link>
                </span>{" "}
                by {currentBook.author}
              </div>
            )}

            <div className="episode-footer">
              <span className={`status-badge status-${episode.status}`}>
                {episode.status}
              </span>
              {episode.notes && (
                <p className="episode-notes">{episode.notes}</p>
              )}
            </div>
          </div>
        </div>
      </TileWrapper>

      {currentBook && currentBook.cover_url && (
        <div className="timeline-book-cover">
          <img
            src={currentBook.cover_url}
            alt={currentBook.title}
            title={currentBook.title}
          />
        </div>
      )}

      {showDeleteButton && onDelete && (
        <div className="delete-form">
          <button
            type="button"
            className="btn-delete"
            title="Delete episode"
            onClick={() => onDelete(episode.id)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
