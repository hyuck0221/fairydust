import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { method, readRawBody } from "./http.js";
import { execute, queryOne } from "./db.js";
import { decryptText, safeEqual } from "./crypto.js";
import { octokitForUser, upsertReadmeSponsorBlock } from "./github.js";
import { sponsorLine, type FairyWebhookPayload } from "./sponsor.js";

type WebhookMapping = {
  id: number;
  userId: number;
  repoOwner: string;
  repoName: string;
  projectName: string;
  targetFile: string;
  showName: number;
  showAmount: number;
  showMessage: number;
  githubId: number;
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubAccessTokenEnc: string;
  webhookToken: string;
  fairyWebhookSecretEnc: string | null;
};

type WebhookUser = {
  id: number;
  githubId: number;
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubAccessTokenEnc: string;
  webhookToken: string;
  fairyWebhookSecretEnc: string | null;
};

function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return safeEqual(signature, expected);
}

function webhookLog(payload: FairyWebhookPayload | null, headers: VercelRequest["headers"], verified: boolean): void {
  const data = payload?.data || {};
  console.log("fairy.webhook", {
    event: headers["x-fairy-event"] || payload?.event,
    timestamp: headers["x-fairy-timestamp"] || payload?.timestamp,
    paymentId: data.paymentId,
    amount: data.amount,
    projectName: data.projectName,
    source: data.source,
    verified
  });
}

export async function handleFairyWebhook(req: VercelRequest, res: VercelResponse, token?: string): Promise<void> {
  if (!method(req, res, ["POST"])) return;

  const resolvedToken = token || String(req.query.token || "");
  if (!resolvedToken) {
    res.status(400).json({ error: "Webhook token is required" });
    return;
  }

  const webhookUser = await queryOne<WebhookUser>(
    `SELECT
      id,
      github_id AS githubId,
      github_login AS githubLogin,
      github_name AS githubName,
      github_avatar_url AS githubAvatarUrl,
      github_access_token_enc AS githubAccessTokenEnc,
      webhook_token AS webhookToken,
      fairy_webhook_secret_enc AS fairyWebhookSecretEnc
    FROM users
    WHERE webhook_token = :token`,
    { token: resolvedToken }
  );

  if (!webhookUser) {
    res.status(404).json({ error: "Webhook user not found" });
    return;
  }

  if (!webhookUser.fairyWebhookSecretEnc) {
    res.status(400).json({ error: "Fairy webhook secret is not configured" });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = Array.isArray(req.headers["x-fairy-signature"])
    ? req.headers["x-fairy-signature"][0]
    : req.headers["x-fairy-signature"];

  let payload: FairyWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as FairyWebhookPayload;
  } catch {
    payload = null;
  }

  const verified = verifySignature(rawBody, signature, decryptText(webhookUser.fairyWebhookSecretEnc));
  webhookLog(payload, req.headers, verified);

  if (!verified) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  if (!payload?.data?.paymentId || !payload.data.projectName) {
    res.status(400).json({ error: "data.paymentId and data.projectName are required" });
    return;
  }

  if (payload.data.source === "test") {
    res.status(200).json({ ok: true, skipped: true, reason: "test source" });
    return;
  }

  const mapping = await queryOne<WebhookMapping>(
    `SELECT
      wm.id,
      wm.user_id AS userId,
      wm.repo_owner AS repoOwner,
      wm.repo_name AS repoName,
      wm.project_name AS projectName,
      wm.target_file AS targetFile,
      wm.show_name AS showName,
      wm.show_amount AS showAmount,
      wm.show_message AS showMessage,
      u.github_id AS githubId,
      u.github_login AS githubLogin,
      u.github_name AS githubName,
      u.github_avatar_url AS githubAvatarUrl,
      u.github_access_token_enc AS githubAccessTokenEnc,
      u.webhook_token AS webhookToken,
      u.fairy_webhook_secret_enc AS fairyWebhookSecretEnc
    FROM webhook_mappings wm
    INNER JOIN users u ON u.id = wm.user_id
    WHERE wm.user_id = :userId
      AND wm.enabled = TRUE
      AND wm.project_name = :projectName`,
    { userId: webhookUser.id, projectName: payload.data.projectName }
  );

  if (!mapping) {
    res.status(404).json({ error: "No mapping found for token and projectName" });
    return;
  }

  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM payments WHERE payment_id = :paymentId`,
    { paymentId: payload.data.paymentId }
  );

  if (existing) {
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  await execute(
    `INSERT INTO payments
      (mapping_id, payment_id, event, amount, fairy_name, fairy_email, fairy_message, project_name, source, raw_payload)
     VALUES
      (:mappingId, :paymentId, :event, :amount, :fairyName, :fairyEmail, :fairyMessage, :projectName, :source, :rawPayload)`,
    {
      mappingId: mapping.id,
      paymentId: payload.data.paymentId,
      event: payload.event || "unknown",
      amount: payload.data.amount ?? null,
      fairyName: payload.data.fairyName || null,
      fairyEmail: payload.data.fairyEmail || null,
      fairyMessage: payload.data.fairyMessage || null,
      projectName: payload.data.projectName,
      source: payload.data.source || null,
      rawPayload: JSON.stringify(payload)
    }
  );

  const line = sponsorLine({
    fairyName: payload.data.fairyName,
    amount: payload.data.amount,
    fairyMessage: payload.data.fairyMessage,
    showName: Boolean(mapping.showName),
    showAmount: Boolean(mapping.showAmount),
    showMessage: Boolean(mapping.showMessage)
  });

  await upsertReadmeSponsorBlock({
    octokit: octokitForUser(mapping),
    owner: mapping.repoOwner,
    repo: mapping.repoName,
    path: mapping.targetFile,
    line
  });

  res.status(200).json({ ok: true });
}
