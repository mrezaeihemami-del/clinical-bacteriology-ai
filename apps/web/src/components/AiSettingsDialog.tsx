import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../api";
import type { ProviderSetting } from "../types";
import { Modal } from "./Modal";

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com";

const googleModels = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

type ProviderName = ProviderSetting["provider"];

function defaultsFor(provider: ProviderName) {
  if (provider === "GOOGLE_NATIVE") {
    return {
      baseUrl: GOOGLE_BASE_URL,
      model: "gemini-3.6-flash",
    };
  }

  return {
    baseUrl: "",
    model: "",
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const request = error.requestId ? ` Request ID: ${error.requestId}.` : "";
    return `${error.message} (${error.code}).${request}`;
  }

  return error instanceof Error ? error.message : fallback;
}

export function AiSettingsDialog(props: {
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [knownProviders, setKnownProviders] = useState<ProviderSetting[]>([]);
  const [provider, setProvider] = useState<ProviderName>("GOOGLE_NATIVE");
  const [baseUrl, setBaseUrl] = useState(GOOGLE_BASE_URL);
  const [model, setModel] = useState("gemini-3.6-flash");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [visionEnabled, setVisionEnabled] = useState(true);
  const [timeoutMs, setTimeoutMs] = useState(45_000);
  const [maxImageBytes, setMaxImageBytes] = useState(10 * 1024 * 1024);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"save" | "test" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyProvider(
    nextProvider: ProviderName,
    providers: ProviderSetting[] = knownProviders,
  ) {
    const stored = providers.find((item) => item.provider === nextProvider);
    const defaults = defaultsFor(nextProvider);

    setProvider(nextProvider);
    setBaseUrl(stored?.baseUrl ?? defaults.baseUrl);
    setModel(stored?.model ?? defaults.model);
    setMaskedKey(stored?.apiKeyMasked ?? null);
    setHasStoredKey(stored?.hasApiKey ?? false);
    setEnabled(stored?.enabled ?? true);
    setVisionEnabled(stored?.visionEnabled ?? true);
    setTimeoutMs(stored?.timeoutMs ?? 45_000);
    setMaxImageBytes(stored?.maxImageBytes ?? 10 * 1024 * 1024);
    setApiKey("");
    setShowKey(false);
    setMessage("");
    setError("");
  }

  useEffect(() => {
    let cancelled = false;

    void api
      .listProviders()
      .then(({ providers }) => {
        if (cancelled) return;
        setKnownProviders(providers);
        const preferred =
          providers.find((item) => item.provider === "GOOGLE_NATIVE") ??
          providers[0];

        applyProvider(preferred?.provider ?? "GOOGLE_NATIVE", providers);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(errorMessage(caught, "Could not load AI settings"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanKey = apiKey.trim();
    if (enabled && !cleanKey && !hasStoredKey) {
      setError("Enter an API key before enabling this provider.");
      setMessage("");
      return;
    }

    setPendingAction("save");
    setMessage("");
    setError("");

    try {
      const result = await api.saveProvider({
        provider,
        baseUrl: provider === "GOOGLE_NATIVE" ? GOOGLE_BASE_URL : baseUrl.trim(),
        model: model.trim(),
        ...(cleanKey ? { apiKey: cleanKey } : {}),
        enabled,
        visionEnabled,
        timeoutMs,
        maxImageBytes,
      });

      if (!result.saved || (enabled && !result.provider.hasApiKey)) {
        throw new Error("The server did not confirm secure API-key storage.");
      }

      setKnownProviders((current) => [
        result.provider,
        ...current.filter((item) => item.provider !== result.provider.provider),
      ]);
      setMaskedKey(result.provider.apiKeyMasked);
      setHasStoredKey(result.provider.hasApiKey);
      setApiKey("");
      setShowKey(false);
      setMessage(
        `Saved securely. Stored key: ${result.provider.apiKeyMasked ?? "present"}.`,
      );
    } catch (caught) {
      setError(errorMessage(caught, "Saving the provider failed"));
    } finally {
      setPendingAction(null);
    }
  }

  async function testConnection() {
    const cleanKey = apiKey.trim();

    if (!cleanKey && !hasStoredKey) {
      setError("Enter and save an API key before testing this provider.");
      setMessage("");
      return;
    }

    setPendingAction("test");
    setMessage("");
    setError("");

    try {
      const result = await api.testProvider(
        cleanKey
          ? {
              provider,
              baseUrl:
                provider === "GOOGLE_NATIVE"
                  ? GOOGLE_BASE_URL
                  : baseUrl.trim(),
              model: model.trim(),
              apiKey: cleanKey,
              timeoutMs,
              useStoredProvider: false,
            }
          : {
              provider,
              useStoredProvider: true,
            },
      );

      setMessage(
        `Vision verified with ${result.model}: controlled red and blue images were distinguished in ${result.latencyMs} ms.`,
      );
    } catch (caught) {
      setError(errorMessage(caught, "Vision test failed"));
    } finally {
      setPendingAction(null);
    }
  }

  const pending = pendingAction !== null;

  return (
    <Modal title="AI provider settings" onClose={props.onClose}>
      <div className="notice warning">
        <strong>Bring your own key.</strong> Keys are encrypted server-side and
        are never returned after submission. Use only data that your provider
        agreement permits.
      </div>

      <form
        ref={formRef}
        id="provider-form"
        className="grid section"
        onSubmit={save}
      >
        <div className="field">
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            className="select"
            value={provider}
            onChange={(event) =>
              applyProvider(event.target.value as ProviderName)
            }
            disabled={pending || loading}
          >
            <option value="GOOGLE_NATIVE">Google Gemini native</option>
            <option value="OPENAI_COMPATIBLE">
              OpenAI-compatible vision API
            </option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="base-url">Base URL</label>
          <input
            id="base-url"
            className="input"
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            readOnly={provider === "GOOGLE_NATIVE"}
            required
            disabled={pending || loading}
          />
          {provider === "OPENAI_COMPATIBLE" ? (
            <span className="muted">
              The hostname must also be present in the server-side
              CUSTOM_AI_ALLOWED_HOSTS allowlist.
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="model-id">Model ID</label>
          {provider === "GOOGLE_NATIVE" ? (
            <select
              id="model-id"
              className="select"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={pending || loading}
            >
              {googleModels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="model-id"
              className="input"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Provider model identifier"
              required
              disabled={pending || loading}
            />
          )}
        </div>

        <div className="field">
          <label htmlFor="api-key">API key</label>
          <div className="input-with-action">
            <input
              id="api-key"
              className="input"
              type={showKey ? "text" : "password"}
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={maskedKey ?? "Paste the provider API key"}
              required={enabled && !hasStoredKey}
              disabled={pending || loading}
            />
            <button
              className="button ghost compact"
              type="button"
              onClick={() => setShowKey((current) => !current)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              disabled={pending || loading}
            >
              {showKey ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          <span className="muted">
            {hasStoredKey
              ? `Stored key: ${maskedKey}. Leave the field blank to keep it.`
              : "No encrypted key is stored yet."}
          </span>
        </div>

        <div className="grid two">
          <div className="field">
            <label htmlFor="timeout">Timeout (milliseconds)</label>
            <input
              id="timeout"
              className="input"
              type="number"
              min={5000}
              max={120000}
              value={timeoutMs}
              onChange={(event) => setTimeoutMs(Number(event.target.value))}
              disabled={pending || loading}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="max-bytes">Maximum AI input bytes</label>
            <input
              id="max-bytes"
              className="input"
              type="number"
              min={65536}
              max={25 * 1024 * 1024}
              value={maxImageBytes}
              onChange={(event) =>
                setMaxImageBytes(Number(event.target.value))
              }
              disabled={pending || loading}
              required
            />
          </div>
        </div>

        <label className="actions">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={pending || loading}
          />
          Provider enabled
        </label>

        <label className="actions">
          <input
            type="checkbox"
            checked={visionEnabled}
            onChange={(event) => setVisionEnabled(event.target.checked)}
            disabled={pending || loading}
          />
          Vision enabled
        </label>

        <div className="notice">
          <ShieldCheck size={18} aria-hidden="true" /> Save stores the encrypted
          key in PostgreSQL. Test real vision sends two generated 64 × 64
          control images and does not establish clinical accuracy.
        </div>

        <div aria-live="polite">
          {message ? (
            <div className="notice success" role="status">
              <CheckCircle2 size={17} aria-hidden="true" /> {message}
            </div>
          ) : null}
          {error ? (
            <div className="notice error" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="modal-footer embedded-footer">
          <button
            className="button secondary"
            type="button"
            onClick={() => void testConnection()}
            disabled={pending || loading}
          >
            {pendingAction === "test" ? "Testing…" : "Test real vision"}
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={pending || loading}
          >
            {pendingAction === "save" ? "Saving…" : "Save securely"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
