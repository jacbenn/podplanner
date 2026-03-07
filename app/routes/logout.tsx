import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { logout } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = await logout(request);
  return redirect("/login", { headers });
}

// No default export - action-only route
export default function LogoutRoute() {
  return null;
}
