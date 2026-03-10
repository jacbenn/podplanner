import { useRef, useState, useEffect } from "react";
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  LinksFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, Link, useNavigate } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import type { Podcast, MeetingNote, ActionItem } from "~/types/models";
import { randomUUID } from "crypto";
import styles from "./planner.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

interface LoaderData {
  podcast: Podcast;
  currentNote: MeetingNote | null;
  allDates: Array<{ id: string; note_date: string }>;
  selectedDate: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (!podcastId) {
    throw new Response("Missing podcast ID", { status: 400 });
  }

  // Check access
  const { data: accessCheck } = await supabase
    .from("podcast_access")
    .select("*")
    .eq("podcast_id", podcastId)
    .eq("user_id", user.id)
    .single();

  if (!accessCheck) {
    throw new Response("Access denied", { status: 403 });
  }

  // Fetch podcast
  const { data: podcast } = await supabase
    .from("podcasts")
    .select("*")
    .eq("id", podcastId)
    .single();

  // Get selected date from search params, default to today
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const todayString = new Date().toISOString().split("T")[0];
  const selectedDate = dateParam || todayString;

  // Fetch all meeting dates for sidebar
  const { data: allDates } = await supabase
    .from("podcast_meeting_notes")
    .select("id, note_date")
    .eq("podcast_id", podcastId)
    .order("note_date", { ascending: false });

  // Fetch current date's note
  const { data: currentNote } = await supabase
    .from("podcast_meeting_notes")
    .select("*")
    .eq("podcast_id", podcastId)
    .eq("note_date", selectedDate)
    .maybeSingle();

