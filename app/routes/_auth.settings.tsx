import type { LoaderFunctionArgs, ActionFunctionArgs, LinksFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { getVisiblePodcasts, toggleVisibility } from "~/utils/visibility.server";
import type { Podcast } from "~/types/models";
import styles from "./_auth.settings.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, supabase, headers } = await requireUser(request);
  const podcasts = await getVisiblePodcasts(supabase, user.id);
  return json({ podcasts }, { headers });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, supabase, headers } = await requireUser(request);
  const formData = await request.formData();
  const podcastId = String(formData.get("podcastId"));
  const isVisible = formData.get("isVisible") === "true";

  await toggleVisibility(supabase, user.id, podcastId, isVisible);
  return redirect("/settings", { headers });
}

interface LoaderData {
  podcasts: Podcast[];
}

export default function SettingsPage() {
  const { podcasts } = useLoaderData<LoaderData>();

  return (
    <div className="settings">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="subtitle">Manage which podcast calendars you want to see</p>
      </div>

      <div className="settings-card">
        <h2>Podcast Visibility</h2>
        <p className="card-subtitle">
          Toggle podcasts on and off to show or hide them from your dashboard
        </p>

        <div className="podcast-list">
          {podcasts.map((podcast) => (
            <div key={podcast.id} className="podcast-toggle">
              <div className="podcast-info">
                <div
                  className="podcast-accent"
                  style={{ backgroundColor: podcast.accent_color }}
                />
                <div>
                  <h3>{podcast.name}</h3>
                  {podcast.description && (
                    <p className="description">{podcast.description}</p>
                  )}
                </div>
              </div>

              <Form method="post" className="toggle-form">
                <input type="hidden" name="podcastId" value={podcast.id} />
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    name="isVisible"
                    value="true"
                    defaultChecked={podcast.is_visible}
                    onChange={(e) => {
                      const form = e.currentTarget.form;
                      if (form) {
                        form.submit();
                      }
                    }}
                    className="toggle-checkbox"
                  />
                  <span className="toggle-slider" />
                  <span className="toggle-text">
                    {podcast.is_visible ? "Visible" : "Hidden"}
                  </span>
                </label>
              </Form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
