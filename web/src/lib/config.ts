export function getInstanceName(): string {
  return process.env.TAS_INSTANCE_NAME?.trim() || "Tembo Agent Studio";
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const POWERED_BY_HREF = "https://github.com/tembo/agent-studio";
