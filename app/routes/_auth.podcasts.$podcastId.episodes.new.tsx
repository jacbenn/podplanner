import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs, LinksFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import styles from "./episode-form-new.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (!podcastId) {
    throw new Response("Podcast ID required", { status: 400 });
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

  // Fetch podcast details for display
  const { data: podcast } = await supabase
    .from("podcasts")
    .select("name, accent_color")
    .eq("id", podcastId)
    .single();

  return json({ podcast }, { headers });
}

export async function action({
  request,
  params,
}: ActionFunctionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { podcastId } = params;

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title"));
  const episodeNumber = formData.get("episode_number")
    ? Number(formData.get("episode_number"))
    : null;
  const filmingDate = formData.get("filming_date") || null;
  const filmingTime = formData.get("filming_time") || null;
  const status = String(formData.get("status")) || "planning";
  const notes = formData.get("notes") || null;

  if (!title) {
    return json({ error: "Title is required" }, { status: 400, headers });
  }

  const { error } = await supabase
    .from("episodes")
    .insert({
      podcast_id: podcastId,
      title,
      episode_number: episodeNumber,
      filming_date: filmingDate,
      filming_time: filmingTime,
      status,
      notes,
    });

  if (error) {
    return json({ error: error.message }, { status: 500, headers });
  }

  return redirect(`/podcasts/${podcastId}`, { headers });
}

export default function NewEpisodePage() {
  const { podcast } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);

  // Explicitly clear form on mount to prevent browser autofill
  useEffect(() => {
    if (formRef.current) {
      // Reset the form
      formRef.current.reset();

      // Also clear all inputs explicitly
      const inputs = formRef.current.querySelectorAll('input, textarea, select');
      inputs.forEach((input: any) => {
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = false;
        } else {
          input.value = '';
        }
      });
    }
  }, []);

  return (
    <div
      className="episode-form-container"
      style={{ "--podcast-accent": podcast?.accent_color || "#667eea" } as any}
    >
      <div className="form-header">
        <div className="podcast-badge">{podcast?.name}</div>
        <h2>Create New Episode</h2>
        <p className="form-subtitle">Add a new episode to your podcast timeline</p>
      </div>

      <Form method="post" className="form" autoComplete="off" ref={formRef}>
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input id="title" name="title" type="text" required autoComplete="off" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="episode_number">Episode Number</label>
            <input id="episode_number" name="episode_number" type="number" autoComplete="off" />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue="planning" autoComplete="off">
              <option value="planning">Planning</option>
              <option value="recorded">Recorded</option>
              <option value="published">Published</option>
              <option value="aired">Aired</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="filming_date">Filming Date</label>
            <input id="filming_date" name="filming_date" type="date" autoComplete="off" />
          </div>

          <div className="form-group">
            <label htmlFor="filming_time">Filming Time</label>
            <input id="filming_time" name="filming_time" type="time" autoComplete="off" />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={5} autoComplete="off" />
        </div>

        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create Episode
          </button>
        </div>
      </Form>
    </div>
  );
}
