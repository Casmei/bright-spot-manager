import { afterAll, describe, expect, it } from "vitest";
import { insertAuthorMark } from "@/lib/affected";
import { selectPublicReports } from "@/lib/public-reports";
import { closeTestDb, dbAvailable, insertTestReport, withRollback } from "@/test/db";

afterAll(closeTestDb);

describe.skipIf(!dbAvailable)("selectPublicReports", () => {
  it("counts marks per report and flags the visitor's own", async () => {
    await withRollback(async (tx) => {
      const marked = await insertTestReport(tx);
      const empty = await insertTestReport(tx);
      const me = crypto.randomUUID();
      await insertAuthorMark(tx, { reportId: marked, voterId: me, ipHash: "a" });
      await insertAuthorMark(tx, { reportId: marked, voterId: crypto.randomUUID(), ipHash: "b" });

      const mine = await selectPublicReports(tx, me);
      expect(mine.find((r) => r.id === marked)).toMatchObject({
        affectedCount: 2,
        affectedByMe: true,
      });
      expect(mine.find((r) => r.id === empty)).toMatchObject({
        affectedCount: 0,
        affectedByMe: false,
      });

      const anonymous = await selectPublicReports(tx, null);
      expect(anonymous.find((r) => r.id === marked)).toMatchObject({
        affectedCount: 2,
        affectedByMe: false,
      });
    });
  });

  it("never exposes the reporter's name or WhatsApp", async () => {
    await withRollback(async (tx) => {
      const id = await insertTestReport(tx);
      const report = (await selectPublicReports(tx, null)).find((r) => r.id === id);
      expect(report).toBeDefined();
      expect(Object.keys(report!)).not.toContain("name");
      expect(Object.keys(report!)).not.toContain("whatsapp");
    });
  });
});
