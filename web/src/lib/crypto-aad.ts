import "server-only";

// Canonical AAD strings that bind a ciphertext to its row (#49). Passed to
// encryptSecret/decryptSecret; the same string must be used on both the
// encrypt and decrypt of a given row. For rows the Rust runtime also touches
// (workspace secrets, native connection credentials, native OAuth client
// secrets, Slack bot tokens), api/src/crypto.rs builds BYTE-IDENTICAL strings —
// keep the two in lockstep or those rows stop decrypting cross-language.
//
// Fields are joined with a unit separator (0x1f) so a value that happens to
// contain a separator-like character (':'/'|') can't be reshaped into a
// different context. UUIDs are the lowercase-hyphenated Postgres text form on
// both sides; `kind`/`type`/`slug`/`name` are passed through verbatim.
const SEP = "\x1f";

/** `workspace_secret` row, keyed by (workspace_id, kind). */
export function aadWorkspaceSecret(workspaceId: string, kind: string): string {
  return `workspace_secret${SEP}${workspaceId}${SEP}${kind}`;
}

/** `workspace_secret_connection` row, keyed by (workspace_id, slug). */
export function aadSecretConnection(
  workspaceId: string,
  slug: string,
): string {
  return `secret_connection${SEP}${workspaceId}${SEP}${slug}`;
}
