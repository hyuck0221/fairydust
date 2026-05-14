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
  entry: string;
  templateKey?: string | null;
}): Promise<void> {
  const { octokit, owner, repo, path, entry, templateKey } = options;
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

  const existingBlockMatch = content.match(new RegExp(`${markerStart}\\n?([\\s\\S]*?)\\n?${markerEnd}`));
  const existingEntries = existingBlockMatch?.[1]?.trim();
  const blockBody = mergeSponsorEntry(existingEntries, entry, templateKey);
  const block = `${markerStart}\n${blockBody}\n${markerEnd}`;
  const nextContent = existingBlockMatch
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

function mergeSponsorEntry(existingEntries: string | undefined, entry: string, templateKey?: string | null): string {
  if (!existingEntries) return entry;

  if (templateKey === "table") {
    const lines = entry.split("\n").map((line) => line.trim()).filter(Boolean);
    const newRow = [...lines].reverse().find((line) => line.startsWith("|") && !line.includes("---"));
    if (newRow && looksLikeMarkdownTable(existingEntries)) {
      const existingLines = existingEntries.split("\n");
      const dividerIndex = existingLines.findIndex((line) => line.includes("---") && line.trim().startsWith("|"));
      if (dividerIndex >= 0) {
        return [
          ...existingLines.slice(0, dividerIndex + 1),
          newRow,
          ...existingLines.slice(dividerIndex + 1).filter((line) => !isDuplicateTableHeader(line))
        ].join("\n").trim();
      }
    }
  }

  return `${entry}\n\n${existingEntries}`;
}

function looksLikeMarkdownTable(value: string): boolean {
  const lines = value.split("\n").map((line) => line.trim());
  return lines.some((line) => line.startsWith("|") && line.includes("---"));
}

function isDuplicateTableHeader(line: string): boolean {
  const normalized = line.trim();
  return normalized.startsWith("| 날짜 |") || normalized.includes("| --- |");
}
