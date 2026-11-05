CREATE TABLE "compass_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workview" text NOT NULL,
	"lifeview" text NOT NULL,
	"written_at" timestamp with time zone NOT NULL,
	"replaced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quarterly_reviews" ADD COLUMN "compass_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quarterly_reviews" ADD COLUMN "dashboard_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "compass_versions" ADD CONSTRAINT "compass_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compass_versions_user" ON "compass_versions" USING btree ("user_id","replaced_at");--> statement-breakpoint
UPDATE "quarterly_reviews" SET "dashboard_at" = "created_at" WHERE "dashboard_at" IS NULL;