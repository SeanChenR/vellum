import { describe, expect, test } from "bun:test";
import { validateExternalUrl } from "./validate-external-url";

const fakeDns = (mapping: Record<string, readonly string[]>) => {
  return async (hostname: string): Promise<readonly string[]> => {
    const result = mapping[hostname];
    if (!result) throw new Error(`unknown host ${hostname}`);
    return result;
  };
};

describe("validateExternalUrl — protocol", () => {
  test("rejects file://", async () => {
    const r = await validateExternalUrl("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-protocol");
  });

  test("rejects gopher://", async () => {
    const r = await validateExternalUrl("gopher://example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-protocol");
  });

  test("rejects javascript:", async () => {
    const r = await validateExternalUrl("javascript:alert(1)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-protocol");
  });

  test("custom allowedProtocols can broaden", async () => {
    const r = await validateExternalUrl("ftp://example.com", {
      allowedProtocols: ["ftp:"],
      dnsLookup: fakeDns({ "example.com": ["93.184.216.34"] }),
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateExternalUrl — malformed", () => {
  test("rejects invalid URL", async () => {
    const r = await validateExternalUrl("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-url");
  });

  test("rejects empty string", async () => {
    const r = await validateExternalUrl("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-url");
  });
});

describe("validateExternalUrl — IP literal hostname", () => {
  test("rejects loopback IPv4 literal", async () => {
    const r = await validateExternalUrl("http://127.0.0.1/admin");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("blocked-address");
      if (r.error.kind === "blocked-address") {
        expect(r.error.reason).toBe("loopback");
      }
    }
  });

  test("rejects RFC1918 10.x literal", async () => {
    const r = await validateExternalUrl("http://10.0.0.5/");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("private");
    }
  });

  test("rejects RFC1918 192.168.x literal", async () => {
    const r = await validateExternalUrl("http://192.168.1.1/");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("private");
    }
  });

  test("rejects RFC1918 172.16.x literal", async () => {
    const r = await validateExternalUrl("http://172.16.0.1/");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("private");
    }
  });

  test("rejects link-local 169.254.x (AWS metadata)", async () => {
    const r = await validateExternalUrl("http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("link-local");
    }
  });

  test("rejects loopback IPv6 literal", async () => {
    const r = await validateExternalUrl("http://[::1]/");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("loopback");
    }
  });

  test("rejects unique-local IPv6 (fc00::/7)", async () => {
    const r = await validateExternalUrl("http://[fc00::1]/");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("private");
    }
  });

  test("accepts public IPv4 literal", async () => {
    const r = await validateExternalUrl("http://8.8.8.8/");
    expect(r.ok).toBe(true);
  });
});

describe("validateExternalUrl — DNS-resolved hostname", () => {
  test("accepts public hostname", async () => {
    const r = await validateExternalUrl("https://example.com/path?q=1", {
      dnsLookup: fakeDns({ "example.com": ["93.184.216.34"] }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.pathname).toBe("/path");
  });

  test("rejects hostname resolving to private IP", async () => {
    const r = await validateExternalUrl("https://internal.example.com/", {
      dnsLookup: fakeDns({ "internal.example.com": ["10.0.5.6"] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "blocked-address") {
      expect(r.error.reason).toBe("private");
    }
  });

  test("rejects when ANY resolved address is blocked (DNS rebinding guard)", async () => {
    const r = await validateExternalUrl("https://mixed.example.com/", {
      dnsLookup: fakeDns({
        "mixed.example.com": ["93.184.216.34", "10.0.0.1"],
      }),
    });
    expect(r.ok).toBe(false);
  });

  test("rejects DNS lookup failure", async () => {
    const r = await validateExternalUrl("https://nx.example.com/", {
      dnsLookup: fakeDns({}),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("dns-failure");
  });

  test("rejects empty DNS result", async () => {
    const r = await validateExternalUrl("https://empty.example.com/", {
      dnsLookup: fakeDns({ "empty.example.com": [] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("dns-failure");
  });
});
