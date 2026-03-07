import { createCookieSessionStorage } from "@remix-run/node";

const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret-key";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function createUserSession(
  userId: string,
  userEmail: string,
  redirectTo: string
) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  session.set("userEmail", userEmail);

  return {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
    redirectTo,
  };
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return sessionStorage.destroySession(session);
}
