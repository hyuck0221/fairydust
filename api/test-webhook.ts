import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { appBaseUrl } from "../lib/server/env.js";
import { decryptText } from "../lib/server/crypto.js";
import { method } from "../lib/server/http.js";
import { queryOne } from "../lib/server/db.js";
import { requireSessionUser } from "../lib/server/session.js";

type MappingRow = {
  id: number;
  projectName: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["POST"])) return;

  const user = await requireSessionUser(req, res);
  if (!user) return;

  if (!user.fairyWebhookSecretEnc) {
    res.status(400).json({ error: "Fairy webhook secret is not configured" });
    return;
  }

  const body = req.body as { mappingId?: number };
  const mappingId = Number(body.mappingId);
  if (!Number.isFinite(mappingId) || mappingId <= 0) {
    res.status(400).json({ error: "Valid mappingId is required" });
    return;
  }

  const mapping = await queryOne<MappingRow>(
    `SELECT id, project_name AS projectName
     FROM webhook_mappings
     WHERE id = :mappingId
       AND user_id = :userId
       AND enabled = TRUE`,
    { mappingId, userId: user.id }
  );

  if (!mapping) {
    res.status(404).json({ error: "Mapping not found" });
    return;
  }

  const timestamp = new Date().toISOString();
  const rawBody = JSON.stringify({
    event: "payment.completed",
    timestamp,
    data: {
      paymentId: `manual_${Date.now()}`,
      amount: 1000,
      fairyName: "테스트 Fairy",
      fairyEmail: "test@example.com",
      fairyMessage: "Fairydust 실제 반영 테스트입니다.",
      projectName: mapping.projectName,
      source: "manual-test",
      payload: {
        source: "fairydust-admin"
      }
    }
  });

  const signature = crypto
    .createHmac("sha256", decryptText(user.fairyWebhookSecretEnc))
    .update(rawBody)
    .digest("hex");

  const response = await fetch(`${appBaseUrl()}/webhook/${user.webhookToken}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fairy-Signature": signature,
      "X-Fairy-Timestamp": timestamp,
      "X-Fairy-Event": "payment.completed"
    },
    body: rawBody
  });

  const responseText = await response.text();
  res.status(response.ok ? 200 : response.status).json({
    ok: response.ok,
    status: response.status,
    response: responseText
  });
}
