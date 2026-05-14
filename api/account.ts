import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie, requireSessionUser } from "../lib/server/session.js";
import { method } from "../lib/server/http.js";
import { withTransaction } from "../lib/server/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["DELETE"])) return;

  const user = await requireSessionUser(req, res);
  if (!user) return;

  await withTransaction(async (connection) => {
    await connection.execute("DELETE FROM webhook_events WHERE user_id = ?", [user.id]);
    await connection.execute(
      `DELETE payments
       FROM payments
       INNER JOIN webhook_mappings ON webhook_mappings.id = payments.mapping_id
       WHERE webhook_mappings.user_id = ?`,
      [user.id]
    );
    await connection.execute("DELETE FROM webhook_mappings WHERE user_id = ?", [user.id]);
    await connection.execute("DELETE FROM users WHERE id = ?", [user.id]);
  });

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
