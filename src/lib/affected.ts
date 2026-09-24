/* "Me afeta também" rules. Takes the db (or a transaction) so it can be tested without HTTP. */
import { and, count, eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { reportAffected, reports } from "@/db/schema";

export type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

export class AffectedLimitError extends Error {
  constructor() {
    super("Limite de marcações por rede atingido");
    this.name = "AffectedLimitError";
  }
}

export class ReportNotFoundError extends Error {
  constructor() {
    super("Denúncia não encontrada");
    this.name = "ReportNotFoundError";
  }
}

type Mark = { reportId: string; voterId: string };

function sameMark(mark: Mark) {
  return and(eq(reportAffected.reportId, mark.reportId), eq(reportAffected.voterId, mark.voterId));
}

/* Check-then-insert is not atomic: two clicks from one network at once may pass the limit by one. That is fine for a soft limit. */
export async function markAffected(db: Db, mark: Mark & { ipHash: string; maxPerIp: number }) {
  const [report] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.id, mark.reportId));
  if (!report) throw new ReportNotFoundError();

  const [existing] = await db
    .select({ voterId: reportAffected.voterId })
    .from(reportAffected)
    .where(sameMark(mark));
  if (existing) return;

  const [sameNetwork] = await db
    .select({ total: count() })
    .from(reportAffected)
    .where(and(eq(reportAffected.reportId, mark.reportId), eq(reportAffected.ipHash, mark.ipHash)));
  if ((sameNetwork?.total ?? 0) >= mark.maxPerIp) throw new AffectedLimitError();

  await db
    .insert(reportAffected)
    .values({ reportId: mark.reportId, voterId: mark.voterId, ipHash: mark.ipHash })
    .onConflictDoNothing();
}

export async function unmarkAffected(db: Db, mark: Mark) {
  await db.delete(reportAffected).where(sameMark(mark));
}

/* Whoever reports the problem is the first person affected; the network limit does not apply to them. */
export async function insertAuthorMark(db: Db, mark: Mark & { ipHash: string }) {
  await db
    .insert(reportAffected)
    .values({ reportId: mark.reportId, voterId: mark.voterId, ipHash: mark.ipHash })
    .onConflictDoNothing();
}

export async function affectedSummary(db: Db, query: { reportId: string; voterId: string | null }) {
  const byMe = query.voterId
    ? sql<boolean>`coalesce(bool_or(${reportAffected.voterId} = ${query.voterId}::uuid), false)`
    : sql<boolean>`false`;
  const [row] = await db
    .select({ affectedCount: count(), affectedByMe: byMe })
    .from(reportAffected)
    .where(eq(reportAffected.reportId, query.reportId));
  return { affectedCount: row?.affectedCount ?? 0, affectedByMe: row?.affectedByMe ?? false };
}
