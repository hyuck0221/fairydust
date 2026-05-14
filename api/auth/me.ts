import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionUser } from "../../lib/server/session.js";
import { method } from "../../lib/server/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["GET"])) return;

  const user = await getSessionUser(req);
  res.status(200).json({
    user: user
      ? {
          id: user.id,
          githubLogin: user.githubLogin,
          githubName: user.githubName,
          githubAvatarUrl: user.githubAvatarUrl
        }
      : null
  });
}
