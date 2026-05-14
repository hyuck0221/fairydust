import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse, serialize } from "cookie";
import { sign, safeEqual } from "./crypto";
import { queryOne } from "./db";

const cookieName = "fairydust_session";

export type SessionUser = {
  id: number;
  githubId: number;
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubAccessTokenEnc: string;
  webhookToken: string;
  fairyWebhookSecretEnc: string | null;
};

export function setSessionCookie(res: VercelResponse, userId: number): void {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  res.setHeader(
    "Set-Cookie",
    serialize(cookieName, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    })
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    "Set-Cookie",
    serialize(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    })
  );
}

export async function getSessionUser(req: VercelRequest): Promise<SessionUser | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const value = parse(cookieHeader)[cookieName];
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: number };
    if (!data.userId) return null;

    return queryOne<SessionUser>(
      `SELECT
        id,
        github_id AS githubId,
        github_login AS githubLogin,
        github_name AS githubName,
        github_avatar_url AS githubAvatarUrl,
        github_access_token_enc AS githubAccessTokenEnc,
        webhook_token AS webhookToken,
        fairy_webhook_secret_enc AS fairyWebhookSecretEnc
      FROM users
      WHERE id = :id`,
      { id: data.userId }
    );
  } catch {
    return null;
  }
}

export async function requireSessionUser(req: VercelRequest, res: VercelResponse): Promise<SessionUser | null> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}
