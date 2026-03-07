import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { logout } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const setCookie = await logout(request);
  return redirect("/login", {
    headers: { "Set-Cookie": setCookie },
  });
}

// No default export - action-only route
export default function LogoutRoute() {
  return null;
}
