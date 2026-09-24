import { describe, expect, it } from "vitest";
import { AffectedSync, type AffectedView } from "@/lib/affected-sync";
import type { SetAffectedResult } from "@/lib/affected.functions";

/* A fake server whose answers the test releases one by one. */
function fakeServer() {
  const calls: { wanted: boolean; resolve: (result: SetAffectedResult | null) => void }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const send = (wanted: boolean) =>
    new Promise<SetAffectedResult | null>((resolve) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls.push({
        wanted,
        resolve: (result) => {
          inFlight -= 1;
          resolve(result);
        },
      });
    });
  return { send, calls, maxInFlight: () => maxInFlight };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(initial = { count: 4, byMe: false }) {
  const server = fakeServer();
  const views: AffectedView[] = [];
  const sync = new AffectedSync(initial, server.send, (view) => views.push(view));
  return { server, views, sync, last: () => views.at(-1) };
}

describe("AffectedSync", () => {
  it("shows the click at once, then adopts the server's answer", async () => {
    const { server, sync, last } = setup();
    sync.toggle();
    expect(last()).toEqual({ count: 5, byMe: true, error: null });
    server.calls[0]!.resolve({ ok: true, affectedCount: 7, affectedByMe: true });
    await flush();
    expect(last()).toEqual({ count: 7, byMe: true, error: null });
  });

  it("never runs two requests at once: a quick undo waits and is sent after", async () => {
    const { server, sync, last } = setup();
    sync.toggle();
    sync.toggle();
    expect(last()).toEqual({ count: 4, byMe: false, error: null });
    expect(server.calls).toHaveLength(1);
    server.calls[0]!.resolve({ ok: true, affectedCount: 5, affectedByMe: true });
    await flush();
    expect(server.calls.map((call) => call.wanted)).toEqual([true, false]);
    server.calls[1]!.resolve({ ok: true, affectedCount: 4, affectedByMe: false });
    await flush();
    expect(server.maxInFlight()).toBe(1);
    expect(last()).toEqual({ count: 4, byMe: false, error: null });
  });

  it("skips the follow-up when the clicks cancel out while waiting", async () => {
    const { server, sync, last } = setup();
    sync.toggle();
    sync.toggle();
    sync.toggle();
    server.calls[0]!.resolve({ ok: true, affectedCount: 5, affectedByMe: true });
    await flush();
    expect(server.calls).toHaveLength(1);
    expect(last()).toEqual({ count: 5, byMe: true, error: null });
  });

  it("goes back to what the server last confirmed, with its message, on refusal", async () => {
    const { server, sync, last } = setup();
    sync.toggle();
    server.calls[0]!.resolve({ ok: false, message: "Limite" });
    await flush();
    expect(last()).toEqual({ count: 4, byMe: false, error: "Limite" });
  });

  it("uses the generic message when the request itself fails", async () => {
    const { server, sync, last } = setup();
    sync.toggle();
    server.calls[0]!.resolve(null);
    await flush();
    expect(last()?.byMe).toBe(false);
    expect(last()?.error).toMatch(/Não foi possível/);
  });

  it("trusts the server when it disagrees instead of retrying forever", async () => {
    const { server, sync, last } = setup();
    sync.toggle();
    server.calls[0]!.resolve({ ok: true, affectedCount: 4, affectedByMe: false });
    await flush();
    expect(server.calls).toHaveLength(1);
    expect(last()).toEqual({ count: 4, byMe: false, error: null });
  });
});
