-- YOLO / direct-commit delivery mode.
--
-- A workspace can ship coding-agent changes either as a pull request (the
-- default) or by committing directly to the default branch ("YOLO"). The mode
-- is read at request time to shape the CAP prompt; nothing is re-synced to the
-- repo when it flips.
ALTER TABLE workspace
    ADD COLUMN IF NOT EXISTS commit_mode TEXT NOT NULL DEFAULT 'pull_request'
        CHECK (commit_mode IN ('pull_request', 'direct'));

-- Each improvement snapshots how it was delivered at submit time, so the
-- reconcile scan + UI know whether to look for a PR or a direct commit even if
-- the workspace later toggles the mode. Direct-commit improvements record the
-- landed commit (sha + html url) instead of a PR.
ALTER TABLE improvement
    ADD COLUMN IF NOT EXISTS delivery TEXT NOT NULL DEFAULT 'pull_request'
        CHECK (delivery IN ('pull_request', 'direct')),
    ADD COLUMN IF NOT EXISTS commit_sha TEXT,
    ADD COLUMN IF NOT EXISTS commit_url TEXT;
