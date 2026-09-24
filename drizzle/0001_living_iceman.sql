CREATE TABLE "report_affected" (
	"report_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_affected_report_id_voter_id_pk" PRIMARY KEY("report_id","voter_id")
);
--> statement-breakpoint
ALTER TABLE "report_affected" ADD CONSTRAINT "report_affected_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_affected_report_id_ip_hash_index" ON "report_affected" USING btree ("report_id","ip_hash");