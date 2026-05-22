const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

export type ApiHealth =
  | { ok: true; status: string; db: string }
  | { ok: false; error: string };

export async function getApiHealth(): Promise<ApiHealth> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `api returned ${res.status}` };
    }
    const body = (await res.json()) as { status: string; db: string };
    return { ok: true, ...body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
