import {
  FlaskConical,
  LogOut,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import type { User } from "../types";
import { canReadAudit } from "../ui-permissions";

export function Header(props: {
  user: User;
  onSettings: () => void;
  onUsers: () => void;
  onAudit: () => void;
  onLogout: () => void;
}) {
  const mayReadAudit = canReadAudit(props.user.role);

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <FlaskConical size={24} />
        </div>
        <div>
          <h1>Clinical Bacteriology AI Assistant</h1>
          <p>AI-assisted observations · mandatory human review</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="header-user">
          <strong>{props.user.displayName}</strong>
          <span>
            {props.user.role.replaceAll("_", " ")} ·{" "}
            {props.user.organisationName}
          </span>
        </div>

        {mayReadAudit ? (
          <button
            className="button ghost"
            type="button"
            onClick={props.onAudit}
          >
            <ScrollText size={18} aria-hidden="true" />
            Audit
          </button>
        ) : null}

        {props.user.role === "ADMIN" ? (
          <>
            <button
              className="button ghost"
              type="button"
              onClick={props.onUsers}
            >
              <Users size={18} aria-hidden="true" />
              Users
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={props.onSettings}
            >
              <Settings size={18} aria-hidden="true" />
              AI provider
            </button>
          </>
        ) : null}

        <button className="button ghost" type="button" onClick={props.onLogout}>
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </header>
  );
}
