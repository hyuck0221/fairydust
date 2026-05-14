export type FairyWebhookPayload = {
  event?: string;
  timestamp?: string;
  data?: {
    paymentId?: string;
    amount?: number;
    fairyName?: string;
    fairyEmail?: string;
    fairyMessage?: string;
    projectName?: string;
    source?: string;
    payload?: unknown;
  };
};

export const sponsorTemplates = [
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
] as const;

export type SponsorTemplateKey = (typeof sponsorTemplates)[number]["key"] | "custom";

export function templateBodyFor(key?: string | null): string {
  return sponsorTemplates.find((template) => template.key === key)?.body || sponsorTemplates[0].body;
}

export function renderSponsorEntry(options: {
  fairyName?: string;
  amount?: number;
  fairyMessage?: string;
  projectName?: string;
  templateKey?: string | null;
  templateBody?: string | null;
  showName: boolean;
  showAmount: boolean;
  showMessage: boolean;
}): string {
  const body = options.templateKey === "custom" && options.templateBody?.trim()
    ? options.templateBody
    : templateBodyFor(options.templateKey);

  const values: Record<string, string> = {
    NAME: options.showName && options.fairyName ? options.fairyName : "익명의 Fairy",
    AMOUNT: options.showAmount && typeof options.amount === "number"
      ? `${new Intl.NumberFormat("ko-KR").format(options.amount)}원`
      : "",
    MESSAGE: options.showMessage && options.fairyMessage ? options.fairyMessage : "",
    DATE: new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date()),
    PROJECT: options.projectName || "",
    SERVICE: "Fairy"
  };

  return body.replace(/\{(NAME|AMOUNT|MESSAGE|DATE|PROJECT|SERVICE)\}/g, (_, key: string) =>
    escapeMarkdown(values[key] || "")
  ).replace(/[ \t]+$/gm, "").trim();
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&").trim();
}
