import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import type { McpProvider } from "@/lib/mcp-providers";

const privateIpBlocks = new BlockList();

privateIpBlocks.addSubnet("0.0.0.0", 8, "ipv4");
privateIpBlocks.addSubnet("10.0.0.0", 8, "ipv4");
privateIpBlocks.addSubnet("100.64.0.0", 10, "ipv4");
privateIpBlocks.addSubnet("127.0.0.0", 8, "ipv4");
privateIpBlocks.addSubnet("169.254.0.0", 16, "ipv4");
privateIpBlocks.addSubnet("172.16.0.0", 12, "ipv4");
privateIpBlocks.addSubnet("192.0.0.0", 24, "ipv4");
privateIpBlocks.addSubnet("192.0.2.0", 24, "ipv4");
privateIpBlocks.addSubnet("192.168.0.0", 16, "ipv4");
privateIpBlocks.addSubnet("198.18.0.0", 15, "ipv4");
privateIpBlocks.addSubnet("198.51.100.0", 24, "ipv4");
privateIpBlocks.addSubnet("203.0.113.0", 24, "ipv4");
privateIpBlocks.addSubnet("224.0.0.0", 4, "ipv4");
privateIpBlocks.addSubnet("240.0.0.0", 4, "ipv4");
privateIpBlocks.addAddress("255.255.255.255", "ipv4");

privateIpBlocks.addAddress("::", "ipv6");
privateIpBlocks.addAddress("::1", "ipv6");
privateIpBlocks.addSubnet("64:ff9b:1::", 48, "ipv6");
privateIpBlocks.addSubnet("100::", 64, "ipv6");
privateIpBlocks.addSubnet("2001::", 23, "ipv6");
privateIpBlocks.addSubnet("2001:2::", 48, "ipv6");
privateIpBlocks.addSubnet("2001:db8::", 32, "ipv6");
privateIpBlocks.addSubnet("fc00::", 7, "ipv6");
privateIpBlocks.addSubnet("fe80::", 10, "ipv6");
privateIpBlocks.addSubnet("ff00::", 8, "ipv6");

function ipv4FromMappedIpv6(address: string): string | null {
  const lower = address.toLowerCase();
  const prefix = lower.startsWith("::ffff:")
    ? "::ffff:"
    : lower.startsWith("0:0:0:0:0:ffff:")
      ? "0:0:0:0:0:ffff:"
      : null;
  if (!prefix) return null;

  const pieces = lower.slice(prefix.length).split(":");
  if (pieces.length !== 2) return null;
  const high = Number.parseInt(pieces[0], 16);
  const low = Number.parseInt(pieces[1], 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return !privateIpBlocks.check(address, "ipv4");
  }
  if (version === 6) {
    const mappedIpv4 = ipv4FromMappedIpv6(address);
    if (mappedIpv4) return isPublicIpAddress(mappedIpv4);
    return !privateIpBlocks.check(address, "ipv6");
  }
  return false;
}

function endpointHostname(url: URL): string {
  return url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
}

function parseHttpsUrl(rawUrl: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not include credentials.`);
  }
  if (!url.hostname) {
    throw new Error(`${label} must include a host.`);
  }
  const hostname = endpointHostname(url);
  const literalIp = isIP(hostname);
  if (literalIp !== 0 && !isPublicIpAddress(hostname)) {
    throw new Error(`${label} resolves to a non-public IP address.`);
  }
  return url;
}

async function assertPublicDns(url: URL, label: string): Promise<void> {
  const hostname = endpointHostname(url);
  if (isIP(hostname) !== 0) return;

  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error(`${label} did not resolve to any IP addresses.`);
  }
  const blocked = records.find((record) => !isPublicIpAddress(record.address));
  if (blocked) {
    throw new Error(
      `${label} resolves to a non-public IP address (${blocked.address}).`,
    );
  }
}

export async function trustedProviderMcpOrigin(
  provider: McpProvider,
): Promise<string> {
  const url = parseHttpsUrl(provider.mcpServerUrl, "MCP server URL");
  await assertPublicDns(url, "MCP server URL");
  return url.origin;
}

export async function trustedOAuthUrl(
  rawUrl: string,
  provider: McpProvider,
  label: string,
): Promise<URL> {
  const url = parseHttpsUrl(rawUrl, label);
  if (!provider.oauthAuthorizationServerOrigins.includes(url.origin)) {
    throw new Error(`${label} is not on an allowed provider origin.`);
  }
  await assertPublicDns(url, label);
  return url;
}

export function noRedirectFetchInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    redirect: "manual",
  };
}
