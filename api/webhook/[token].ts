import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleFairyWebhook } from "../../lib/server/webhook-handler";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  await handleFairyWebhook(req, res, token);
}
