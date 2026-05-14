import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Check,
  Copy,
  Github,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2
} from "lucide-react";
import "./styles.css";

type User = {
  id: number;
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
};

type Repo = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
};

type Mapping = {
  id: number;
  repoOwner: string;
  repoName: string;
  projectName: string;
  targetFile: string;
  showName: boolean;
  showAmount: boolean;
  showMessage: boolean;
  enabled: boolean;
};

type WebhookSettings = {
  webhookUrl: string;
  hasSecret: boolean;
  fairyWebhookSecret: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    repoFullName: "",
    projectName: "",
    targetFile: "README.md",
    showName: true,
    showAmount: false,
    showMessage: false
  });

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const me = await api<{ user: User | null }>("/api/auth/me");
      setUser(me.user);
      if (me.user) {
        const [repoData, mappingData, settingsData] = await Promise.all([
          api<{ repos: Repo[] }>("/api/repos"),
          api<{ mappings: Mapping[] }>("/api/mappings"),
          api<WebhookSettings>("/api/webhook-settings")
        ]);
        setRepos(repoData.repos);
        setMappings(mappingData.mappings);
        setWebhookSettings(settingsData);
        setForm((current) => ({
          ...current,
          repoFullName: current.repoFullName || repoData.repos[0]?.fullName || ""
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRepos() {
    setLoading(true);
    setError(null);
    try {
      const repoData = await api<{ repos: Repo[] }>("/api/repos");
      setRepos(repoData.repos);
      setForm((current) => ({
        ...current,
        repoFullName: repoData.repos.some((repo) => repo.fullName === current.repoFullName)
          ? current.repoFullName
          : repoData.repos[0]?.fullName || ""
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장소 목록을 새로고침하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.fullName === form.repoFullName),
    [form.repoFullName, repos]
  );

  async function createMapping(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRepo) return;

    setSaving(true);
    setError(null);
    try {
      const data = await api<{ mapping: Mapping }>("/api/mappings", {
        method: "POST",
        body: JSON.stringify({
          repoOwner: selectedRepo.owner,
          repoName: selectedRepo.name,
          projectName: form.projectName,
          targetFile: form.targetFile,
          showName: form.showName,
          showAmount: form.showAmount,
          showMessage: form.showMessage
        })
      });
      setMappings((current) => [data.mapping, ...current]);
      setForm((current) => ({ ...current, projectName: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "매핑 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWebhookSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!webhookSettings) return;

    setSettingsSaving(true);
    setError(null);
    try {
      await api("/api/webhook-settings", {
        method: "PUT",
        body: JSON.stringify({ fairyWebhookSecret: webhookSettings.fairyWebhookSecret })
      });
      const next = await api<WebhookSettings>("/api/webhook-settings");
      setWebhookSettings(next);
      setSettingsOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Webhook 설정 저장에 실패했습니다.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function copyWebhookUrl() {
    if (!webhookSettings?.webhookUrl) return;
    await navigator.clipboard.writeText(webhookSettings.webhookUrl);
    setWebhookCopied(true);
    window.setTimeout(() => setWebhookCopied(false), 1600);
  }

  async function deleteMapping(mapping: Mapping) {
    const ok = window.confirm(`${mapping.projectName} 연결을 해제할까요?`);
    if (!ok) return;

    setDeletingId(mapping.id);
    setError(null);
    try {
      await api(`/api/mappings?id=${mapping.id}`, { method: "DELETE" });
      setMappings((current) => current.filter((item) => item.id !== mapping.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결 해제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setRepos([]);
    setMappings([]);
    setWebhookSettings(null);
  }

  if (user === undefined) {
    return (
      <main className="centered">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand-mark">
            <Sparkles size={28} />
          </div>
          <h1>Fairydust</h1>
          <p>Fairy 후원이 오면 GitHub 프로젝트 파일에 후원 정보를 자동으로 남깁니다.</p>
          <a className="primary-link" href="/api/auth/github/start">
            <Github size={18} />
            GitHub로 시작하기
          </a>
          <p className="fine-print">
            README나 지정 파일을 수정하려면 GitHub 저장소 쓰기 권한이 필요합니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="title-wrap">
          <div className="brand-mark small">
            <Sparkles size={20} />
          </div>
          <div>
            <h1>Fairydust</h1>
            <p>Fairy 웹훅을 GitHub 노출 영역으로 연결합니다.</p>
          </div>
        </div>
        <div className="account">
          {user.githubAvatarUrl && <img src={user.githubAvatarUrl} alt="" />}
          <span>{user.githubName || user.githubLogin}</span>
          <button type="button" className="settings-button" onClick={() => setSettingsOpen(true)}>
            <Settings size={17} />
            Webhook 설정
          </button>
          <button type="button" className="icon-button" onClick={() => void loadDashboard()} aria-label="새로고침">
            <RefreshCw size={17} />
          </button>
          <button type="button" className="icon-button" onClick={() => void logout()} aria-label="로그아웃">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {settingsOpen && webhookSettings && (
        <div className="modal-backdrop" role="presentation">
          <form className="settings-modal" onSubmit={(event) => void saveWebhookSettings(event)}>
            <div className="panel-heading">
              <h2>Fairy Webhook 설정</h2>
              <p>이 URL 하나를 Fairy 관리자에 등록하고, 같은 secret을 여기에 저장합니다.</p>
            </div>

            <label>
              유저 Webhook URL
              <div className="copy-field">
                <code>{webhookSettings.webhookUrl}</code>
                <button type="button" className="icon-button" onClick={() => void copyWebhookUrl()} aria-label="웹훅 URL 복사">
                  {webhookCopied ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
            </label>

            <label>
              Fairy webhook secret
              <input
                type="password"
                value={webhookSettings.fairyWebhookSecret}
                onChange={(event) =>
                  setWebhookSettings((current) =>
                    current ? { ...current, fairyWebhookSecret: event.target.value } : current
                  )
                }
                placeholder={webhookSettings.hasSecret ? "이미 저장됨 · 변경할 때만 입력" : "Fairy에 설정한 secret"}
                required={!webhookSettings.hasSecret}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)}>
                닫기
              </button>
              <button type="submit" className="primary-button" disabled={settingsSaving}>
                {settingsSaving ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="workspace">
        <form className="setup-panel" onSubmit={(event) => void createMapping(event)}>
          <div className="panel-heading">
            <h2>새 프로젝트 매핑</h2>
            <p>Fairy payload의 projectName을 GitHub 저장소와 파일에 연결합니다.</p>
          </div>

          <div className="field-with-action">
            <label>
              GitHub repository
              <select
                value={form.repoFullName}
                onChange={(event) => setForm((current) => ({ ...current, repoFullName: event.target.value }))}
                required
              > 
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName}{repo.private ? " · private" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button field-action"
              onClick={() => void refreshRepos()}
              disabled={loading}
              aria-label="GitHub 저장소 목록 새로고침"
              title="GitHub 저장소 목록 새로고침"
            >
              {loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            </button>
          </div>

          <label>
            Fairy projectName
            <input
              value={form.projectName}
              onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))}
              placeholder="예: my-project"
              required
            />
          </label>

          <label>
            업데이트할 파일
            <input
              value={form.targetFile}
              onChange={(event) => setForm((current) => ({ ...current, targetFile: event.target.value }))}
              placeholder="README.md"
              required
            />
          </label>

          <div className="checkbox-grid">
            <label>
              <input
                type="checkbox"
                checked={form.showName}
                onChange={(event) => setForm((current) => ({ ...current, showName: event.target.checked }))}
              />
              후원자 이름 표시
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.showAmount}
                onChange={(event) => setForm((current) => ({ ...current, showAmount: event.target.checked }))}
              />
              후원 금액 표시
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.showMessage}
                onChange={(event) => setForm((current) => ({ ...current, showMessage: event.target.checked }))}
              />
              후원 메시지 표시
            </label>
          </div>

          <button className="primary-button" type="submit" disabled={saving || loading || !repos.length}>
            {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            연결 생성
          </button>
        </form>

        <section className="mapping-panel">
          <div className="panel-heading">
            <h2>등록된 연결</h2>
            <p>같은 유저 webhook URL 안에서 projectName으로 대상 저장소를 찾습니다.</p>
          </div>

          <div className="mapping-list">
            {mappings.length === 0 && (
              <div className="empty-state">아직 등록된 연결이 없습니다.</div>
            )}
            {mappings.map((mapping) => (
              <article className="mapping-card" key={mapping.id}>
                <div className="mapping-main">
                  <strong>{mapping.repoOwner}/{mapping.repoName}</strong>
                  <span>{mapping.projectName} → {mapping.targetFile}</span>
                </div>
                <div className="option-row">
                  <span>{mapping.showName ? "이름" : "익명"}</span>
                  <span>{mapping.showAmount ? "금액 표시" : "금액 숨김"}</span>
                  <span>{mapping.showMessage ? "메시지 표시" : "메시지 숨김"}</span>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void deleteMapping(mapping)}
                    disabled={deletingId === mapping.id}
                  >
                    {deletingId === mapping.id ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                    연결 해제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
