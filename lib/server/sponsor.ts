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

export function sponsorLine(options: {
  fairyName?: string;
  amount?: number;
  fairyMessage?: string;
  showName: boolean;
  showAmount: boolean;
  showMessage: boolean;
}): string {
  const parts: string[] = [];

  if (options.showName && options.fairyName) {
    parts.push(`**${escapeMarkdown(options.fairyName)}**`);
  } else {
    parts.push("A Fairy supporter");
  }

  if (options.showAmount && typeof options.amount === "number") {
    parts.push(`sponsored ${new Intl.NumberFormat("ko-KR").format(options.amount)}원`);
  } else {
    parts.push("sponsored this project");
  }

  if (options.showMessage && options.fairyMessage) {
    parts.push(`> ${escapeMarkdown(options.fairyMessage)}`);
  }

  return `- ${parts.join(" ")}`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&").trim();
}
