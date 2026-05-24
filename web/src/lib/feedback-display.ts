// Shared helper for showing who submitted a feedback. Prefers
// display name, falls back to email, then to a generic "Unknown"
// when both are null (only happens if the user row was deleted).

import { type Feedback } from "@/lib/feedbacks-api";

export function feedbackSubmitterLabel(f: Feedback): string {
  if (f.createdByName && f.createdByName.trim()) return f.createdByName;
  if (f.createdByEmail) return f.createdByEmail;
  return "Unknown";
}
