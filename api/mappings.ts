import type { VercelRequest, VercelResponse } from "@vercel/node";
import { method } from "../lib/server/http";
import { execute, queryRows, queryOne } from "../lib/server/db";
import { requireSessionUser } from "../lib/server/session";

type MappingRow = {
  id: number;
  repoOwner: string;
  repoName: string;
  projectName: string;
  targetFile: string;
  showName: number;
  showAmount: number;
  showMessage: number;
  enabled: number;
};

function publicMapping(row: MappingRow) {
  return {
    id: row.id,
    repoOwner: row.repoOwner,
    repoName: row.repoName,
    projectName: row.projectName,
    targetFile: row.targetFile,
    showName: Boolean(row.showName),
    showAmount: Boolean(row.showAmount),
    showMessage: Boolean(row.showMessage),
    enabled: Boolean(row.enabled)
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["GET", "POST", "DELETE"])) return;

  const user = await requireSessionUser(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const rows = await queryRows<MappingRow>(
      `SELECT
        id,
        repo_owner AS repoOwner,
        repo_name AS repoName,
        project_name AS projectName,
        target_file AS targetFile,
        show_name AS showName,
        show_amount AS showAmount,
        show_message AS showMessage,
        enabled
      FROM webhook_mappings
      WHERE user_id = :userId
      ORDER BY created_at DESC`,
      { userId: user.id }
    );
    res.status(200).json({ mappings: rows.map(publicMapping) });
    return;
  }

  if (req.method === "DELETE") {
    const id = Number(req.query.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Valid mapping id is required" });
      return;
    }

    const result = await execute(
      `DELETE FROM webhook_mappings
       WHERE id = :id
         AND user_id = :userId`,
      { id, userId: user.id }
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  const body = req.body as {
    repoOwner?: string;
    repoName?: string;
    projectName?: string;
    targetFile?: string;
    showName?: boolean;
    showAmount?: boolean;
    showMessage?: boolean;
  };

  if (!body.repoOwner || !body.repoName || !body.projectName || !body.targetFile) {
    res.status(400).json({ error: "repoOwner, repoName, projectName, targetFile are required" });
    return;
  }

  await execute(
    `INSERT INTO webhook_mappings
      (user_id, repo_owner, repo_name, project_name, target_file, show_name, show_amount, show_message)
     VALUES
      (:userId, :repoOwner, :repoName, :projectName, :targetFile, :showName, :showAmount, :showMessage)`,
    {
      userId: user.id,
      repoOwner: body.repoOwner,
      repoName: body.repoName,
      projectName: body.projectName.trim(),
      targetFile: body.targetFile.trim(),
      showName: body.showName !== false,
      showAmount: Boolean(body.showAmount),
      showMessage: Boolean(body.showMessage)
    }
  );

  const row = await queryOne<MappingRow>(
    `SELECT
      id,
      repo_owner AS repoOwner,
      repo_name AS repoName,
      project_name AS projectName,
      target_file AS targetFile,
      show_name AS showName,
      show_amount AS showAmount,
      show_message AS showMessage,
      enabled
    FROM webhook_mappings
    WHERE user_id = :userId
      AND repo_owner = :repoOwner
      AND repo_name = :repoName
      AND project_name = :projectName`,
    {
      userId: user.id,
      repoOwner: body.repoOwner,
      repoName: body.repoName,
      projectName: body.projectName.trim()
    }
  );

  res.status(201).json({ mapping: row ? publicMapping(row) : null });
}
