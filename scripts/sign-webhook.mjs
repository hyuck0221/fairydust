import crypto from "node:crypto";

const secret = process.env.FAIRY_WEBHOOK_SECRET || process.env.FAIRY_SECRET;
if (!secret) {
  console.error("Set FAIRY_SECRET first.");
  process.exit(1);
}

const body = process.argv[2];
if (!body) {
  console.error("Usage: node scripts/sign-webhook.mjs '<json-body>'");
  process.exit(1);
}

console.log(crypto.createHmac("sha256", secret).update(body).digest("hex"));
