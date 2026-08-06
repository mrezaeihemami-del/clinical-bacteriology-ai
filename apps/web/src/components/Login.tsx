import { useState, type FormEvent } from "react";
import { FlaskConical } from "lucide-react";

export function Login(props: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("technician@example.test");
  const [password, setPassword] = useState("ChangeMe-123!");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await props.onLogin(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          <FlaskConical size={24} />
        </div>
        <h1 id="login-title">Clinical Bacteriology Assistant</h1>
        <p>
          Human-reviewed visual observations only. This software is not a
          diagnostic device and does not replace microbiologist review.
        </p>

        <form className="login-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? (
            <div className="notice error" role="alert">
              {error}
            </div>
          ) : null}
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="muted">
          Development accounts are created by <code>npm run db:seed</code>.
          Change all seeded passwords outside local development.
        </p>
      </section>
    </main>
  );
}
