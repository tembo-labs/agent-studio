import { describe, expect, it } from "vitest";

import { isPublicIpAddress, trustedOAuthUrl } from "./native-oauth-security";

const allowed = ["https://app.attio.com"];

describe("native OAuth URL trust checks", () => {
  it("rejects non-public IP literals", () => {
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("10.1.2.3")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("::ffff:a9fe:a9fe")).toBe(false);
  });

  it("allows known public IP literals", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("requires discovered OAuth endpoints to stay on the allowed origins", async () => {
    await expect(
      trustedOAuthUrl("https://app.attio.com/oidc/token", allowed, "Token"),
    ).resolves.toMatchObject({ origin: "https://app.attio.com" });

    await expect(
      trustedOAuthUrl("https://evil.example/oidc/token", allowed, "Token"),
    ).rejects.toThrow(/allowed provider origin/);
  });

  it("rejects http and private-address endpoints before fetch", async () => {
    await expect(
      trustedOAuthUrl("http://app.attio.com/oidc/token", allowed, "Token"),
    ).rejects.toThrow(/https/);

    await expect(
      trustedOAuthUrl(
        "https://169.254.169.254/token",
        ["https://169.254.169.254"],
        "Token",
      ),
    ).rejects.toThrow(/non-public IP/);

    await expect(
      trustedOAuthUrl("https://[::1]/token", ["https://[::1]"], "Token"),
    ).rejects.toThrow(/non-public IP/);
  });
});
