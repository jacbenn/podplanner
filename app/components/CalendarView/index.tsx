import { useState, useMemo } from "react";
import type { Episode, Podcast, Book } from "~/types/models";
import type { LinksFunction } from "@remix-run/node";
import EpisodeChip, { links as episodeChipLinks } from "~/components/EpisodeChip";
import styles from "./styles.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  ...episodeChipLinks(),
];

interface EpisodeWithDetails extends Episode {
  podcast: Podcast;
  book?: Book;
}

interface CalendarViewProps {
  episodes: EpisodeWithDetails[];
}

interface CalendarCell {
  type: "empty" | "day";
  date?: Date;
  dateString?: string;
}

export default function CalendarView({ episodes }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const todayString = useMemo(() => {
    const today = new Date();
    return formatDateString(today);
  }, []);

  // Group episodes by filming_date
  const episodeMap = useMemo(() => {
    const map = new Map<string, EpisodeWithDetails[]>();
    episodes.forEach((ep) => {
      if (ep.filming_date) {
        const key = ep.filming_date; // assuming it's already in "YYYY-MM-DD" format
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(ep);
      }
    });
    return map;
  }, [episodes]);

  // Get undated episodes
  const undatedEpisodes = useMemo(
    () => episodes.filter((ep) => !ep.filming_date),
    [episodes]
  );

  // Compute calendar grid
  const calendarCells = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const leadingOffset = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: CalendarCell[] = [];

    // Add leading empty cells
    for (let i = 0; i < leadingOffset; i++) {
      cells.push({ type: "empty" });
    }

    // Add day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = formatDateString(date);
      cells.push({ type: "day", date, dateString });
    }

    // Add trailing empty cells
    const totalCells = cells.length;
    const trailingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trailingCells; i++) {
      cells.push({ type: "empty" });
    }

    return cells;
  }, [currentMonth]);

  const monthName = useMemo(
    () =>
      new Date(currentMonth.year, currentMonth.month, 1).toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric" }
      ),
    [currentMonth]
  );

  const handlePrevMonth = () => {
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          className="btn btn-secondary"
          onClick={handlePrevMonth}
          type="button"
        >
          ← Prev
        </button>
        <h2 className="calendar-month-title">{monthName}</h2>
        <button
          className="btn btn-secondary"
          onClick={handleNextMonth}
          type="button"
        >
          Next →
        </button>
      </div>

      <div className="calendar-day-labels">
        {dayLabels.map((label) => (
          <div key={label} className="calendar-day-label">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarCells.map((cell, index) => {
          if (cell.type === "empty") {
            return (
              <div key={`empty-${index}`} className="calendar-cell calendar-cell--empty" />
            );
          }

          const { dateString } = cell;
          const isToday = dateString === todayString;
          const episodesOnDay = episodeMap.get(dateString!) || [];
          const visibleEpisodes = episodesOnDay.slice(0, 2);
          const overflowCount = episodesOnDay.length - 2;

          return (
            <div
              key={dateString}
              className={`calendar-cell ${isToday ? "calendar-cell--today" : ""}`}
            >
              <span className="calendar-cell__day-number">
                {cell.date!.getDate()}
              </span>
              <div className="calendar-cell__episodes">
                {visibleEpisodes.map((ep) => (
                  <EpisodeChip key={ep.id} episode={ep} />
                ))}
                {overflowCount > 0 && (
                  <div className="calendar-cell__overflow">
                    +{overflowCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undatedEpisodes.length > 0 && (
        <div className="calendar-undated">
          <h3>Undated Episodes</h3>
          <div className="calendar-undated-list">
            {undatedEpisodes.map((ep) => (
              <EpisodeChip key={ep.id} episode={ep} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
