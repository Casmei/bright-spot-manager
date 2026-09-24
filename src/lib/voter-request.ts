/* Request-bound side of the visitor identity. Only call inside server function handlers. */
import { getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { VOTER_COOKIE, hashIp, ipSecret, parseVoterId, pickClientIp } from "@/lib/voter";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function readVoterId() {
  return parseVoterId(getCookie(VOTER_COOKIE));
}

/* Created on the first action, never on a plain visit; each action renews it for a year. */
export function ensureVoterId() {
  const voterId = readVoterId() ?? crypto.randomUUID();
  setCookie(VOTER_COOKIE, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
  return voterId;
}

export function requestIpHash() {
  const ip = pickClientIp(getRequestHeader("x-forwarded-for"), getRequestIP());
  return hashIp(ip, ipSecret(process.env));
}
