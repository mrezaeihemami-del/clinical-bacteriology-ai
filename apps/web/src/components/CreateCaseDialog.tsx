import { useState, type FormEvent } from "react";
import type { SpecimenType } from "../types";
import { Modal } from "./Modal";

const specimenTypes: SpecimenType[] = [
  "URINE",
  "STERILE_SITE",
  "SPUTUM",
  "THROAT",
  "GENITAL",
  "OTHER",
];

export function CreateCaseDialog(props: {
  onClose: () => void;
  onCreate: (input: {
    caseCode: string;
    specimenType: SpecimenType;
    collectionDate: string;
    cultureMedia: string;
    incubationHours: number;
    notes?: string;
  }) => Promise<void>;
}) {
  const [caseCode, setCaseCode] = useState("");
  const [specimenType, setSpecimenType] =
    useState<SpecimenType>("URINE");
  const [collectionDate, setCollectionDate] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [cultureMedia, setCultureMedia] = useState("Blood agar");
  const [incubationHours, setIncubationHours] = useState(24);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    const normalizedCaseCode = caseCode.trim();
    if (normalizedCaseCode.length < 3) {
      setError("Case code must contain at least 3 characters.");
      return;
    }

    if (!collectionDate) {
      setError("Collection date is required.");
      return;
    }

    if (!cultureMedia.trim()) {
      setError("Culture media is required.");
      return;
    }

    setPending(true);
    setError("");
    try {
      await props.onCreate({
        caseCode: normalizedCaseCode,
        specimenType,
        collectionDate: new Date(collectionDate).toISOString(),
        cultureMedia: cultureMedia.trim(),
        incubationHours,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      props.onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title="Create laboratory case"
      onClose={props.onClose}
      footer={
        <>
          <button
            className="button secondary"
            type="button"
            onClick={props.onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            form="create-case-form"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create case"}
          </button>
        </>
      }
    >
      <form id="create-case-form" className="grid" onSubmit={submit}>
        <div className="grid two">
          <div className="field">
            <label htmlFor="case-code">Case code</label>
            <input
              id="case-code"
              className="input"
              value={caseCode}
              onChange={(event) => setCaseCode(event.target.value)}
              minLength={3}
              maxLength={64}
              autoComplete="off"
              aria-describedby="case-code-help"
              required
            />
            <span id="case-code-help" className="muted">
              Use 3 to 64 characters, for example CASE-001.
            </span>
          </div>
          <div className="field">
            <label htmlFor="specimen-type">Specimen type</label>
            <select
              id="specimen-type"
              className="select"
              value={specimenType}
              onChange={(event) =>
                setSpecimenType(event.target.value as SpecimenType)
              }
            >
              {specimenTypes.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid two">
          <div className="field">
            <label htmlFor="collection-date">Collection date</label>
            <input
              id="collection-date"
              className="input"
              type="datetime-local"
              value={collectionDate}
              onChange={(event) => setCollectionDate(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="incubation-hours">Incubation hours</label>
            <input
              id="incubation-hours"
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

        <div className="field">
          <label htmlFor="culture-media">Culture media</label>
          <input
            id="culture-media"
            className="input"
            value={cultureMedia}
            onChange={(event) => setCultureMedia(event.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="case-notes">Clinical notes (optional)</label>
          <textarea
            id="case-notes"
            className="textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={4000}
          />
          <span className="muted">
            Notes are not sent to the image-only visual quality prompt.
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
