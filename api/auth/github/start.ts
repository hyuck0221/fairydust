import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { serialize } from "cookie";
import { appBaseUrl, requiredEnv } from "../../../lib/server/env";
import { method } from "../../../lib/server/http";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (!method(req, res, ["GET"])) return;

  const state = crypto.randomBytes(24).toString("base64url");
  res.setHeader(
    "Set-Cookie",
    serialize("fairydust_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10
    })
  );

  const params = new URLSearchParams({
    client_id: requiredEnv("GITHUB_CLIENT_ID"),
    redirect_uri: `${appBaseUrl()}/api/auth/github/callback`,
    scope: "repo",
    state
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
