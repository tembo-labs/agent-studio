-- Svix-signed webhook triggers (Clerk, and any Svix-powered sender).
--
-- A workspace_webhook normally authenticates inbound requests with its bearer
-- token. Some senders — notably Clerk — can't attach a custom Authorization
-- header; instead they SIGN each delivery (Svix scheme: svix-id /
-- svix-timestamp / svix-signature headers, HMAC-SHA256 over
-- "{id}.{timestamp}.{body}" keyed by the endpoint signing secret `whsec_...`).
--
-- When signing_secret_ciphertext is set, /api/hooks/webhook/<id> verifies that
-- signature instead of the bearer token. The secret is encrypted at rest with
-- the shared AES-256-GCM master key (nonce || ciphertext || tag), AAD-bound to
-- (workspace_id, id) — only the web layer reads it (the Rust runner never does).
ALTER TABLE workspace_webhook
    ADD COLUMN IF NOT EXISTS signing_secret_ciphertext BYTEA;
