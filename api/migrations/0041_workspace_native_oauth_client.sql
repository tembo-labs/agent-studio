-- Bring-your-own OAuth app for Native MCP providers that don't support Dynamic
-- Client Registration (HubSpot first). For these providers an admin creates an
-- OAuth app at the provider and stores its client_id + client_secret here; the
-- authorize/callback/refresh flow then runs a CONFIDENTIAL client
-- (token_endpoint_auth_method=client_secret_post) instead of self-registering a
-- public client via DCR.
--
-- Per-(workspace, provider). client_id is not secret (stored plaintext);
-- client_secret is AES-256-GCM encrypted with the shared master key
-- (nonce || ciphertext || tag), interchangeable web <-> Rust; secret_last4 is
-- plaintext only for the masked preview. DCR providers (Attio, Pylon) never
-- write a row here.

CREATE TABLE IF NOT EXISTS workspace_native_oauth_client (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    provider                 TEXT        NOT NULL,
    client_id                TEXT        NOT NULL,
    client_secret_ciphertext BYTEA       NOT NULL,
    secret_last4             TEXT        NOT NULL,
    created_by               TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, provider)
);
