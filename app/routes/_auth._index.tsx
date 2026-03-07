import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import { getVisiblePodcasts } from "~/utils/visibility.server";
import type { Podcast } from "~/types/models";
import styles from "./_auth._index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers, supabase } = await requireUser(request);
  const podcasts = await getVisiblePodcasts(supabase, user.id);

  return json({ userEmail: user.email, podcasts }, { headers });
}

interface LoaderData {
  userEmail: string;
  podcasts: Podcast[];
}

export default function Dashboard() {
  const { userEmail, podcasts } = useLoaderData<LoaderData>();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome!</h1>
        <p className="subtitle">You're logged in as {userEmail}</p>
      </div>

      <section className="podcasts-section">
        <h2>Your Podcasts</h2>
        {podcasts.length === 0 ? (
          <p className="empty-state">No visible podcasts. Check settings to enable some.</p>
        ) : (
          <div className="podcasts-grid">
            {podcasts.map((podcast) => (
              <Link
                key={podcast.id}
                to={`/podcasts/${podcast.id}`}
                className="podcast-card"
                style={{ "--podcast-accent": podcast.accent_color } as any}
              >
                <div className="podcast-card-header">
                  <h3>{podcast.name}</h3>
                </div>
                {podcast.description && (
                  <p className="description">{podcast.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
