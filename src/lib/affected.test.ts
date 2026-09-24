import { afterAll, describe, expect, it } from "vitest";
import {
  AffectedLimitError,
  ReportNotFoundError,
  affectedSummary,
  insertAuthorMark,
  markAffected,
  unmarkAffected,
} from "@/lib/affected";
import { closeTestDb, dbAvailable, insertTestReport, withRollback } from "@/test/db";

afterAll(closeTestDb);

const voter = () => crypto.randomUUID();

describe.skipIf(!dbAvailable)("affected marks", () => {
  it("counts the same visitor once", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voterId = voter();
      await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      expect(await affectedSummary(tx, { reportId, voterId })).toEqual({
        affectedCount: 1,
        affectedByMe: true,
      });
    });
  });

  it("unmarks back to zero", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voterId = voter();
      await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      await unmarkAffected(tx, { reportId, voterId });
      expect(await affectedSummary(tx, { reportId, voterId })).toEqual({
        affectedCount: 0,
        affectedByMe: false,
      });
    });
  });

  it("refuses a new visitor once the network reached the limit", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      for (let i = 0; i < 3; i++) {
        await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 3 });
      }
      await expect(
        markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 3 }),
      ).rejects.toBeInstanceOf(AffectedLimitError);
      // Another network is not affected by that limit
      await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-b", maxPerIp: 3 });
      expect((await affectedSummary(tx, { reportId, voterId: null })).affectedCount).toBe(4);
    });
  });

  it("lets a visitor who already marked mark again at the limit (no-op)", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const first = voter();
      await markAffected(tx, { reportId, voterId: first, ipHash: "net-a", maxPerIp: 1 });
      await expect(
        markAffected(tx, { reportId, voterId: first, ipHash: "net-a", maxPerIp: 1 }),
      ).resolves.toBeUndefined();
    });
  });

  it("always lets someone unmark, even at the limit", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voters = [voter(), voter(), voter()];
      for (const voterId of voters) {
        await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      }
      await unmarkAffected(tx, { reportId, voterId: voters[0]! });
      expect((await affectedSummary(tx, { reportId, voterId: null })).affectedCount).toBe(2);
    });
  });

  it("reports a missing report", async () => {
    await withRollback(async (tx) => {
      await expect(
        markAffected(tx, {
          reportId: crypto.randomUUID(),
          voterId: voter(),
          ipHash: "net-a",
          maxPerIp: 3,
        }),
      ).rejects.toBeInstanceOf(ReportNotFoundError);
    });
  });

  it("summarises without a visitor", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 3 });
      expect(await affectedSummary(tx, { reportId, voterId: null })).toEqual({
        affectedCount: 1,
        affectedByMe: false,
      });
      expect(await affectedSummary(tx, { reportId, voterId: voter() })).toEqual({
        affectedCount: 1,
        affectedByMe: false,
      });
    });
  });

  it("inserts the author's mark ignoring the limit, and it counts for others", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 1 });
      const author = voter();
      await insertAuthorMark(tx, { reportId, voterId: author, ipHash: "net-a" });
      expect(await affectedSummary(tx, { reportId, voterId: author })).toEqual({
        affectedCount: 2,
        affectedByMe: true,
      });
    });
  });
});
