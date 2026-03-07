import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { getSession as getSessionStorage, createUserSession } from "~/utils/session.server";
import styles from "./login.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSessionStorage(request);
  if (session.has("userId")) {
    return redirect("/");
  }
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }

  const { supabase } = createSupabaseServerClient(request);
  console.log("Attempting login for:", email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Login error:", error);
    return json({ error: error.message }, { status: 401 });
  }

  console.log("Login successful, user:", data.user?.email);

  // Create session and redirect
  const { headers, redirectTo } = await createUserSession(
    data.user!.id,
    data.user!.email!,
    "/"
  );

  return redirect(redirectTo, { headers });
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Podplanner</h1>
        <p className="subtitle">Plan your podcast episodes</p>

        <Form method="post" className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {actionData?.error && (
            <div className="error-message">{actionData.error}</div>
          )}

          <button type="submit" className="submit-button">
            Sign In
          </button>
        </Form>

        <div className="divider">or</div>

        <div className="signup-prompt">
          <p>
            Don't have an account?{" "}
            <a href="https://supabase.com" target="_blank" rel="noreferrer">
              Create one in Supabase
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
