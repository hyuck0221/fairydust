import type { VercelRequest, VercelResponse } from "@vercel/node";
import { method } from "../lib/server/http.js";
import { queryOne, queryRows } from "../lib/server/db.js";
import { requireSessionUser } from "../lib/server/session.js";

type EventRow = {
  id: number;
  status: string;
  statusDetail: string | null;
  verified: number;
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["GET"])) return;

  const user = await requireSessionUser(req, res);
  if (!user) return;

  const projectName = typeof req.query.projectName === "string" ? req.query.projectName : "";
  const page = Math.max(Number(req.query.page || 1) || 1, 1);
  const perPage = Math.min(Math.max(Number(req.query.perPage || 30) || 30, 1), 30);
  const offset = (page - 1) * perPage;
  const whereProject = projectName ? "AND we.project_name = :projectName" : "";
  const count = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM webhook_events we
     WHERE we.user_id = :userId
       ${whereProject}`,
    { userId: user.id, projectName }
  );
  const total = Number(count?.total || 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  const rows = await queryRows<EventRow>(
    `SELECT
      we.id,
      we.status,
      we.status_detail AS statusDetail,
      we.verified,
      we.event_name AS eventName,
      we.event_timestamp AS eventTimestamp,
      we.payment_id AS paymentId,
      we.amount,
      we.fairy_name AS fairyName,
      we.fairy_message AS fairyMessage,
      we.project_name AS projectName,
      we.source,
      wm.repo_owner AS repoOwner,
      wm.repo_name AS repoName,
      wm.target_file AS targetFile,
      DATE_FORMAT(we.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
    FROM webhook_events we
    LEFT JOIN webhook_mappings wm ON wm.id = we.mapping_id
    WHERE we.user_id = :userId
      ${whereProject}
    ORDER BY we.created_at DESC, we.id DESC
    LIMIT ${perPage}
    OFFSET ${offset}`,
    { userId: user.id, projectName }
  );

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    page,
    perPage,
    total,
    totalPages,
    events: rows.map((row) => ({
      ...row,
      verified: Boolean(row.verified)
    }))
  });
}
