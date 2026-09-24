import { afterAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { reportAffected, reports } from "@/db/schema";
import { closeTestDb, dbAvailable, insertTestReport, withRollback } from "@/test/db";

afterAll(closeTestDb);

describe.skipIf(!dbAvailable)("report_affected", () => {
  it("accepts one mark per voter per report", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voterId = crypto.randomUUID();
      await tx.insert(reportAffected).values({ reportId, voterId, ipHash: "h" });
      await tx
        .insert(reportAffected)
        .values({ reportId, voterId, ipHash: "h" })
        .onConflictDoNothing();
      const [row] = await tx
        .select({ total: count() })
        .from(reportAffected)
        .where(eq(reportAffected.reportId, reportId));
      expect(row?.total).toBe(1);
    });
  });

  it("drops the marks when the report is deleted", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      await tx
        .insert(reportAffected)
        .values({ reportId, voterId: crypto.randomUUID(), ipHash: "h" });
      await tx.delete(reports).where(eq(reports.id, reportId));
      const [row] = await tx
        .select({ total: count() })
        .from(reportAffected)
        .where(eq(reportAffected.reportId, reportId));
      expect(row?.total).toBe(0);
    });
  });
});
