import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import styles from "./_auth._index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers } = await requireUser(request);
  return json({ userEmail: user.email }, { headers });
}

interface LoaderData {
  userEmail: string;
}

export default function Dashboard() {
  const { userEmail } = useLoaderData<LoaderData>();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome!</h1>
        <p className="subtitle">You're logged in as {userEmail}</p>
      </div>
      <p>Auth is working! 🎉</p>
    </div>
  );
}
