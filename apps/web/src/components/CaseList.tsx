import { Plus } from "lucide-react";
import type { CaseSummary, Role } from "../types";
import { canCreateCase } from "../ui-permissions";

export function CaseList(props: {
  cases: CaseSummary[];
  selectedId: string | null;
  role: Role;
  onSelect: (caseId: string) => void;
  onCreate: () => void;
}) {
  const canCreate = canCreateCase(props.role);

  return (
    <aside className="sidebar" aria-label="Case list">
      <div className="sidebar-title">
        <h2>Laboratory cases</h2>
        {canCreate ? (
          <button
            className="button primary small"
            type="button"
            onClick={props.onCreate}
          >
            <Plus size={16} aria-hidden="true" />
            New case
          </button>
        ) : null}
      </div>

      <div className="case-list">
        {props.cases.length === 0 ? (
          <div className="notice">No cases are available.</div>
        ) : (
          props.cases.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`case-card${props.selectedId === item.id ? " active" : ""}`}
              onClick={() => props.onSelect(item.id)}
            >
              <div className="case-card-top">
                <span className="case-card-code">{item.caseCode}</span>
                <span className={`status ${item.status}`}>{item.status}</span>
              </div>
              <div className="case-card-meta">
                <span>{item.specimenType.replaceAll("_", " ")}</span>
                <span>{item._count.images} image(s)</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
