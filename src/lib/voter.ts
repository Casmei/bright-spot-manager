/* Anonymous visitor identity for "Me afeta também". Pure helpers: no request access here. */
import { createHmac } from "node:crypto";

export const VOTER_COOKIE = "vigia_voter";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_MAX_PER_IP = 3;

type Env = Record<string, string | undefined>;

/* A tampered cookie is just "no visitor": it never reaches a query. */
export function parseVoterId(value: string | undefined) {
  return value && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

/* Coolify's proxy appends the real address, so the last entry is the trustworthy one. */
export function pickClientIp(forwardedFor: string | undefined, socketIp: string | undefined) {
  const entries = (forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.at(-1) ?? socketIp ?? "unknown";
}

export function ipSecret(env: Env) {
  const secret = env["AFFECTED_IP_SECRET"];
  if (secret) return secret;
  if (env["NODE_ENV"] === "production") throw new Error("AFFECTED_IP_SECRET não configurado");
  return "dev-secret";
}

/* Keyed hash: a plain sha256 of an IPv4 could be reversed by trying every address. */
export function hashIp(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function maxPerIp(env: Env) {
  const value = Number(env["AFFECTED_MAX_PER_IP"]);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_PER_IP;
}
