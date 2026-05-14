export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}
