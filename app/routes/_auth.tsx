import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import Nav, { links as navLinks } from "~/components/Nav";
import type { User } from "~/types/models";

export const links: LinksFunction = () => [...navLinks()];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers } = await requireUser(request);
  return json({ user }, { headers });
}

interface LoaderData {
  user: User;
}

export default function AuthLayout() {
  const { user } = useLoaderData<LoaderData>();

  return (
    <div className="app">
      <Nav user={user} />
      <main>
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
