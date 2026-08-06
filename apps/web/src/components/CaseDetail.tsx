import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileImage,
  Pencil,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { api, uploadImage } from "../api";
import type {
  CaseDetail as CaseDetailType,
  CaseImage,
  ImageAnalysis,
  Role,
} from "../types";
import { Modal } from "./Modal";
import { EditCaseDialog } from "./EditCaseDialog";
import { canReviewCase, canUploadImage } from "../ui-permissions";

const mutableStatuses = [
  "DRAFT",
  "IMAGE_UPLOADED",
  "QC_COMPLETED",
  "TRIAGE_COMPLETED",
  "REJECTED",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ImageCard(props: {
  image: CaseImage;
  canAnalyse: boolean;
  canDelete: boolean;
  onAnalyse: (imageId: string) => Promise<boolean>;
  onDelete: (imageId: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const latest = props.image.analyses[0];

  useEffect(() => {
    let active = true;
    void api
      .getImageUrl(props.image.id)
      .then((result) => {
        if (active) setUrl(result.url);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Image unavailable",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [props.image.id]);

  async function analyse() {
    setPending(true);
    setError("");
    try {
      await props.onAnalyse(props.image.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError("");
    try {
      const succeeded = await props.onDelete(props.image.id);
      if (succeeded) setShowDeleteConfirm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deletion failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="image-card">
      {url ? (
        <img
          className="image-preview"
          src={url}
          alt={`Uploaded agar plate ${props.image.originalFileName}`}
        />
      ) : (
        <div className="image-preview empty-state">
          <FileImage aria-hidden="true" />
          {error || "Loading private image…"}
        </div>
      )}

      <div className="image-card-content">
        <h4>{props.image.originalFileName}</h4>
        <div className="muted">
          {props.image.detectedMimeType} · {props.image.width} ×{" "}
          {props.image.height} · {formatBytes(props.image.sizeBytes)}
        </div>
        <div className="muted">SHA-256: {props.image.sha256.slice(0, 16)}…</div>

        <div className="actions section">
          {props.canAnalyse ? (
            <button
              className="button primary small"
              type="button"
              onClick={analyse}
              disabled={pending}
            >
              <BrainCircuit size={16} aria-hidden="true" />
              {pending ? "Analysing…" : "Run real vision"}
            </button>
          ) : null}
          {props.canDelete ? (
            <button
              className="button secondary small"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={pending}
            >
              <Trash2 size={16} aria-hidden="true" />
              Remove
            </button>
          ) : null}
        </div>

        {latest ? <AnalysisView analysis={latest} /> : null}
        {error ? (
          <div className="notice error section" role="alert">
            {error}
          </div>
        ) : null}
      </div>
      {showDeleteConfirm ? (
        <Modal
          title="Remove this image?"
          onClose={() => {
            if (!pending) setShowDeleteConfirm(false);
          }}
          footer={
            <>
              <button
                className="button secondary"
                type="button"
                disabled={pending}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="button danger"
                type="button"
                disabled={pending}
                onClick={() => void remove()}
              >
                {pending ? "Removing…" : "Remove image"}
              </button>
            </>
          }
        >
          <p>
            The image will be removed from the active case and any earlier
            workflow status derived from the image will be invalidated.
          </p>
          <p>
            <strong>{props.image.originalFileName}</strong>
          </p>
        </Modal>
      ) : null}
    </article>
  );
}

function AnalysisView(props: { analysis: ImageAnalysis }) {
  const analysis = props.analysis;

  return (
    <div className="analysis">
      <div className="actions">
        <strong>Latest AI observation</strong>
        <span className={`status ${analysis.status}`}>{analysis.status}</span>
        {analysis.imageQuality ? (
          <span className={`status ${analysis.imageQuality}`}>
            {analysis.imageQuality}
          </span>
        ) : null}
      </div>

      {analysis.failureReason ? (
        <div className="notice error section">{analysis.failureReason}</div>
      ) : null}

      {analysis.status === "SUCCESS" ? (
        <>
          <p>
            <strong>Visible growth pattern:</strong>{" "}
            {analysis.growthPattern?.replaceAll("_", " ")}
          </p>
          <p>
            <strong>Model confidence:</strong>{" "}
            {analysis.confidence !== undefined
              ? `${Math.round(analysis.confidence * 100)}%`
              : "Not supplied"}{" "}
            <span className="muted">(uncalibrated model estimate)</span>
          </p>

          {analysis.qualityIssues?.length ? (
            <p>
              <strong>Quality issues:</strong>{" "}
              {analysis.qualityIssues.join(", ")}
            </p>
          ) : null}

          {analysis.observations?.length ? (
            <>
              <strong>Visual observations</strong>
              <ul>
                {analysis.observations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {analysis.limitations?.length ? (
            <>
              <strong>Limitations</strong>
              <ul>
                {analysis.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="notice warning">
            <AlertTriangle size={17} aria-hidden="true" /> AI-assisted visual
            observations are not a diagnosis. A microbiologist must review the
            image and bench findings.
          </div>
        </>
      ) : null}
    </div>
  );
}

function UploadPanel(props: {
  caseId: string;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

    setPending(true);
    setProgress(0);
    setError("");
    setMessage("");

    try {
      await uploadImage(props.caseId, file, setProgress);
      setMessage("Image validated, stored privately and recorded successfully.");
      setFile(null);
      await props.onUploaded();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="upload-box" onSubmit={submit}>
      <div className="field">
        <label htmlFor="plate-image">Upload an agar plate image</label>
        <input
          id="plate-image"
          className="input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={pending}
          required
        />
        <span className="muted">
          Real multipart upload. JPEG, PNG or WebP; maximum 10 MB; minimum
          dimensions 64 × 64.
        </span>
      </div>

      {file ? (
        <div className="upload-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="Local preview of selected image" />
          ) : null}
          <div>
            <strong>{file.name}</strong>
            <div className="muted">
              {file.type || "Unknown client MIME"} · {formatBytes(file.size)}
            </div>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div
          className="progress"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="actions section">
        <button
          className="button primary"
          type="submit"
          disabled={!file || pending}
        >
          <Upload size={17} aria-hidden="true" />
          {pending ? `Uploading ${progress}%` : "Upload and validate"}
        </button>
      </div>

      {message ? (
        <div className="notice success section" role="status">
          <CheckCircle2 size={17} aria-hidden="true" /> {message}
        </div>
      ) : null}
      {error ? (
        <div className="notice error section" role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
}

export function CaseDetail(props: {
  item: CaseDetailType;
  role: Role;
  onRefresh: () => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<
    "APPROVED" | "REJECTED" | "OVERRIDDEN"
  >("APPROVED");
  const [reviewComments, setReviewComments] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const canMutate = mutableStatuses.includes(props.item.status);
  const canUpload = canUploadImage(props.role, props.item.status);
  const canEdit =
    ["TECHNICIAN", "SUPERVISOR"].includes(props.role) && canMutate;
  const canAnalyse =
    ["TECHNICIAN", "MICROBIOLOGIST", "SUPERVISOR"].includes(props.role) &&
    ["IMAGE_UPLOADED", "QC_COMPLETED"].includes(props.item.status);
  const canDeleteImage =
    ["TECHNICIAN", "SUPERVISOR"].includes(props.role) && canMutate;
  const canSubmit =
    ["TECHNICIAN", "SUPERVISOR"].includes(props.role) &&
    props.item.status === "TRIAGE_COMPLETED";
  const canReview = canReviewCase(props.role, props.item.status);
  const canFinalise =
    props.role === "SUPERVISOR" && props.item.status === "APPROVED";
  const canArchive =
    ["TECHNICIAN", "SUPERVISOR"].includes(props.role) &&
    props.item.status === "DRAFT" &&
    props.item.images.length === 0;

  const latestSuccessfulAnalysis = useMemo(
    () =>
      props.item.images
        .flatMap((image) => image.analyses)
        .filter((analysis) => analysis.status === "SUCCESS")
        .sort(
          (a, b) =>
            new Date(b.completedAt ?? b.startedAt).getTime() -
            new Date(a.completedAt ?? a.startedAt).getTime(),
        )[0],
    [props.item.images],
  );

  async function run(
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      await props.onRefresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operation failed");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        api.reviewCase(props.item.id, {
          decision: reviewDecision,
          ...(reviewComments ? { comments: reviewComments } : {}),
          ...(reviewDecision === "OVERRIDDEN"
            ? { overrideReason }
            : {}),
        }),
      "Review decision recorded with the authenticated reviewer.",
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="actions">
              <h2>{props.item.caseCode}</h2>
              <span className={`status ${props.item.status}`}>
                {props.item.status}
              </span>
            </div>
            <p>
              Human-reviewed workflow · organisation-scoped server permissions
            </p>
          </div>

          <div className="actions">
            {canEdit ? (
              <button
                className="button secondary"
                type="button"
                disabled={pending}
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil size={17} aria-hidden="true" />
                Edit case
              </button>
            ) : null}

            {canSubmit ? (
              <button
                className="button primary"
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => api.submitCase(props.item.id),
                    "Case submitted for microbiologist review.",
                  )
                }
              >
                <Send size={17} aria-hidden="true" />
                Submit for review
              </button>
            ) : null}

            {canFinalise ? (
              <button
                className="button primary"
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => api.finaliseCase(props.item.id),
                    "Case finalised by the laboratory supervisor.",
                  )
                }
              >
                Finalise
              </button>
            ) : null}

            {canArchive ? (
              <button
                className="button danger"
                type="button"
                disabled={pending}
                onClick={() => setShowArchiveConfirm(true)}
              >
                <Trash2 size={17} aria-hidden="true" />
                Archive draft
              </button>
            ) : null}
          </div>
        </div>

        <div className="panel-body">
          <div className="notice warning">
            <AlertTriangle size={18} aria-hidden="true" /> This application
            records AI-assisted visual observations only. It is not clinically
            validated and cannot autonomously identify organisms, estimate
            CFU/mL, or issue a diagnostic report.
          </div>

          {!["URINE", "STERILE_SITE"].includes(
            props.item.specimenType,
          ) ? (
            <div className="notice warning section">
              This specimen type is outside the automated triage scope. Image
              quality observations may be recorded, but the server will not
              advance the case to triage completion automatically.
            </div>
          ) : null}

          <div className="detail-meta section">
            <div className="meta-card">
              <span>Specimen type</span>
              <strong>{props.item.specimenType.replaceAll("_", " ")}</strong>
            </div>
            <div className="meta-card">
              <span>Culture media</span>
              <strong>{props.item.cultureMedia}</strong>
            </div>
            <div className="meta-card">
              <span>Incubation</span>
              <strong>{props.item.incubationHours} hours</strong>
            </div>
            <div className="meta-card">
              <span>Collection date</span>
              <strong>
                {new Date(props.item.collectionDate).toLocaleString()}
              </strong>
            </div>
          </div>

          {props.item.notes ? (
            <div className="section">
              <h3>Clinical notes</h3>
              <div className="notice">{props.item.notes}</div>
            </div>
          ) : null}

          {canUpload ? (
            <div className="section">
              <h3>Validated private image upload</h3>
              <UploadPanel
                caseId={props.item.id}
                onUploaded={props.onRefresh}
              />
            </div>
          ) : null}

          <div className="section">
            <h3>Case images and analyses</h3>
            {props.item.images.length === 0 ? (
              <div className="notice">
                No image has been stored for this case.
              </div>
            ) : (
              <div className="image-grid">
                {props.item.images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    canAnalyse={canAnalyse}
                    canDelete={canDeleteImage}
                    onAnalyse={(imageId) =>
                      run(
                        () => api.analyseImage(imageId),
                        "Image analysis completed and validated against the response schema.",
                      )
                    }
                    onDelete={(imageId) =>
                      run(
                        () => api.deleteImage(imageId),
                        "Image removed from the active case.",
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {latestSuccessfulAnalysis ? (
            <div className="section notice warning">
              Latest analysis{" "}
              <strong>{latestSuccessfulAnalysis.id}</strong> requires human
              review:{" "}
              {latestSuccessfulAnalysis.requiresHumanReview ? "Yes" : "No"}
            </div>
          ) : null}

          {canReview ? (
            <form className="section grid" onSubmit={submitReview}>
              <h3>Microbiologist review</h3>
              <div className="field">
                <label htmlFor="review-decision">Decision</label>
                <select
                  id="review-decision"
                  className="select"
                  value={reviewDecision}
                  onChange={(event) =>
                    setReviewDecision(
                      event.target.value as typeof reviewDecision,
                    )
                  }
                >
                  <option value="APPROVED">Approve observation workflow</option>
                  <option value="REJECTED">Reject and request revision</option>
                  {props.role === "SUPERVISOR" ? (
                    <option value="OVERRIDDEN">Supervisor override</option>
                  ) : null}
                </select>
              </div>

              <div className="field">
                <label htmlFor="review-comments">Review comments</label>
                <textarea
                  id="review-comments"
                  className="textarea"
                  maxLength={4000}
                  value={reviewComments}
                  onChange={(event) => setReviewComments(event.target.value)}
                />
              </div>

              {reviewDecision === "OVERRIDDEN" ? (
                <div className="field">
                  <label htmlFor="override-reason">
                    Detailed override reason
                  </label>
                  <textarea
                    id="override-reason"
                    className="textarea"
                    minLength={20}
                    maxLength={2000}
                    required
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                  />
                </div>
              ) : null}

              <button
                className="button primary"
                type="submit"
                disabled={pending}
              >
                Record authenticated review
              </button>
            </form>
          ) : null}

          {props.item.reviews.length ? (
            <div className="section">
              <h3>Review history</h3>
              <div className="grid">
                {props.item.reviews.map((review) => (
                  <div className="notice" key={review.id}>
                    <strong>{review.decision}</strong> by{" "}
                    {review.reviewer.displayName} ·{" "}
                    {new Date(review.createdAt).toLocaleString()}
                    {review.comments ? <p>{review.comments}</p> : null}
                    {review.overrideReason ? (
                      <p>
                        <strong>Override reason:</strong>{" "}
                        {review.overrideReason}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {message ? (
            <div className="notice success section" role="status">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="notice error section" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {showEditDialog ? (
        <EditCaseDialog
          item={props.item}
          onClose={() => setShowEditDialog(false)}
          onSaved={props.onRefresh}
        />
      ) : null}

      {showArchiveConfirm ? (
        <Modal
          title="Archive empty draft?"
          onClose={() => setShowArchiveConfirm(false)}
          footer={
            <>
              <button
                className="button secondary"
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="button danger"
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(props.onArchive, "Draft archived.").then(
                    (succeeded) => {
                      if (succeeded) setShowArchiveConfirm(false);
                    },
                  )
                }
              >
                Archive draft
              </button>
            </>
          }
        >
          <p>
            This action removes the empty draft from active lists. Cases with
            images or review history cannot be archived through this action.
          </p>
        </Modal>
      ) : null}
    </>
  );
}
