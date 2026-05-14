import { Octokit } from "@octokit/rest";
import { decryptText } from "./crypto.js";
import type { SessionUser } from "./session.js";

export function octokitForUser(user: SessionUser): Octokit {
  return new Octokit({ auth: decryptText(user.githubAccessTokenEnc) });
}

export async function upsertReadmeSponsorBlock(options: {
  octokit: Octokit;
  owner: string;
  repo: string;
  path: string;
  line: string;
}): Promise<void> {
  const { octokit, owner, repo, path, line } = options;
  const markerStart = "<!-- FAIRYDUST:START -->";
  const markerEnd = "<!-- FAIRYDUST:END -->";

  let sha: string | undefined;
  let content = "";

  try {
    const response = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new Error(`${path} is not a file`);
    }
    sha = response.data.sha;
    content = Buffer.from(response.data.content, "base64").toString("utf8");
  } catch (error: unknown) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    if (status !== 404) throw error;
  }

  const block = `${markerStart}\n${line}\n${markerEnd}`;
  const nextContent = content.includes(markerStart) && content.includes(markerEnd)
    ? content.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), block)
    : `${content.trimEnd()}\n\n## Fairy Sponsors\n\n${block}\n`;

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Update Fairy sponsor info`,
    content: Buffer.from(nextContent, "utf8").toString("base64"),
    sha
  });
}
