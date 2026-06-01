-- Instance-level (deployment-wide) settings.
--
-- Single-row table: `id` is a boolean pinned to TRUE via a CHECK, so
-- there can only ever be one row. Fields are nullable and read with an
-- env fallback (e.g. instance_name falls back to TAS_INSTANCE_NAME), so
-- an env-configured deployment keeps working until an instance admin
-- saves a value here. Writes are gated to instance admins in the web
-- layer (INSTANCE_ADMIN_EMAILS allowlist).

CREATE TABLE IF NOT EXISTS instance_settings (
    id            BOOLEAN     PRIMARY KEY DEFAULT TRUE,
    instance_name TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    CONSTRAINT instance_settings_singleton CHECK (id)
);

-- Seed the single row so reads/updates don't have to upsert.
INSERT INTO instance_settings (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;
