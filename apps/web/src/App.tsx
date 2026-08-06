import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type {
  CaseDetail,
  CaseSummary,
  SpecimenType,
  User,
} from "./types";
import { Header } from "./components/Header";
import { Login } from "./components/Login";
import { CaseList } from "./components/CaseList";
import { CaseDetail as CaseDetailView } from "./components/CaseDetail";
import { CreateCaseDialog } from "./components/CreateCaseDialog";
import { AiSettingsDialog } from "./components/AiSettingsDialog";
import { AuditDialog } from "./components/AuditDialog";
import { UserManagementDialog } from "./components/UserManagementDialog";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setUser(null);
      setCases([]);
      setSelectedCase(null);
      setSelectedId(null);
      return true;
    }
    return false;
  }, []);

  const loadCases = useCallback(async () => {
    try {
      const result = await api.listCases();
      setCases(result.cases);
      setSelectedId((current) => {
        if (current && result.cases.some((item) => item.id === current)) {
          return current;
        }
        return result.cases[0]?.id ?? null;
      });
    } catch (error) {
      if (!handleAuthError(error)) {
        setPageError(
          error instanceof Error ? error.message : "Could not load cases",
        );
      }
    }
  }, [handleAuthError]);

  const loadSelectedCase = useCallback(async () => {
    if (!selectedId) {
      setSelectedCase(null);
      return;
    }

    try {
      const result = await api.getCase(selectedId);
      setSelectedCase(result.case);
    } catch (error) {
      if (!handleAuthError(error)) {
        setPageError(
          error instanceof Error ? error.message : "Could not load case",
        );
      }
    }
  }, [handleAuthError, selectedId]);

  const refreshAll = useCallback(async () => {
    await loadCases();
    await loadSelectedCase();
  }, [loadCases, loadSelectedCase]);

  useEffect(() => {
    void api
      .me()
      .then(({ user: current }) => {
        setUser(current);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      void loadCases();
    }
  }, [user, loadCases]);

  useEffect(() => {
    if (user) {
      void loadSelectedCase();
    }
  }, [user, loadSelectedCase]);

  useEffect(() => {
    if (user?.role === "ADMIN" && pageError.includes("case:read")) {
      setPageError("");
    }
  }, [user, pageError]);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    setUser(result.user);
    setPageError("");
  }

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
    setCases([]);
    setSelectedId(null);
    setSelectedCase(null);
  }

  async function createCase(input: {
    caseCode: string;
    specimenType: SpecimenType;
    collectionDate: string;
    cultureMedia: string;
    incubationHours: number;
    notes?: string;
  }) {
    const result = await api.createCase(input);
    await loadCases();
    setSelectedId(result.case.id);
  }

  async function archiveSelected() {
    if (!selectedId) return;
    await api.archiveCase(selectedId);
    setSelectedId(null);
    setSelectedCase(null);
    await loadCases();
  }

  if (loading) {
    return (
      <main className="login-page">
        <div className="login-card">Loading secure session…</div>
      </main>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="app-shell">
      <Header
        user={user}
        onSettings={() => setShowSettings(true)}
        onUsers={() => setShowUsers(true)}
        onAudit={() => setShowAudit(true)}
        onLogout={() => void logout()}
      />

      <div className="workspace">
        <CaseList
          cases={cases}
          selectedId={selectedId}
          role={user.role}
          onSelect={setSelectedId}
          onCreate={() => setShowCreate(true)}
        />

        <main className="content">
          {pageError ? (
            <div className="notice error" role="alert">
              {pageError}
            </div>
          ) : null}

          {selectedCase ? (
            <CaseDetailView
              item={selectedCase}
              role={user.role}
              onRefresh={refreshAll}
              onArchive={archiveSelected}
            />
          ) : user.role === "ADMIN" ? (
            <section className="panel empty-state">
              <div>
                <h2>Administration workspace</h2>
                <p>
                  Use AI provider settings and the audit log. Case access is
                  read-only for administrators.
                </p>
              </div>
            </section>
          ) : (
            <section className="panel empty-state">
              <div>
                <h2>No case selected</h2>
                <p>
                  Select an existing case or create a new draft if your role
                  permits it.
                </p>
              </div>
            </section>
          )}
        </main>
      </div>

      {showCreate ? (
        <CreateCaseDialog
          onClose={() => setShowCreate(false)}
          onCreate={createCase}
        />
      ) : null}

      {showSettings ? (
        <AiSettingsDialog onClose={() => setShowSettings(false)} />
      ) : null}

      {showAudit ? (
        <AuditDialog onClose={() => setShowAudit(false)} />
      ) : null}

      {showUsers ? (
        <UserManagementDialog
          currentUserId={user.id}
          onClose={() => setShowUsers(false)}
        />
      ) : null}
    </div>
  );
}
