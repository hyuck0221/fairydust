import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Github,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
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
  templateKey: string;
  templateBody: string | null;
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

const sponsorTemplates = [
  {
    key: "simple",
    name: "깔끔한 리스트",
    body: "- **{NAME}** 님이 {AMOUNT} 후원해주셨어요. {MESSAGE}"
  },
  {
    key: "card",
    name: "감사 카드",
    body: "> **{NAME}**\n>\n> {MESSAGE}\n>\n> 후원 금액: {AMOUNT} · {DATE}"
  },
  {
    key: "table",
    name: "표 형태",
    body: "| 날짜 | 후원자 | 금액 | 메시지 |\n| --- | --- | ---: | --- |\n| {DATE} | {NAME} | {AMOUNT} | {MESSAGE} |"
  },
  {
    key: "sparkle",
    name: "반짝이는 한 줄",
    body: "- Thanks, **{NAME}**. {MESSAGE} _{AMOUNT}_"
  }
];

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
  const [accountDeleting, setAccountDeleting] = useState(false);
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
    showMessage: false,
    templateKey: "simple",
    templateBody: sponsorTemplates[0].body
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

  const connectedRepoNames = useMemo(
    () => new Set(mappings.map((mapping) => `${mapping.repoOwner}/${mapping.repoName}`)),
    [mappings]
  );

  const selectedRepoAlreadyConnected = selectedRepo ? connectedRepoNames.has(selectedRepo.fullName) : false;

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
          showMessage: form.showMessage,
          templateKey: form.templateKey,
          templateBody: form.templateKey === "custom" ? form.templateBody : undefined
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

  async function deleteAccount() {
    const ok = window.confirm(
      "계정을 탈퇴하면 GitHub 연결, Fairy 설정, 등록된 연결, 웹훅 수신 이력이 모두 완전히 삭제됩니다. 계속할까요?"
    );
    if (!ok) return;

    setAccountDeleting(true);
    setError(null);
    try {
      await api("/api/account", { method: "DELETE" });
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "계정 탈퇴 처리에 실패했습니다.");
      setAccountDeleting(false);
    }
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

            <div className="danger-zone">
              <div>
                <strong>계정 및 데이터 삭제</strong>
                <p>탈퇴하면 저장된 GitHub 연결, Fairy 설정, 등록된 연결, 수신 이력이 모두 삭제됩니다.</p>
              </div>
              <button type="button" className="danger-button" onClick={() => void deleteAccount()} disabled={accountDeleting}>
                {accountDeleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                탈퇴
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="workspace">
        <form className="setup-panel" onSubmit={(event) => void createMapping(event)}>
          <div className="panel-heading">
            <h2>새 프로젝트 매핑</h2>
            <p>Fairy에서 쓰는 후원 항목 이름을 GitHub 저장소와 파일에 연결합니다.</p>
          </div>

          <div className="field-with-action">
            <RepoPicker
              repos={filteredRepos}
              selectedRepo={selectedRepo}
              connectedRepoNames={connectedRepoNames}
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

          {selectedRepoAlreadyConnected && (
            <div className="inline-warning">이미 연결된 저장소입니다. 저장소 하나당 하나의 연결만 만들 수 있습니다.</div>
          )}

          <label>
            Fairy 후원 항목 이름
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

          <label>
            표시 템플릿
            <select
              value={form.templateKey}
              onChange={(event) => {
                const templateKey = event.target.value;
                const template = sponsorTemplates.find((item) => item.key === templateKey);
                setForm((current) => ({
                  ...current,
                  templateKey,
                  templateBody: template?.body || current.templateBody
                }));
              }}
            >
              {sponsorTemplates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
              <option value="custom">직접 만들기</option>
            </select>
          </label>

          {form.templateKey === "custom" && (
            <label>
              직접 만든 템플릿
              <textarea
                value={form.templateBody}
                onChange={(event) => setForm((current) => ({ ...current, templateBody: event.target.value }))}
                placeholder="- **{NAME}** 님의 후원: {AMOUNT} {MESSAGE}"
                rows={5}
              />
            </label>
          )}

          <div className="template-helper">
            <span>사용 가능한 변수</span>
            <code>{"{NAME}"}</code>
            <code>{"{AMOUNT}"}</code>
            <code>{"{MESSAGE}"}</code>
            <code>{"{DATE}"}</code>
          </div>

          <div className="template-preview">
            <span>미리보기</span>
            <div className="github-markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {renderTemplatePreview(form)}
              </ReactMarkdown>
            </div>
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={saving || reposLoading || !repos.length || selectedRepoAlreadyConnected}
          >
            {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            연결 생성
          </button>
        </form>

        <section className="mapping-panel">
          <div className="panel-heading">
            <h2>등록된 연결</h2>
            <p>유저 전용 Webhook URL 하나로 받은 후원을 항목 이름에 맞춰 반영합니다.</p>
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
                  <span>{templateName(mapping.templateKey)}</span>
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
              <strong>{event.projectName || "후원 항목 없음"}</strong>
              <span>{event.paymentId || "결제 ID 없음"}</span>
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
  connectedRepoNames: Set<string>;
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
      <label>GitHub 저장소</label>
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
              placeholder="저장소 검색"
              autoFocus
            />
          </div>
          <div className="repo-options">
            {props.loading && <SkeletonList count={4} compact />}
            {!props.loading && props.repos.length === 0 && <div className="repo-empty">검색 결과가 없습니다.</div>}
            {!props.loading && props.repos.map((repo) => {
              const connected = props.connectedRepoNames.has(repo.fullName);
              return (
                <button
                  type="button"
                  key={repo.id}
                  className="repo-option"
                  onClick={() => props.onSelect(repo)}
                  disabled={connected}
                >
                  <strong>{repo.fullName}</strong>
                  <span>
                    {repo.private ? "private" : "public"} · {repo.defaultBranch}
                    {connected ? " · 이미 연결됨" : ""}
                  </span>
                </button>
              );
            })}
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
        <div className="hero-copy">
          <div className="hero-kicker">
            <Sparkles size={16} />
            Fairy 후원을 GitHub에 남기는 가장 쉬운 방법
          </div>
          <h1>후원받은 순간, 프로젝트가 고마움을 기억합니다.</h1>
          <p>
            Fairydust는 Fairy 후원 소식을 받아 README나 원하는 파일에 자동으로 기록합니다. 어떤 저장소에,
            어떤 내용을, 어디까지 보여줄지만 고르면 됩니다.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="/api/auth/github/start">
              <Github size={18} />
              GitHub로 시작하기
            </a>
            <a className="secondary-link" href="https://fairy.hada.io/@fairydust">후원하기</a>
          </div>
        </div>

        <div className="hero-product" aria-hidden="true">
          <div className="preview-window">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
              <strong>README.md</strong>
            </div>
            <div className="readme-preview">
              <span className="readme-label">Sponsors</span>
              <h2>Thanks for supporting Fairydust</h2>
              <div className="supporter-line">
                <span>홍길동</span>
                <strong>응원합니다!</strong>
                <em>방금 반영됨</em>
              </div>
              <div className="supporter-line muted">
                <span>테스트 Fairy</span>
                <strong>멋진 프로젝트예요</strong>
                <em>성공</em>
              </div>
            </div>
          </div>
          <div className="event-preview">
            <span className="event-dot" />
            <div>
              <strong>후원 수신</strong>
              <p>검증 성공 · GitHub 반영 완료</p>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div>
          <strong>1분</strong>
          <span>Fairy에 붙여 넣을 전용 주소 생성</span>
        </div>
        <div>
          <strong>여러 개</strong>
          <span>저장소와 파일을 프로젝트별로 연결</span>
        </div>
        <div>
          <strong>한눈에</strong>
          <span>수신 이력과 반영 결과 확인</span>
        </div>
      </section>

      <section className="public-grid" id="how-it-works">
        <article>
          <span className="step-number">01</span>
          <Github size={22} />
          <h2>GitHub로 로그인</h2>
          <p>내 저장소 목록을 불러오고, 후원 소식을 남길 프로젝트를 선택합니다.</p>
        </article>
        <article>
          <span className="step-number">02</span>
          <FileText size={22} />
          <h2>파일과 표시 방식 선택</h2>
          <p>README처럼 잘 보이는 파일을 고르고 이름, 금액, 메시지 공개 여부를 정합니다.</p>
        </article>
        <article>
          <span className="step-number">03</span>
          <Activity size={22} />
          <h2>후원 도착 즉시 반영</h2>
          <p>Fairy에서 알림이 오면 Fairydust가 연결된 GitHub 파일을 자동으로 업데이트합니다.</p>
        </article>
      </section>

      <section className="public-section">
        <div className="section-heading">
          <span>왜 필요한가요?</span>
          <h2>후원은 받았는데, 보여주는 일은 자꾸 밀리니까요.</h2>
          <p>
            후원자에게 고마움을 표현하는 일은 중요하지만 매번 README를 직접 고치는 건 번거롭습니다.
            Fairydust는 반복 작업만 맡고, 표시 방식은 서비스 운영자가 직접 고를 수 있게 합니다.
          </p>
        </div>
        <div className="workflow-panel">
          <div className="workflow-line">
            <span>01</span>
            <div>
              <strong>Fairy 관리자에 전용 주소를 붙여 넣습니다.</strong>
              <p>계정마다 만들어지는 주소 하나로 후원 알림을 받습니다.</p>
            </div>
          </div>
          <div className="workflow-line">
            <span>02</span>
            <div>
              <strong>후원 항목별로 GitHub 저장소와 파일을 고릅니다.</strong>
              <p>README, 문서 파일, 후원 페이지용 파일을 원하는 대로 나눌 수 있습니다.</p>
            </div>
          </div>
          <div className="workflow-line">
            <span>03</span>
            <div>
              <strong>표시할 내용을 정하고 실제 반영을 테스트합니다.</strong>
              <p>이름, 금액, 메시지 공개 여부를 고른 뒤 버튼 한 번으로 확인합니다.</p>
            </div>
          </div>
          <div className="workflow-result">
            <Check size={18} />
            <strong>이후에는 후원이 들어올 때마다 자동으로 기록됩니다.</strong>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div>
          <span>시작할 준비가 됐다면</span>
          <h2>다음 후원부터는 직접 README를 고치지 마세요.</h2>
          <p>
            GitHub로 로그인하고 첫 연결을 만들면, Fairydust가 후원 소식을 프로젝트에 차곡차곡 남겨드립니다.
          </p>
        </div>
        <a className="primary-link" href="/api/auth/github/start">
          <Github size={18} />
          무료로 연결하기
        </a>
        <p className="privacy-note">
          <ShieldCheck size={16} />
          필요한 연결 정보만 저장하며, 설정 화면에서 탈퇴하면 등록된 연결과 수신 이력이 함께 삭제됩니다.
        </p>
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
      <p>Fairydust는 Fairy 후원 알림을 사용자의 GitHub 저장소와 연결해, 사용자가 지정한 파일에 후원 정보를 자동으로 표시하는 서비스입니다.</p>
      <h2>계정과 권한</h2>
      <p>서비스 이용을 위해 GitHub 로그인이 필요합니다. 사용자는 본인이 관리하거나 수정 권한을 가진 저장소만 연결해야 하며, 연결된 저장소에 발생하는 변경 사항을 직접 확인할 책임이 있습니다.</p>
      <h2>서비스 이용 방식</h2>
      <p>사용자는 후원 항목 이름, GitHub 저장소, 반영할 파일, 표시할 항목을 직접 설정합니다. Fairydust는 설정된 조건에 맞는 후원 알림을 받으면 해당 파일의 Fairydust 영역을 업데이트합니다.</p>
      <h2>금지 사항</h2>
      <p>타인의 저장소를 무단으로 연결하거나, 허위 후원 정보 표시, 서비스 장애를 유발하는 반복 요청, 법령 또는 GitHub와 Fairy의 정책을 위반하는 행위는 허용되지 않습니다.</p>
      <h2>외부 서비스 의존성</h2>
      <p>Fairydust는 GitHub, Fairy, Vercel, 데이터베이스 등 외부 서비스와 함께 동작합니다. 외부 서비스 장애, API 제한, 권한 만료, 잘못된 설정으로 인해 반영이 지연되거나 실패할 수 있습니다.</p>
      <h2>모니터링과 확인</h2>
      <p>사용자는 관리자 화면의 모니터링 이력을 통해 후원 알림 수신 여부와 처리 결과를 확인할 수 있습니다. 실패가 표시되면 저장소 권한, 파일 경로, Fairy 설정을 점검해야 합니다.</p>
      <h2>탈퇴와 데이터 삭제</h2>
      <p>사용자는 설정 화면에서 언제든지 탈퇴할 수 있습니다. 탈퇴 시 계정 정보, GitHub 연결 정보, Fairy 설정, 등록된 연결, 웹훅 수신 이력이 함께 삭제되며 서비스 이용이 종료됩니다.</p>
      <h2>약관 변경</h2>
      <p>서비스 기능과 약관은 운영 필요에 따라 변경될 수 있습니다. 중요한 변경 사항은 서비스 화면 또는 저장소 문서를 통해 안내합니다.</p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h2>저장하는 정보</h2>
      <p>Fairydust는 GitHub 계정 식별 정보, 프로필 이름과 아바타, 암호화된 GitHub 연결 토큰, 암호화된 Fairy secret, 사용자가 등록한 저장소 연결 정보, 후원 알림 처리 이력을 DB에 저장합니다.</p>
      <h2>후원 알림 이력</h2>
      <p>모니터링과 문제 해결을 위해 수신 시각, 처리 결과, 후원 금액, 후원자 이름, 응원 메시지, 연결된 저장소와 파일 정보를 저장할 수 있습니다. Fairy에서 전달되지 않은 항목은 저장하지 않습니다.</p>
      <h2>이용 목적</h2>
      <p>저장된 정보는 GitHub 로그인 유지, 저장소 목록 조회, 선택한 파일 업데이트, Fairy 알림 검증, 중복 처리 방지, 관리자 화면의 이력 표시를 위해서만 사용합니다.</p>
      <h2>보관 기간</h2>
      <p>계정이 유지되는 동안 연결 정보와 처리 이력을 보관합니다. 사용자가 특정 연결을 해제하면 해당 연결 정보는 삭제됩니다. 계정을 탈퇴하면 사용자 계정과 모든 연결 데이터, 수신 이력을 함께 삭제합니다.</p>
      <h2>제3자 제공</h2>
      <p>Fairydust는 사용자가 설정한 자동 반영을 수행하기 위해 GitHub API를 호출합니다. 그 외의 목적으로 저장된 정보를 판매하거나 임의로 제3자에게 제공하지 않습니다.</p>
      <h2>보안 조치</h2>
      <p>GitHub 연결 토큰과 Fairy secret은 애플리케이션 암호화 키로 암호화해 저장합니다. 운영 환경에서는 환경변수, 데이터베이스 접근 권한, 배포 권한을 제한해 보호해야 합니다.</p>
      <h2>사용자 권리</h2>
      <p>사용자는 연결 해제, 표시 항목 변경, 계정 탈퇴를 직접 수행할 수 있습니다. 탈퇴 후에는 Fairydust가 더 이상 Fairy 알림을 처리하거나 GitHub 파일을 수정하지 않습니다.</p>
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

function templateName(key: string): string {
  if (key === "custom") return "직접 만든 템플릿";
  return sponsorTemplates.find((template) => template.key === key)?.name || "기본 템플릿";
}

function renderTemplatePreview(form: {
  showName: boolean;
  showAmount: boolean;
  showMessage: boolean;
  templateKey: string;
  templateBody: string;
}): string {
  const template = form.templateKey === "custom"
    ? form.templateBody
    : sponsorTemplates.find((item) => item.key === form.templateKey)?.body || sponsorTemplates[0].body;

  const values: Record<string, string> = {
    NAME: form.showName ? "홍길동" : "익명의 Fairy",
    AMOUNT: form.showAmount ? "10,000원" : "",
    MESSAGE: form.showMessage ? "응원합니다!" : "",
    DATE: "2026. 05. 14.",
    PROJECT: "fairydust",
    SERVICE: "Fairy"
  };

  return template.replace(/\{(NAME|AMOUNT|MESSAGE|DATE|PROJECT|SERVICE)\}/g, (_, key: string) => values[key] || "").trim();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
