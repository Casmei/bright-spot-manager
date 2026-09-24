CREATE SEQUENCE "public"."reports_protocol_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "report_photos" (
	"report_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_seq" integer DEFAULT nextval('reports_protocol_seq') NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_protocol_seq_unique" UNIQUE("protocol_seq")
);
--> statement-breakpoint
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;