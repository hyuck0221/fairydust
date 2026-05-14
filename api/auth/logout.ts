import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie } from "../../lib/server/session";
import { method } from "../../lib/server/http";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (!method(req, res, ["POST"])) return;
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
