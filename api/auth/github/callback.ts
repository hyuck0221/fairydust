import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { parse, serialize } from "cookie";
import { Octokit } from "@octokit/rest";
import { appBaseUrl, requiredEnv } from "../../../lib/server/env.js";
import { method } from "../../../lib/server/http.js";
import { encryptText } from "../../../lib/server/crypto.js";
import { execute, queryOne } from "../../../lib/server/db.js";
import { setSessionCookie } from "../../../lib/server/session.js";

type UserRow = { id: number };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await githubCallback(req, res);
  } catch (error) {
    console.error("github.oauth.callback.failed", error);
    const message = error instanceof Error ? error.message : "Unknown callback error";
    res.status(500).json({
      error: "GitHub OAuth callback failed",
      detail: process.env.NODE_ENV === "production" ? undefined : message
    });
  }
}

async function githubCallback(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!method(req, res, ["GET"])) return;

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const expectedState = parse(req.headers.cookie || "").fairydust_oauth_state;

  res.setHeader(
    "Set-Cookie",
    serialize("fairydust_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    })
  );

  if (!code || !state || !expectedState || state !== expectedState) {
    res.status(400).send("Invalid GitHub OAuth state");
    return;
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: requiredEnv("GITHUB_CLIENT_ID"),
      client_secret: requiredEnv("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: `${appBaseUrl()}/api/auth/github/callback`
    })
  });

  const tokenData = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenData.access_token) {
    res.status(400).send(tokenData.error_description || "GitHub token exchange failed");
    return;
  }

  const octokit = new Octokit({ auth: tokenData.access_token });
  const { data: githubUser } = await octokit.users.getAuthenticated();

  const existing = await queryOne<UserRow>(
    `SELECT id FROM users WHERE github_id = :githubId`,
    { githubId: githubUser.id }
  );

  let userId = existing?.id;
  if (userId) {
    await execute(
      `UPDATE users
       SET github_login = :login,
           github_name = :name,
           github_avatar_url = :avatarUrl,
           webhook_token = COALESCE(webhook_token, :webhookToken),
           github_access_token_enc = :token
       WHERE id = :id`,
      {
        id: userId,
        login: githubUser.login,
        name: githubUser.name || null,
        avatarUrl: githubUser.avatar_url || null,
        webhookToken: crypto.randomBytes(16).toString("hex"),
        token: encryptText(tokenData.access_token)
      }
    );
  } else {
    const result = await execute(
      `INSERT INTO users (github_id, github_login, github_name, github_avatar_url, github_access_token_enc, webhook_token)
       VALUES (:githubId, :login, :name, :avatarUrl, :token, :webhookToken)`,
      {
        githubId: githubUser.id,
        login: githubUser.login,
        name: githubUser.name || null,
        avatarUrl: githubUser.avatar_url || null,
        token: encryptText(tokenData.access_token),
        webhookToken: crypto.randomBytes(16).toString("hex")
      }
    );
    userId = result.insertId;
  }

  if (!userId) {
    res.status(500).send("Failed to save user");
    return;
  }

  setSessionCookie(res, userId);
  res.redirect("/");
}
