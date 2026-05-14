import type { VercelRequest, VercelResponse } from "@vercel/node";

export function method(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (allowed.includes(req.method || "")) return true;
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ error: "Method not allowed" });
  return false;
}

export async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
