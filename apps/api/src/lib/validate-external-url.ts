import ipaddr from "ipaddr.js";

/**
 * SSRF-safe URL validator.
 *
 * Rejects:
 *  - Non-http(s) protocols (file://, gopher://, etc.)
 *  - Malformed URLs
 *  - URLs whose hostname resolves to private (RFC1918), loopback,
 *    link-local, or carrier-grade-NAT addresses
 *
 * Resolved IPs are checked individually; if **any** address falls in a
 * blocked range, the whole URL is rejected (avoids DNS rebinding tricks).
 *
 * MUST be called before any server-side fetch of user-provided URLs.
 */

export type ValidationError =
  | { kind: "invalid-url"; raw: string }
  | { kind: "invalid-protocol"; protocol: string }
  | { kind: "dns-failure"; hostname: string }
  | { kind: "blocked-address"; address: string; reason: BlockReason };

export type BlockReason = "private" | "loopback" | "link-local" | "reserved";

export type ValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: ValidationError };

export type DnsLookup = (hostname: string) => Promise<readonly string[]>;

export interface ValidationOptions {
  /** Allowed URL protocols. Default: ['http:', 'https:']. */
  allowedProtocols?: readonly string[];
  /** DNS resolver — injectable for tests. Defaults to node:dns lookup. */
  dnsLookup?: DnsLookup;
}

const DEFAULT_ALLOWED_PROTOCOLS = ["http:", "https:"] as const;

const defaultDnsLookup: DnsLookup = async (hostname) => {
  const { lookup } = await import("node:dns/promises");
  const results = await lookup(hostname, { all: true });
  return results.map((r) => r.address);
};

export async function validateExternalUrl(
  raw: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const allowed = options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  const dns = options.dnsLookup ?? defaultDnsLookup;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: { kind: "invalid-url", raw } };
  }

  if (!allowed.includes(url.protocol)) {
    return {
      ok: false,
      error: { kind: "invalid-protocol", protocol: url.protocol },
    };
  }

  // If hostname is itself an IP literal, classify it directly.
  if (ipaddr.isValid(url.hostname)) {
    const reason = classifyBlocked(url.hostname);
    if (reason) {
      return {
        ok: false,
        error: { kind: "blocked-address", address: url.hostname, reason },
      };
    }
    return { ok: true, url };
  }

  let addresses: readonly string[];
  try {
    addresses = await dns(url.hostname);
  } catch {
    return {
      ok: false,
      error: { kind: "dns-failure", hostname: url.hostname },
    };
  }

  if (addresses.length === 0) {
    return {
      ok: false,
      error: { kind: "dns-failure", hostname: url.hostname },
    };
  }

  for (const addr of addresses) {
    const reason = classifyBlocked(addr);
    if (reason) {
      return {
        ok: false,
        error: { kind: "blocked-address", address: addr, reason },
      };
    }
  }

  return { ok: true, url };
}

function classifyBlocked(address: string): BlockReason | null {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return "reserved";
  }

  const range = parsed.range();

  // ipaddr.js range names → our reasons.
  switch (range) {
    case "private":
    case "carrierGradeNat":
    case "uniqueLocal":
      return "private";
    case "loopback":
      return "loopback";
    case "linkLocal":
      return "link-local";
    case "unicast":
      return null; // Public — allowed.
    default:
      // unspecified, broadcast, multicast, reserved, rfc6052, rfc6145, etc.
      return "reserved";
  }
}
