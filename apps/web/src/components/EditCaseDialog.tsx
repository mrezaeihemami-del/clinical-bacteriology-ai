import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { CaseDetail, SpecimenType } from "../types";
import { Modal } from "./Modal";

const specimenOptions: Array<{
  value: SpecimenType;
  label: string;
  aiScope: "supported" | "manual";
}> = [
  { value: "URINE", label: "Urine", aiScope: "supported" },
  { value: "STERILE_SITE", label: "Sterile site", aiScope: "supported" },
  { value: "SPUTUM", label: "Sputum", aiScope: "manual" },
  { value: "THROAT", label: "Throat swab", aiScope: "manual" },
  { value: "GENITAL", label: "Genital specimen", aiScope: "manual" },
  { value: "OTHER", label: "Other", aiScope: "manual" },
];

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

export function EditCaseDialog(props: {
  item: CaseDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [specimenType, setSpecimenType] = useState(props.item.specimenType);
  const [collectionDate, setCollectionDate] = useState(
    toLocalDateTime(props.item.collectionDate),
  );
  const [cultureMedia, setCultureMedia] = useState(props.item.cultureMedia);
  const [incubationHours, setIncubationHours] = useState(
    props.item.incubationHours,
  );
  const [gramStainAvailable, setGramStainAvailable] = useState(
    props.item.gramStainAvailable,
  );
  const [gramStainResult, setGramStainResult] = useState(
    props.item.gramStainResult ?? "",
  );
  const [microscopyAvailable, setMicroscopyAvailable] = useState(
    props.item.microscopyAvailable,
  );
  const [microscopyResult, setMicroscopyResult] = useState(
    props.item.microscopyResult ?? "",
  );
  const [notes, setNotes] = useState(props.item.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const inAiScope =
    specimenType === "URINE" || specimenType === "STERILE_SITE";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      await api.updateCase(props.item.id, {
        specimenType,
        collectionDate: new Date(collectionDate).toISOString(),
        cultureMedia,
        incubationHours,
        gramStainAvailable,
        gramStainResult: gramStainAvailable
          ? gramStainResult || null
          : null,
        microscopyAvailable,
        microscopyResult: microscopyAvailable
          ? microscopyResult || null
          : null,
        notes: notes || null,
      });
      await props.onSaved();
      props.onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={`Edit case ${props.item.caseCode}`}
      onClose={props.onClose}
      footer={
        <>
          <button
            className="button secondary"
            type="button"
            disabled={pending}
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            form="edit-case-form"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-case-form" className="grid" onSubmit={submit}>
        <div className="notice">
          The accession/case code is immutable after creation to preserve
          traceability.
        </div>

        <div className="grid two">
          <div className="field">
            <label htmlFor="edit-specimen">Specimen type</label>
            <select
              id="edit-specimen"
              className="select"
              value={specimenType}
              onChange={(event) =>
                setSpecimenType(event.target.value as SpecimenType)
              }
            >
              {specimenOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.aiScope === "manual"
                    ? " — manual review only"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="edit-collection">Collection date and time</label>
            <input
              id="edit-collection"
              className="input"
              type="datetime-local"
              value={collectionDate}
              onChange={(event) => setCollectionDate(event.target.value)}
              required
            />
          </div>
        </div>

        <div className={`notice ${inAiScope ? "success" : "warning"}`}>
          {inAiScope
            ? "This specimen type is inside the configured AI-assisted workflow scope."
            : "This specimen type is outside the automated triage scope. Image quality observations may be recorded, but the case cannot automatically advance to triage completion."}
        </div>

        <div className="grid two">
          <div className="field">
            <label htmlFor="edit-media">Culture media</label>
            <input
              id="edit-media"
              className="input"
              value={cultureMedia}
              onChange={(event) => setCultureMedia(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="edit-incubation">Incubation hours</label>
            <input
              id="edit-incubation"
              className="input"
              type="number"
              min={0}
              max={240}
              value={incubationHours}
              onChange={(event) =>
                setIncubationHours(Number(event.target.value))
              }
              required
            />
          </div>
        </div>

        <label className="actions">
          <input
            type="checkbox"
            checked={gramStainAvailable}
            onChange={(event) =>
              setGramStainAvailable(event.target.checked)
            }
          />
          Gram stain available
        </label>
        {gramStainAvailable ? (
          <div className="field">
            <label htmlFor="edit-gram-result">Gram stain result</label>
            <textarea
              id="edit-gram-result"
              className="textarea"
              maxLength={1000}
              value={gramStainResult}
              onChange={(event) => setGramStainResult(event.target.value)}
            />
          </div>
        ) : null}

        <label className="actions">
          <input
            type="checkbox"
            checked={microscopyAvailable}
            onChange={(event) =>
              setMicroscopyAvailable(event.target.checked)
            }
          />
          Microscopy available
        </label>
        {microscopyAvailable ? (
          <div className="field">
            <label htmlFor="edit-microscopy-result">
              Microscopy result
            </label>
            <textarea
              id="edit-microscopy-result"
              className="textarea"
              maxLength={1000}
              value={microscopyResult}
              onChange={(event) =>
                setMicroscopyResult(event.target.value)
              }
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="edit-notes">Clinical notes</label>
          <textarea
            id="edit-notes"
            className="textarea"
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <span className="muted">
            Notes are stored with the case but are not sent to the image-only
            AI prompt.
          </span>
        </div>

        {error ? (
          <div className="notice error" role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
