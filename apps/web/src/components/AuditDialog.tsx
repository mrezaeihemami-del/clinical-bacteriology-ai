import { useEffect, useState } from "react";
import { api } from "../api";
import type { AuditEvent } from "../types";
import { Modal } from "./Modal";

export function AuditDialog(props: { onClose: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .listAuditEvents()
      .then((result) => setEvents(result.events))
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Could not load audit log",
        ),
      );
  }, []);

  return (
    <Modal title="Append-only audit events" onClose={props.onClose} wide>
      <p className="muted">
        API keys, image bytes, cookies and sensitive request bodies are not
        included in this view.
      </p>
      {error ? (
        <div className="notice error" role="alert">
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
                <td>{event.actor?.displayName ?? "System"}</td>
                <td>{event.action}</td>
                <td>
                  {event.entityType}
                  {event.entityId ? ` · ${event.entityId}` : ""}
                </td>
                <td>{event.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
