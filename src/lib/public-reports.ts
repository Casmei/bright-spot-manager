import { count, desc, eq, sql } from "drizzle-orm";
import { reportAffected, reports } from "@/db/schema";
import type { Db } from "@/lib/affected";
import type { ReportType } from "@/lib/report-types";
import { formatProtocol, photoUrl, type PublicReport } from "@/lib/reports";

export async function selectPublicReports(db: Db, voterId: string | null): Promise<PublicReport[]> {
  const affected = db
    .select({
      reportId: reportAffected.reportId,
      affectedCount: count().as("affected_count"),
      affectedByMe: (voterId
        ? sql<boolean>`bool_or(${reportAffected.voterId} = ${voterId}::uuid)`
        : sql<boolean>`false`
      ).as("affected_by_me"),
    })
    .from(reportAffected)
    .groupBy(reportAffected.reportId)
    .as("affected");

  /* Explicit columns on purpose: name and WhatsApp are never read here. */
  const rows = await db
    .select({
      id: reports.id,
      protocolSeq: reports.protocolSeq,
      type: reports.type,
      description: reports.description,
      address: reports.address,
      lat: reports.lat,
      lng: reports.lng,
      createdAt: reports.createdAt,
      affectedCount: sql<number>`coalesce(${affected.affectedCount}, 0)`.mapWith(Number),
      affectedByMe: sql<boolean>`coalesce(${affected.affectedByMe}, false)`,
    })
    .from(reports)
    .leftJoin(affected, eq(affected.reportId, reports.id))
    .orderBy(desc(reports.createdAt));

  return rows.map((row) => ({
    id: row.id,
    protocol: formatProtocol(row.protocolSeq),
    type: row.type as ReportType,
    ...(row.description ? { description: row.description } : {}),
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.createdAt.toISOString(),
    photoUrl: photoUrl(row.id),
    affectedCount: row.affectedCount,
    affectedByMe: row.affectedByMe,
  }));
}
