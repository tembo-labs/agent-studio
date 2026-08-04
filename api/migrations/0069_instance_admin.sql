-- In-app instance admins. Emails here are unioned with the
-- INSTANCE_ADMIN_EMAILS env allowlist by the web tier: the env list
-- bootstraps the first admin on a fresh deployment; this table lets that
-- admin hand the instance to others from Instance settings without
-- touching deploy env. Emails are stored lowercased (app-enforced).
CREATE TABLE instance_admin (
    email      TEXT        PRIMARY KEY,
    added_by   TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