  return json(
    {
      podcast,
      currentNote,
      allDates: allDates || [],
      selectedDate,
    },
    { headers }
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (!podcastId) {
    throw new Response("Missing podcast ID", { status: 400 });
  }

  // Check access
  const { data: accessCheck } = await supabase
    .from("podcast_access")
    .select("*")
    .eq("podcast_id", podcastId)
    .eq("user_id", user.id)
    .single();

  if (!accessCheck) {
    throw new Response("Access denied", { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;
  const noteDate = formData.get("note_date") as string;

  if (!noteDate) {
    return json({ error: "Missing note_date" }, { status: 400 });
  }

  try {
    if (intent === "save_meeting_notes") {
      const agenda = formData.get("agenda") as string;
      const notes = formData.get("notes") as string;
      await supabase.from("podcast_meeting_notes").upsert(
        {
          podcast_id: podcastId,
          note_date: noteDate,
          agenda: agenda ?? null,
          notes: notes ?? null,
        },
        { onConflict: "podcast_id,note_date" }
      );
      return json({ success: true }, { headers });
    }

    if (intent === "add_action_item") {
      const text = formData.get("action_text") as string;
      if (!text || text.trim() === "") {
        return json({ error: "Action text required" }, { status: 400 });
      }

      // Fetch current note to get existing action items
      const { data: existingNote } = await supabase
        .from("podcast_meeting_notes")
        .select("action_items")
        .eq("podcast_id", podcastId)
        .eq("note_date", noteDate)
        .maybeSingle();

      const currentItems = (existingNote?.action_items || []) as ActionItem[];
      const newItem: ActionItem = {
        id: randomUUID(),
        text: text.trim(),
        done: false,
      };

      await supabase.from("podcast_meeting_notes").upsert(
        {
          podcast_id: podcastId,
          note_date: noteDate,
          action_items: [...currentItems, newItem],
        },
        { onConflict: "podcast_id,note_date" }
      );

      return json({ success: true }, { headers });
    }

    if (intent === "toggle_action_item") {
      const itemId = formData.get("item_id") as string;

      const { data: existingNote } = await supabase
        .from("podcast_meeting_notes")
        .select("action_items")
        .eq("podcast_id", podcastId)
        .eq("note_date", noteDate)
        .maybeSingle();

      const currentItems = (existingNote?.action_items || []) as ActionItem[];
      const updatedItems = currentItems.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      );

      await supabase.from("podcast_meeting_notes").upsert(
        {
          podcast_id: podcastId,
          note_date: noteDate,
          action_items: updatedItems,
        },
        { onConflict: "podcast_id,note_date" }
      );

      return json({ success: true }, { headers });
    }

    if (intent === "delete_action_item") {
      const itemId = formData.get("item_id") as string;

      const { data: existingNote } = await supabase
        .from("podcast_meeting_notes")
        .select("action_items")
        .eq("podcast_id", podcastId)
        .eq("note_date", noteDate)
        .maybeSingle();

      const currentItems = (existingNote?.action_items || []) as ActionItem[];
      const updatedItems = currentItems.filter((item) => item.id !== itemId);

      await supabase.from("podcast_meeting_notes").upsert(
        {
          podcast_id: podcastId,
          note_date: noteDate,
          action_items: updatedItems,
        },
        { onConflict: "podcast_id,note_date" }
      );

      return json({ success: true }, { headers });
    }

    if (intent === "delete_meeting") {
      await supabase
        .from("podcast_meeting_notes")
        .delete()
        .eq("podcast_id", podcastId)
        .eq("note_date", noteDate);

      const todayString = new Date().toISOString().split("T")[0];
      return json({ success: true, redirectTo: `?date=${todayString}` }, { headers });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
}

export default function PlannerPage() {
  const { podcast, currentNote, allDates, selectedDate } =
    useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const actionInputRef = useRef<HTMLInputElement>(null);
  const agendaRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Track save status from fetcher
  useEffect(() => {
    if (fetcher.state === "submitting") {
      setSaveStatus("saving");
    } else if (fetcher.state === "idle") {
      if (fetcher.data?.error) {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else if (fetcher.data?.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSave = () => {
    const agenda = agendaRef.current?.value ?? "";
    const notes = notesRef.current?.value ?? "";

    const formData = new FormData();
    formData.append("_intent", "save_meeting_notes");
    formData.append("note_date", selectedDate);
    formData.append("agenda", agenda);
    formData.append("notes", notes);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleAddActionItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = actionInputRef.current?.value || "";
    if (!text.trim()) return;

    const formData = new FormData();
    formData.append("_intent", "add_action_item");
    formData.append("note_date", selectedDate);
    formData.append("action_text", text);
    fetcher.submit(formData, { method: "POST" });

    if (actionInputRef.current) {
      actionInputRef.current.value = "";
    }
  };

  const handleToggleActionItem = (itemId: string) => {
    const formData = new FormData();
    formData.append("_intent", "toggle_action_item");
    formData.append("note_date", selectedDate);
    formData.append("item_id", itemId);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleDeleteActionItem = (itemId: string) => {
    const formData = new FormData();
    formData.append("_intent", "delete_action_item");
    formData.append("note_date", selectedDate);
    formData.append("item_id", itemId);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleDeleteMeeting = () => {
    const formData = new FormData();
    formData.append("_intent", "delete_meeting");
    formData.append("note_date", selectedDate);
    fetcher.submit(formData, { method: "POST" });
    setShowDeleteConfirm(false);
  };

  const todayString = new Date().toISOString().split("T")[0];

  return (
    <div
      className="planner-page"
      style={
        {
          "--podcast-accent": podcast?.accent_color || "#0066cc",
        } as React.CSSProperties
      }
    >
      {/* Sidebar */}
      <div className="planner-sidebar">
        <div>
          <h3>📅 Past Meetings</h3>
          {allDates.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: "10px 0 0 0" }}>
              No past meetings
            </p>
          ) : (
            <ul className="planner-dates-list">
              {allDates.map((date) => (
                <li key={date.id}>
                  <Link
                    to={`?date=${date.note_date}`}
                    className={`planner-date-item ${
                      date.note_date === selectedDate ? "active" : ""
                    }`}
                  >
                    {formatDateDisplay(date.note_date)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {currentNote && (
          <div className="planner-sidebar-actions">
            <button
              className="planner-delete-button"
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑️ Delete This Meeting
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "30px" }}
          >
            <h2 style={{ margin: "0 0 12px 0" }}>Delete Meeting?</h2>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-secondary)" }}>
              Are you sure you want to delete this meeting on {formatDateDisplay(selectedDate)}?
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteMeeting}
                disabled={fetcher.state === "submitting"}
              >
                {fetcher.state === "submitting" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="planner-content">
        <div className="planner-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1>{podcast?.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p>{formatDateDisplay(selectedDate)}</p>
                {saveStatus === "saving" && (
                  <span className="save-indicator saving">Saving...</span>
                )}
                {saveStatus === "saved" && (
                  <span className="save-indicator saved">✓ Saved</span>
                )}
                {saveStatus === "error" && (
                  <span className="save-indicator error">✗ Save failed</span>
                )}
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "20px",
                padding: "0",
              }}
              title="Go back"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Agenda Section */}
        <div className="planner-section">
          <h2>📋 Agenda</h2>
          <textarea
            key={`agenda-${selectedDate}`}
            ref={agendaRef}
            className="planner-textarea"
            placeholder="What do you need to discuss?"
            defaultValue={currentNote?.agenda || ""}
          />
        </div>

        {/* Notes Section */}
        <div className="planner-section">
          <h2>📝 Notes / Outcomes</h2>
          <textarea
            key={`notes-${selectedDate}`}
            ref={notesRef}
            className="planner-textarea"
            placeholder="What was decided? What are the outcomes?"
            defaultValue={currentNote?.notes || ""}
          />
        </div>

        {/* Action Items Section */}
        <div className="planner-section">
          <h2>✅ Action Items</h2>
          <ul className="action-items-list">
            {(currentNote?.action_items || []).map((item) => (
              <li key={item.id} className={`action-item ${item.done ? "done" : ""}`}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleToggleActionItem(item.id)}
                />
                <span className="action-item-text">{item.text}</span>
                <button
                  className="action-item-delete"
                  onClick={() => handleDeleteActionItem(item.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddActionItem} className="add-action-item-form">
            <input
              key={`input-${selectedDate}`}
              ref={actionInputRef}
              type="text"
              className="add-action-item-input"
              placeholder="Add an action item..."
              disabled={fetcher.state === "submitting"}
            />
            <button
              type="submit"
              className="add-action-item-button"
              disabled={fetcher.state === "submitting"}
            >
              {fetcher.state === "submitting" ? "..." : "Add"}
            </button>
          </form>
        </div>

        {/* Save Button */}
        <div className="planner-save-section">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
