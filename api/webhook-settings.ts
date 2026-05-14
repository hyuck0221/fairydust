import type { VercelRequest, VercelResponse } from "@vercel/node";
import { appBaseUrl } from "../lib/server/env.js";
import { method } from "../lib/server/http.js";
import { encryptText } from "../lib/server/crypto.js";
import { execute, queryOne } from "../lib/server/db.js";
import { requireSessionUser } from "../lib/server/session.js";

type SettingsRow = {
  webhookToken: string;
  fairyWebhookSecretEnc: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["GET", "PUT"])) return;

  const user = await requireSessionUser(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const row = await queryOne<SettingsRow>(
      `SELECT
        webhook_token AS webhookToken,
        fairy_webhook_secret_enc AS fairyWebhookSecretEnc
      FROM users
      WHERE id = :userId`,
      { userId: user.id }
    );

    res.status(200).json({
      webhookUrl: `${appBaseUrl()}/webhook/${row?.webhookToken || user.webhookToken}`,
      hasSecret: Boolean(row?.fairyWebhookSecretEnc),
      fairyWebhookSecret: ""
    });
    return;
  }

  const body = req.body as { fairyWebhookSecret?: string };
  const secret = body.fairyWebhookSecret?.trim();
  if (!secret) {
    const current = await queryOne<{ hasSecret: number }>(
      `SELECT fairy_webhook_secret_enc IS NOT NULL AS hasSecret
       FROM users
       WHERE id = :userId`,
      { userId: user.id }
    );

    if (current?.hasSecret) {
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "fairyWebhookSecret is required" });
    return;
  }

  await execute(
    `UPDATE users
     SET fairy_webhook_secret_enc = :secret
     WHERE id = :userId`,
    { userId: user.id, secret: encryptText(secret) }
  );

  res.status(200).json({ ok: true });
}
