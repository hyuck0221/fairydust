import type { VercelRequest, VercelResponse } from "@vercel/node";
import { method } from "../lib/server/http";
import { requireSessionUser } from "../lib/server/session";
import { octokitForUser } from "../lib/server/github";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["GET"])) return;

  const user = await requireSessionUser(req, res);
  if (!user) return;

  const octokit = octokitForUser(user);
  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    affiliation: "owner,collaborator,organization_member",
    sort: "updated",
    per_page: 100
  });

  res.status(200).json({
    repos: repos.map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,
      owner: repo.owner.login,
      name: repo.name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url
    }))
  });
}
