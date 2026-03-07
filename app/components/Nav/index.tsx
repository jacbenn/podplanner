import { Link, Form } from "@remix-run/react";
import type { User } from "~/types/models";
import styles from "./styles.css";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

interface NavProps {
  user: User;
}

export default function Nav({ user }: NavProps) {
  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          <h1>Podplanner</h1>
        </Link>

        <div className="nav-menu">
          <Link to="/" className="nav-link">
            Dashboard
          </Link>
          <Link to="/settings" className="nav-link">
            Settings
          </Link>
        </div>

        <div className="nav-user">
          <span className="user-email">{user.email}</span>
          <Form method="post" action="/logout">
            <button type="submit" className="logout-button">
              Sign Out
            </button>
          </Form>
        </div>
      </div>
    </nav>
  );
}
