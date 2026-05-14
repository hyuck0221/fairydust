import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Check,
  ChevronDown,
  Copy,
  Github,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
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

type WebhookEvent = {
  id: number;
  status: "success" | "failed" | "duplicate" | "test" | "processing";
  statusDetail: string | null;
  verified: boolean;
  eventName: string | null;
  eventTimestamp: string | null;
  paymentId: string | null;
  amount: number | null;
  fairyName: string | null;
  fairyMessage: string | null;
  projectName: string | null;
  source: string | null;
  repoOwner: string | null;
  repoName: string | null;
  targetFile: string | null;
  createdAt: string;
};

type EventsResponse = {
  events: WebhookEvent[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
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
  const path = window.location.pathname;

  useEffect(() => {
    void api<{ user: User | null }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  if (path === "/terms") return <LegalPage type="terms" user={user || null} />;
  if (path === "/privacy") return <LegalPage type="privacy" user={user || null} />;

  if (user === undefined) {
    return (
      <main className="centered">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  if (!user) return <LandingPage />;

  return <Dashboard initialUser={user} />;
}

function Dashboard({ initialUser }: { initialUser: User }) {
  const [user, setUser] = useState<User>(initialUser);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [eventTotalPages, setEventTotalPages] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettings | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [reposLoading, setReposLoading] = useState(true);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [eventProjectFilter, setEventProjectFilter] = useState("");
  const [eventPage, setEventPage] = useState(1);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoQuery, setRepoQuery] = useState("");
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
    setDashboardLoading(true);
    setReposLoading(true);
    setMappingsLoading(true);
    setEventsLoading(true);
    setError(null);
    try {
      const [me, repoData, mappingData, settingsData, eventData] = await Promise.all([
        api<{ user: User | null }>("/api/auth/me"),
        api<{ repos: Repo[] }>("/api/repos"),
        api<{ mappings: Mapping[] }>("/api/mappings"),
        api<WebhookSettings>("/api/webhook-settings"),
        api<EventsResponse>("/api/webhook-events?page=1&perPage=30")
      ]);

      if (me.user) setUser(me.user);
      setRepos(repoData.repos);
      setMappings(mappingData.mappings);
      setWebhookSettings(settingsData);
      setEvents(eventData.events);
      setEventTotal(eventData.total);
      setEventTotalPages(eventData.totalPages);
      setEventPage(1);
      setForm((current) => ({
        ...current,
        repoFullName: current.repoFullName || repoData.repos[0]?.fullName || ""
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setDashboardLoading(false);
      setReposLoading(false);
      setMappingsLoading(false);
      setEventsLoading(false);
    }
  }

  async function refreshRepos() {
    setReposLoading(true);
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
      setReposLoading(false);
    }
  }

  async function refreshEvents(page = eventPage, showLoading = true) {
    if (showLoading) setEventsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "30"
      });
      if (eventProjectFilter) params.set("projectName", eventProjectFilter);
      const data = await api<EventsResponse>(`/api/webhook-events?${params.toString()}`);
      setEvents(data.events);
      setEventTotal(data.total);
      setEventTotalPages(data.totalPages);
      setEventPage(data.page);
    } catch (caught) {
      if (showLoading) {
        setError(caught instanceof Error ? caught.message : "웹훅 이력을 불러오지 못했습니다.");
      }
    } finally {
      if (showLoading) setEventsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshEvents(eventPage, false);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [eventPage, eventProjectFilter]);

  useEffect(() => {
    if (!dashboardLoading) void refreshEvents(1);
  }, [eventProjectFilter]);

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.fullName === form.repoFullName),
    [form.repoFullName, repos]
  );

  const filteredRepos = useMemo(() => {
    const query = repoQuery.trim().toLowerCase();
    if (!query) return repos;
    return repos.filter((repo) =>
      [repo.fullName, repo.owner, repo.name].some((value) => value.toLowerCase().includes(query))
    );
  }, [repoQuery, repos]);

  const eventProjects = useMemo(
    () => Array.from(new Set(mappings.map((mapping) => mapping.projectName))).sort(),
    [mappings]
  );

  const successCount = events.filter((event) => event.status === "success").length;
  const failedCount = events.filter((event) => event.status === "failed").length;

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
      await refreshEvents(1, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결 해제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function sendRealTest(mapping: Mapping) {
    const ok = window.confirm(`${mapping.projectName}에 실제 반영 테스트를 보낼까요? 연결된 GitHub 파일이 수정됩니다.`);
    if (!ok) return;

    setTestingId(mapping.id);
    setError(null);
    try {
      await api("/api/test-webhook", {
        method: "POST",
        body: JSON.stringify({ mappingId: mapping.id })
      });
      await refreshEvents(1, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "실제 반영 테스트에 실패했습니다.");
    } finally {
      setTestingId(null);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
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
            <RepoPicker
              repos={filteredRepos}
              selectedRepo={selectedRepo}
              query={repoQuery}
              open={repoOpen}
              loading={reposLoading}
              onQueryChange={setRepoQuery}
              onOpenChange={setRepoOpen}
              onRefresh={() => void refreshRepos()}
              onSelect={(repo) => {
                setForm((current) => ({ ...current, repoFullName: repo.fullName }));
                setRepoOpen(false);
                setRepoQuery("");
              }}
            />
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

          <button className="primary-button" type="submit" disabled={saving || reposLoading || !repos.length}>
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
            {mappingsLoading && <SkeletonList count={3} />}
            {!mappingsLoading && mappings.length === 0 && (
              <div className="empty-state">아직 등록된 연결이 없습니다.</div>
            )}
            {!mappingsLoading && mappings.map((mapping) => (
              <article className="mapping-card" key={mapping.id}>
                <div className="mapping-card-header">
                  <div className="mapping-main">
                    <strong>{mapping.repoOwner}/{mapping.repoName}</strong>
                    <span>{mapping.projectName} → {mapping.targetFile}</span>
                  </div>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => void sendRealTest(mapping)}
                      disabled={testingId === mapping.id}
                    >
                      {testingId === mapping.id ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                      실제 테스트
                    </button>
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
                </div>
                <div className="option-row">
                  <span>{mapping.showName ? "이름" : "익명"}</span>
                  <span>{mapping.showAmount ? "금액 표시" : "금액 숨김"}</span>
                  <span>{mapping.showMessage ? "메시지 표시" : "메시지 숨김"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="monitor-panel">
        <div className="monitor-heading">
          <div className="panel-heading">
            <h2>Webhook 모니터링</h2>
            <p>최근 수신 이력과 처리 결과를 프로젝트별로 확인합니다.</p>
          </div>
          <div className="monitor-actions">
            <select
              value={eventProjectFilter}
              onChange={(event) => setEventProjectFilter(event.target.value)}
              aria-label="프로젝트 필터"
            >
              <option value="">전체 프로젝트</option>
              {eventProjects.map((projectName) => (
                <option key={projectName} value={projectName}>
                  {projectName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              onClick={() => void refreshEvents(eventPage)}
              disabled={eventsLoading}
              aria-label="웹훅 이력 새로고침"
            >
              {eventsLoading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            </button>
          </div>
        </div>

        <div className="monitor-summary">
          <div>
            <span>현재 페이지</span>
            <strong>{eventsLoading ? "-" : events.length}</strong>
          </div>
          <div>
            <span>성공</span>
            <strong>{eventsLoading ? "-" : successCount}</strong>
          </div>
          <div>
            <span>실패</span>
            <strong>{eventsLoading ? "-" : failedCount}</strong>
          </div>
        </div>

        <div className="event-list compact-events">
          {eventsLoading && <SkeletonList count={6} compact />}
          {!eventsLoading && events.length === 0 && (
            <div className="empty-state">아직 수신된 웹훅 이력이 없습니다.</div>
          )}
          {!eventsLoading && events.map((event) => (
            <article className="event-row" key={event.id}>
              <span className={`status-pill ${event.status}`}>{statusLabel(event.status)}</span>
              <span className="event-time">{formatDate(event.createdAt)}</span>
              <strong>{event.projectName || "projectName 없음"}</strong>
              <span>{event.paymentId || "paymentId 없음"}</span>
              <span>{typeof event.amount === "number" ? `${event.amount.toLocaleString("ko-KR")}원` : "금액 없음"}</span>
              <span>{event.repoOwner && event.repoName ? `${event.repoOwner}/${event.repoName}` : "매핑 없음"}</span>
              <span>{event.verified ? "검증 성공" : "검증 실패"}</span>
              <span className="event-detail-inline">{event.statusDetail || event.source || "-"}</span>
            </article>
          ))}
        </div>

        <div className="pagination-row">
          <span>총 {eventTotal.toLocaleString("ko-KR")}개</span>
          <div>
            <button
              type="button"
              className="secondary-button compact-button"
              disabled={eventsLoading || eventPage <= 1}
              onClick={() => void refreshEvents(eventPage - 1)}
            >
              이전
            </button>
            <span>{eventPage} / {eventTotalPages}</span>
            <button
              type="button"
              className="secondary-button compact-button"
              disabled={eventsLoading || eventPage >= eventTotalPages}
              onClick={() => void refreshEvents(eventPage + 1)}
            >
              다음
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function RepoPicker(props: {
  repos: Repo[];
  selectedRepo: Repo | undefined;
  query: string;
  open: boolean;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onSelect: (repo: Repo) => void;
}) {
  return (
    <div className="repo-picker">
      <label>GitHub repository</label>
      <div className="repo-control-row">
        <button type="button" className="repo-trigger" onClick={() => props.onOpenChange(!props.open)}>
          <span>{props.selectedRepo?.fullName || "저장소 선택"}</span>
          <ChevronDown size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={props.onRefresh}
          disabled={props.loading}
          aria-label="GitHub 저장소 목록 새로고침"
          title="GitHub 저장소 목록 새로고침"
        >
          {props.loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
        </button>
      </div>
      {props.open && (
        <div className="repo-popover">
          <div className="repo-search">
            <Search size={16} />
            <input
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="repository 검색"
              autoFocus
            />
          </div>
          <div className="repo-options">
            {props.loading && <SkeletonList count={4} compact />}
            {!props.loading && props.repos.length === 0 && <div className="repo-empty">검색 결과가 없습니다.</div>}
            {!props.loading && props.repos.map((repo) => (
              <button type="button" key={repo.id} className="repo-option" onClick={() => props.onSelect(repo)}>
                <strong>{repo.fullName}</strong>
                <span>{repo.private ? "private" : "public"} · {repo.defaultBranch}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LandingPage() {
  return (
    <main className="public-shell">
      <nav className="public-nav">
        <a className="public-brand" href="/">
          <Sparkles size={20} />
          Fairydust
        </a>
        <div>
          <a href="/terms">이용약관</a>
          <a href="/privacy">데이터처리방침</a>
          <a className="nav-login" href="/api/auth/github/start">GitHub 로그인</a>
        </div>
      </nav>

      <section className="public-hero">
        <h1>Fairy 후원을 GitHub 프로젝트에 자동으로 남기세요.</h1>
        <p>
          유저별 웹훅 URL 하나로 후원 payload를 받고, projectName 매핑에 따라 README나 지정 파일에 후원 정보를 업데이트합니다.
        </p>
        <a className="primary-link" href="/api/auth/github/start">
          <Github size={18} />
          GitHub로 시작하기
        </a>
      </section>

      <section className="public-grid">
        <article>
          <h2>프로젝트 매핑</h2>
          <p>Fairy의 projectName을 여러 GitHub repository와 파일에 연결합니다.</p>
        </article>
        <article>
          <h2>표시 옵션</h2>
          <p>후원자 이름, 금액, 메시지를 프로젝트별로 선택해 노출합니다.</p>
        </article>
        <article>
          <h2>모니터링</h2>
          <p>웹훅 수신, 서명 검증, GitHub 반영 결과를 관리자 화면에서 확인합니다.</p>
        </article>
      </section>
    </main>
  );
}

function LegalPage({ type, user }: { type: "terms" | "privacy"; user: User | null }) {
  const isTerms = type === "terms";
  return (
    <main className="public-shell legal-shell">
      <nav className="public-nav">
        <a className="public-brand" href="/">
          <Sparkles size={20} />
          Fairydust
        </a>
        <div>
          <a href={isTerms ? "/privacy" : "/terms"}>{isTerms ? "데이터처리방침" : "이용약관"}</a>
          <a className="nav-login" href={user ? "/" : "/api/auth/github/start"}>{user ? "대시보드" : "GitHub 로그인"}</a>
        </div>
      </nav>
      <article className="legal-card">
        <h1>{isTerms ? "이용약관" : "데이터처리방침"}</h1>
        <p>최종 업데이트: 2026년 5월 14일</p>
        {isTerms ? <TermsContent /> : <PrivacyContent />}
      </article>
    </main>
  );
}

function TermsContent() {
  return (
    <>
      <h2>서비스 목적</h2>
      <p>Fairydust는 Fairy 후원 웹훅과 GitHub repository를 연결해 사용자가 지정한 파일에 후원 정보를 표시하는 도구입니다.</p>
      <h2>사용자 책임</h2>
      <p>사용자는 본인이 권한을 가진 GitHub repository만 연결해야 하며, Fairy secret과 GitHub 권한을 안전하게 관리해야 합니다.</p>
      <h2>제한 사항</h2>
      <p>외부 서비스 장애, GitHub API 제한, 잘못된 projectName 매핑으로 인해 업데이트가 실패할 수 있습니다. 모니터링 화면에서 처리 결과를 확인해야 합니다.</p>
      <h2>변경</h2>
      <p>서비스 기능과 약관은 운영 필요에 따라 변경될 수 있으며, 중요한 변경은 화면 또는 저장소 문서로 안내합니다.</p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h2>처리하는 데이터</h2>
      <p>GitHub 계정 정보, 암호화된 GitHub access token, Fairy webhook secret, projectName 매핑, 웹훅 처리 이력을 저장합니다.</p>
      <h2>사용 목적</h2>
      <p>저장된 데이터는 로그인, repository 조회, 파일 업데이트, 웹훅 서명 검증, 처리 결과 모니터링에만 사용합니다.</p>
      <h2>보관</h2>
      <p>연결 해제 시 해당 매핑은 삭제됩니다. 웹훅 이력은 운영 점검과 문제 해결을 위해 보관될 수 있습니다.</p>
      <h2>보안</h2>
      <p>GitHub access token과 Fairy secret은 애플리케이션 암호화 키로 암호화해 저장합니다. 운영 환경의 환경변수와 DB 접근 권한은 별도로 보호해야 합니다.</p>
    </>
  );
}

function SkeletonList({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className={compact ? "skeleton-row compact" : "skeleton-row"} key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </>
  );
}

function statusLabel(status: WebhookEvent["status"]): string {
  const labels: Record<WebhookEvent["status"], string> = {
    success: "성공",
    failed: "실패",
    duplicate: "중복",
    test: "테스트",
    processing: "처리 중"
  };
  return labels[status];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
