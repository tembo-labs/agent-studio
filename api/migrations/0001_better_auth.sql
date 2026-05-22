-- better-auth core schema (email/password baseline).
-- Mirrors what `@better-auth/cli generate` produces for a Postgres adapter
-- with `emailAndPassword: { enabled: true }`. Adapter plugins (SSO/SAML/OIDC,
-- organization, etc.) will land in later migrations as they are introduced.

CREATE TABLE IF NOT EXISTS "user" (
    id              TEXT        PRIMARY KEY,
    name            TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    "emailVerified" BOOLEAN     NOT NULL DEFAULT FALSE,
    image           TEXT,
    "createdAt"     TIMESTAMP   NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
    id           TEXT      PRIMARY KEY,
    "expiresAt"  TIMESTAMP NOT NULL,
    token        TEXT      NOT NULL UNIQUE,
    "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "userId"     TEXT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_user_id_idx ON session("userId");

CREATE TABLE IF NOT EXISTS account (
    id                       TEXT      PRIMARY KEY,
    "accountId"              TEXT      NOT NULL,
    "providerId"             TEXT      NOT NULL,
    "userId"                 TEXT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken"            TEXT,
    "refreshToken"           TEXT,
    "idToken"                TEXT,
    "accessTokenExpiresAt"   TIMESTAMP,
    "refreshTokenExpiresAt"  TIMESTAMP,
    scope                    TEXT,
    password                 TEXT,
    "createdAt"              TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_user_id_idx ON account("userId");
CREATE UNIQUE INDEX IF NOT EXISTS account_provider_account_idx ON account("providerId", "accountId");

CREATE TABLE IF NOT EXISTS verification (
    id           TEXT      PRIMARY KEY,
    identifier   TEXT      NOT NULL,
    value        TEXT      NOT NULL,
    "expiresAt"  TIMESTAMP NOT NULL,
    "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
