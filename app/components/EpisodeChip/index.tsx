import { Link } from "@remix-run/react";
import type { Episode, Podcast, Book } from "~/types/models";
import type { LinksFunction } from "@remix-run/node";
import styles from "./styles.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

interface EpisodeWithDetails extends Episode {
  podcast: Podcast;
  book?: Book;
}

interface EpisodeChipProps {
  episode: EpisodeWithDetails;
}

export default function EpisodeChip({ episode }: EpisodeChipProps) {
  return (
    <Link
      to={`/podcasts/${episode.podcast_id}/episodes/${episode.id}`}
      className="episode-chip"
      style={
        {
          "--podcast-accent": episode.podcast.accent_color,
        } as React.CSSProperties
      }
      title={episode.title}
    >
      {episode.title}
    </Link>
  );
}
