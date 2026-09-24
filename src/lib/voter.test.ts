import { describe, expect, it } from "vitest";
import { hashIp, ipSecret, maxPerIp, parseVoterId, pickClientIp } from "@/lib/voter";

describe("parseVoterId", () => {
  it("accepts a UUID and normalises it to lower case", () => {
    expect(parseVoterId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    );
  });

  it.each([undefined, "", "abc", "'; drop table reports; --", "3f2504e0-4f89-41d3-9a0c"])(
    "treats %j as no visitor",
    (value) => {
      expect(parseVoterId(value)).toBeNull();
    },
  );
});

describe("pickClientIp", () => {
  it("uses the last X-Forwarded-For entry, the one our proxy appended", () => {
    expect(pickClientIp("1.2.3.4, 200.10.20.30", "10.0.0.2")).toBe("200.10.20.30");
  });

  it("ignores blanks and spaces", () => {
    expect(pickClientIp(" 200.10.20.30 , ", "10.0.0.2")).toBe("200.10.20.30");
  });

  it("falls back to the connection address without the header", () => {
    expect(pickClientIp(undefined, "10.0.0.2")).toBe("10.0.0.2");
    expect(pickClientIp("", "10.0.0.2")).toBe("10.0.0.2");
  });

  it("returns 'unknown' when nothing is available", () => {
    expect(pickClientIp(undefined, undefined)).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("is deterministic and never contains the IP", () => {
    const hash = hashIp("200.10.20.30", "s1");
    expect(hash).toBe(hashIp("200.10.20.30", "s1"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("200.10");
  });

  it("changes with the secret", () => {
    expect(hashIp("200.10.20.30", "s1")).not.toBe(hashIp("200.10.20.30", "s2"));
  });
});

describe("ipSecret", () => {
  it("uses the configured secret", () => {
    expect(ipSecret({ AFFECTED_IP_SECRET: "abc", NODE_ENV: "production" })).toBe("abc");
  });

  it("has a default outside production", () => {
    expect(ipSecret({ NODE_ENV: "development" })).toBe("dev-secret");
  });

  it("refuses to run in production without a secret", () => {
    expect(() => ipSecret({ NODE_ENV: "production" })).toThrow(/AFFECTED_IP_SECRET/);
  });
});

describe("maxPerIp", () => {
  it("defaults to 3", () => {
    expect(maxPerIp({})).toBe(3);
  });

  it("reads a positive integer", () => {
    expect(maxPerIp({ AFFECTED_MAX_PER_IP: "5" })).toBe(5);
  });

  it.each(["0", "-2", "abc", "2.5", ""])("ignores the invalid value %j", (value) => {
    expect(maxPerIp({ AFFECTED_MAX_PER_IP: value })).toBe(3);
  });
});
