import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockAPIError extends Error {
    status: string;

    constructor(status: string, options: { message: string }) {
      super(options.message);
      this.status = status;
    }
  }

  return {
    betterAuth: vi.fn((config: unknown) => ({ config })),
    genericOAuth: vi.fn((options: unknown) => ({
      id: "genericOAuth",
      options,
    })),
    isInstanceAdminEmail: vi.fn(),
    hasPendingInvite: vi.fn(),
    resolvePendingInvitesForUser: vi.fn(),
    listWorkspacesForUser: vi.fn(),
    writeAuditEvent: vi.fn(),
    MockAPIError,
  };
});

vi.mock("better-auth", () => ({
  betterAuth: mocks.betterAuth,
}));

vi.mock("better-auth/api", () => ({
  APIError: mocks.MockAPIError,
}));

vi.mock("better-auth/plugins", () => ({
  genericOAuth: mocks.genericOAuth,
}));

vi.mock("pg", () => ({
  Pool: vi.fn(function Pool() {
    return {};
  }),
}));

vi.mock("@/lib/auth-secret", () => ({
  resolveAuthSecret: () => "test-secret-with-enough-entropy",
}));

vi.mock("@/lib/audit-db", () => ({
  writeAuditEvent: mocks.writeAuditEvent,
}));

vi.mock("@/lib/config", () => ({
  isInstanceAdminEmail: mocks.isInstanceAdminEmail,
}));

vi.mock("@/lib/invitations", () => ({
  hasPendingInvite: mocks.hasPendingInvite,
  resolvePendingInvitesForUser: mocks.resolvePendingInvitesForUser,
}));

vi.mock("@/lib/workspace", () => ({
  listWorkspacesForUser: mocks.listWorkspacesForUser,
}));

type AuthConfig = {
  databaseHooks: {
    user: {
      create: {
        before: (user: TestUser) => Promise<{ data: TestUser }>;
        after: (user: TestUser) => Promise<void>;
      };
    };
  };
  emailAndPassword: { enabled: boolean };
  plugins?: unknown[];
};

type TestUser = {
  id: string;
  email: string;
  name?: string;
};

const ORIGINAL_ENV = process.env;

function resetProviderEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    BETTER_AUTH_SECRET: "test-secret-with-enough-entropy",
    DATABASE_URL: "postgres://user:pass@localhost:5432/tas_test",
  };
  for (const key of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_TENANT_ID",
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
    "OIDC_DISCOVERY_URL",
    "OIDC_PROVIDER_NAME",
    "OIDC_SCOPES",
  ]) {
    delete process.env[key];
  }
}

async function loadAuthConfig(): Promise<AuthConfig> {
  await import("./auth");
  expect(mocks.betterAuth).toHaveBeenCalledTimes(1);
  return mocks.betterAuth.mock.calls[0][0] as AuthConfig;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  resetProviderEnv();
  mocks.hasPendingInvite.mockResolvedValue(false);
  mocks.resolvePendingInvitesForUser.mockResolvedValue(0);
  mocks.listWorkspacesForUser.mockResolvedValue([]);
});

describe("better-auth account creation hooks", () => {
  it("rejects new OAuth users who are neither instance admins nor invited", async () => {
    mocks.isInstanceAdminEmail.mockReturnValue(false);
    mocks.hasPendingInvite.mockResolvedValue(false);
    const config = await loadAuthConfig();

    await expect(
      config.databaseHooks.user.create.before({
        id: "user-1",
        email: "outsider@example.com",
        name: "Outsider",
      }),
    ).rejects.toThrow(
      "This instance is invite-only. Ask an admin to invite your email.",
    );
  });

  it("allows an instance admin account without requiring an invite", async () => {
    mocks.isInstanceAdminEmail.mockReturnValue(true);
    const config = await loadAuthConfig();
    const user = {
      id: "user-admin",
      email: "admin@example.com",
      name: "Admin User",
    };

    await expect(config.databaseHooks.user.create.before(user)).resolves.toEqual(
      { data: user },
    );
    expect(mocks.hasPendingInvite).not.toHaveBeenCalled();
  });

  it("allows invited OAuth users and resolves their workspaces after create", async () => {
    mocks.isInstanceAdminEmail.mockReturnValue(false);
    mocks.hasPendingInvite.mockResolvedValue(true);
    const config = await loadAuthConfig();
    const user = {
      id: "user-invited",
      email: "invited@example.com",
      name: "Invited User",
    };

    await expect(config.databaseHooks.user.create.before(user)).resolves.toEqual(
      { data: user },
    );
    await config.databaseHooks.user.create.after(user);

    expect(mocks.hasPendingInvite).toHaveBeenCalledWith("invited@example.com");
    expect(mocks.resolvePendingInvitesForUser).toHaveBeenCalledWith(
      "user-invited",
      "invited@example.com",
    );
  });
});

describe("better-auth provider wiring", () => {
  it("enables mocked Microsoft and OIDC providers without email/password", async () => {
    process.env.MICROSOFT_CLIENT_ID = "microsoft-id";
    process.env.MICROSOFT_CLIENT_SECRET = "microsoft-secret";
    process.env.OIDC_CLIENT_ID = "oidc-id";
    process.env.OIDC_CLIENT_SECRET = "oidc-secret";
    process.env.OIDC_DISCOVERY_URL =
      "https://idp.example.com/.well-known/openid-configuration";
    const config = await loadAuthConfig();

    expect(config.emailAndPassword).toEqual({ enabled: false });
    expect(mocks.genericOAuth).toHaveBeenCalledWith({
      config: expect.arrayContaining([
        expect.objectContaining({ providerId: "microsoft" }),
        expect.objectContaining({ providerId: "oidc" }),
      ]),
    });
    expect(config.plugins).toHaveLength(1);
  });
});
