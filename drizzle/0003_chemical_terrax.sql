CREATE TABLE "weekly_reviews" (
	"user_id" uuid NOT NULL,
	"week_end" date NOT NULL,
	"stats" jsonb NOT NULL,
	"notes" jsonb,
	"model" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"takeaway" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reviews_user_id_week_end_pk" PRIMARY KEY("user_id","week_end"),
	CONSTRAINT "weekly_reviews_takeaway" CHECK (char_length("weekly_reviews"."takeaway") <= 280)
);
--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;