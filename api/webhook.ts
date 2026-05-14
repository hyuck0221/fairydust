import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleFairyWebhook } from "../lib/server/webhook-handler.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleFairyWebhook(req, res);
}
