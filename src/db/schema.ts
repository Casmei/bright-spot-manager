import {
  customType,
  doublePrecision,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/* Public protocol number, shown as AV-<n>. */
export const reportsProtocolSeq = pgSequence("reports_protocol_seq", { startWith: 1001 });

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  protocolSeq: integer("protocol_seq")
    .notNull()
    .unique()
    .default(sql`nextval('reports_protocol_seq')`),
  type: text("type").notNull(),
  description: text("description"),
  /* Private: never selected by public queries. */
  name: text("name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Kept apart so listing reports never loads the image bytes. */
export const reportPhotos = pgTable("report_photos", {
  reportId: uuid("report_id")
    .primaryKey()
    .references(() => reports.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
});
