-- Workspace invitations (invite-only instance).
--
-- A workspace admin invites an email + role; the invitee joins on their
-- first sign-in (matched by email). Account creation itself is gated in
-- the web layer to instance admins + invited emails, so an uninvited
-- person can't get into the instance at all.

CREATE TABLE IF NOT EXISTS workspace_invitation (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    email        TEXT        NOT NULL,
    role         TEXT        NOT NULL CHECK (role IN ('viewer', 'operator', 'workspace_admin')),
    invited_by   TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at  TIMESTAMPTZ,
    accepted_by  TEXT        REFERENCES "user"(id) ON DELETE SET NULL
);

-- At most one *pending* invite per (workspace, email). Accepted rows are
-- kept as history and excluded from the uniqueness guard.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitation_pending_uniq
    ON workspace_invitation (workspace_id, lower(email))
    WHERE accepted_at IS NULL;

-- Fast lookup on sign-in: "do any pending invites match this email?"
CREATE INDEX IF NOT EXISTS workspace_invitation_email_idx
    ON workspace_invitation (lower(email))
    WHERE accepted_at IS NULL;
