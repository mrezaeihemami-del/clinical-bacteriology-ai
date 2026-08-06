import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal(props: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }

      if (event.key === "Tab" && dialog) {
        const elements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
          ),
        );

        if (elements.length === 0) return;
        const first = elements[0]!;
        const last = elements[elements.length - 1]!;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [props]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal${props.wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">{props.title}</h2>
          <button
            className="button ghost"
            type="button"
            aria-label="Close dialog"
            onClick={props.onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer ? <div className="modal-footer">{props.footer}</div> : null}
      </div>
    </div>
  );
}
