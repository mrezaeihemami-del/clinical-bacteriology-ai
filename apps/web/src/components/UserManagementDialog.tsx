import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { ManagedUser, Role } from "../types";
import { Modal } from "./Modal";

const roles: Role[] = [
  "TECHNICIAN",
  "MICROBIOLOGIST",
  "SUPERVISOR",
  "ADMIN",
];

export function UserManagementDialog(props: {
  currentUserId: string;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("TECHNICIAN");
  const [resetPasswords, setResetPasswords] = useState<
    Record<string, string>
  >({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const result = await api.listUsers();
    setUsers(result.users);
  }

  useEffect(() => {
    void load().catch((caught) =>
      setError(
        caught instanceof Error ? caught.message : "Could not load users",
      ),
    );
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await api.createUser({
        email,
        displayName,
        password,
        role,
      });
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("TECHNICIAN");
      await load();
      setMessage("User created with an organisation-scoped role.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creation failed");
    } finally {
      setPending(false);
    }
  }

  async function updateUser(
    userId: string,
    input: {
      role?: Role;
      disabled?: boolean;
    },
  ) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await api.updateUser(userId, input);
      await load();
      setMessage("User access updated. Disabled users lose active sessions.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(userId: string) {
    const nextPassword = resetPasswords[userId] ?? "";
    if (nextPassword.length < 12) {
      setError("Replacement passwords must contain at least 12 characters.");
      return;
    }

    setPending(true);
    setError("");
    setMessage("");
    try {
      await api.resetUserPassword(userId, nextPassword);
      setResetPasswords((current) => ({ ...current, [userId]: "" }));
      setMessage("Password replaced and all sessions for that user revoked.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Password reset failed",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Organisation users and roles" onClose={props.onClose} wide>
      <div className="notice warning">
        Roles are enforced by the server. Administrators can manage accounts
        but do not automatically receive access to clinical cases.
      </div>

      <form className="section grid" onSubmit={create}>
        <h3>Create user</h3>
        <div className="grid two">
          <div className="field">
            <label htmlFor="new-user-name">Display name</label>
            <input
              id="new-user-name"
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={200}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-user-email">Email</label>
            <input
              id="new-user-email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid two">
          <div className="field">
            <label htmlFor="new-user-password">Temporary password</label>
            <input
              id="new-user-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-user-role">Role</label>
            <select
              id="new-user-role"
              className="select"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="button primary" type="submit" disabled={pending}>
          Create user
        </button>
      </form>

      <div className="section">
        <h3>Existing users</h3>
        <div className="grid">
          {users.map((user) => (
            <article className="panel" key={user.id}>
              <div className="panel-body">
                <div className="actions">
                  <strong>{user.displayName}</strong>
                  <span className={`status ${user.disabled ? "error" : "success"}`}>
                    {user.disabled ? "DISABLED" : "ACTIVE"}
                  </span>
                </div>
                <p className="muted">{user.email}</p>

                <div className="grid two">
                  <div className="field">
                    <label htmlFor={`role-${user.id}`}>Role</label>
                    <select
                      id={`role-${user.id}`}
                      className="select"
                      value={user.role}
                      disabled={pending}
                      onChange={(event) =>
                        void updateUser(user.id, {
                          role: event.target.value as Role,
                        })
                      }
                    >
                      {roles.map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor={`password-${user.id}`}>
                      Replacement password
                    </label>
                    <div className="actions">
                      <input
                        id={`password-${user.id}`}
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        value={resetPasswords[user.id] ?? ""}
                        onChange={(event) =>
                          setResetPasswords((current) => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="button secondary"
                        type="button"
                        disabled={pending}
                        onClick={() => void resetPassword(user.id)}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  className={`button ${user.disabled ? "secondary" : "danger"} section`}
                  type="button"
                  disabled={pending || user.id === props.currentUserId}
                  onClick={() =>
                    void updateUser(user.id, {
                      disabled: !user.disabled,
                    })
                  }
                >
                  {user.disabled ? "Re-enable user" : "Disable user"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

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
    </Modal>
  );
}
