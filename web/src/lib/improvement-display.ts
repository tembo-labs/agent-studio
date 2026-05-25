// Shared helper for showing who submitted an improvement. Prefers
// display name, falls back to email, then to a generic "Unknown"
// when both are null (only happens if the user row was deleted).

import { type Improvement } from "@/lib/improvements-api";

export function improvementSubmitterLabel(i: Improvement): string {
  if (i.createdByName && i.createdByName.trim()) return i.createdByName;
  if (i.createdByEmail) return i.createdByEmail;
  return "Unknown";
}
