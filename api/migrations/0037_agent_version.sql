-- Agent lifecycle: Draft -> Stable.
--
-- Agents live as files in the connected repo and are addressed by their
-- declared `name` within a workspace. The default-branch file is the
-- rolling DRAFT head (authored via PRs, as today). "Promote to Stable"
-- freezes the current draft bytes here as a numbered version; runs default
-- to the current stable snapshot rather than the live file.
--
-- Identity keys on (workspace_id, agent_name) — NOT file path — so moving
-- the file (e.g. an agents/<framework>/ reshuffle) keeps history. Changing
-- the declared `name:` starts a fresh history (treated as a new agent);
-- agent_path is stored per-version as provenance only. Specs are not
-- secret, so spec_content is plain TEXT (no AES-GCM).

CREATE TABLE IF NOT EXISTS agent_version (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name        TEXT        NOT NULL,
    agent_path        TEXT        NOT NULL,
    version_number    INTEGER     NOT NULL,
    framework         TEXT        NOT NULL,
    -- Denormalized so the dispatch hot path doesn't re-parse the snapshot.
    model             TEXT,
    spec_content      TEXT        NOT NULL,
    spec_format       TEXT        NOT NULL CHECK (spec_format IN ('yaml', 'json')),
    -- Repo blob/commit SHA at promotion time, when cheaply available.
    source_commit_sha TEXT,
    stage             TEXT        NOT NULL DEFAULT 'stable'
                      CHECK (stage IN ('stable', 'beta', 'draft', 'archived')),
    -- LLM-generated summary of changes vs the previous version.
    change_summary    TEXT,
    created_by        TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (workspace_id, agent_name, version_number)
);

CREATE INDEX IF NOT EXISTS agent_version_ws_agent_idx
    ON agent_version (workspace_id, agent_name, version_number DESC);

-- Current default ("stable") version per agent. A pointer table (rather
-- than a boolean on agent_version) makes the swap atomic and unambiguous.
CREATE TABLE IF NOT EXISTS agent_release (
    workspace_id      UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name        TEXT        NOT NULL,
    stable_version_id UUID        NOT NULL REFERENCES agent_version(id) ON DELETE RESTRICT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, agent_name)
);

-- One designated owner per agent — generally responsible for promoting it.
CREATE TABLE IF NOT EXISTS agent_owner (
    workspace_id  UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name    TEXT        NOT NULL,
    owner_user_id TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    updated_by    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, agent_name)
);

-- Which version each run executed. NULL agent_version_id = a draft/live run
-- or a pre-feature run; the label carries the human string ('v3' | 'draft').
ALTER TABLE run ADD COLUMN IF NOT EXISTS agent_version_id UUID
    REFERENCES agent_version(id) ON DELETE SET NULL;
ALTER TABLE run ADD COLUMN IF NOT EXISTS agent_version_label TEXT;

-- Per-automation opt-in to run the draft instead of the stable version.
ALTER TABLE automation ADD COLUMN IF NOT EXISTS use_draft BOOLEAN NOT NULL DEFAULT FALSE;
