-- Optional supplementary API key on a native-MCP connection.
--
-- Some providers' MCP OAuth grants only coarse scopes (Attio: mcp /
-- offline_access / openid — no record/note/delete granularity), so privileged
-- operations need the provider's own API key (an Attio access token with
-- granular scopes). Rather than a separate, workspace-shared secret wired by a
-- magic slug, the key rides the connection it belongs to — bundled, and per-user
-- by construction (workspace_connection is keyed by user_id).
--
-- Encrypted at rest with the shared AES-256-GCM master key, AAD-bound to the
-- same (workspace_id, user_id, type, name) identity as `credentials` (so the
-- existing aadNativeConnection / crypto::aad::native_connection works for it).
-- Independent of the OAuth token in `credentials`: the refresh sweep rewrites
-- `credentials` only and never touches this column.
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS aux_secret_ciphertext BYTEA;
