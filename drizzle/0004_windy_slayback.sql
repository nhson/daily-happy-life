CREATE TABLE "quarterly_reviews" (
	"user_id" uuid NOT NULL,
	"quarter" text NOT NULL,
	"health" smallint,
	"work" smallint,
	"play" smallint,
	"love" smallint,
	"plans" jsonb,
	"active_plan_id" uuid,
	"plans_reviewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quarterly_reviews_user_id_quarter_pk" PRIMARY KEY("user_id","quarter"),
	CONSTRAINT "quarterly_reviews_quarter" CHECK ("quarterly_reviews"."quarter" ~ '^[0-9]{4}-Q[1-4]$'),
	CONSTRAINT "quarterly_reviews_health" CHECK ("quarterly_reviews"."health" is null or "quarterly_reviews"."health" between 0 and 10),
	CONSTRAINT "quarterly_reviews_work" CHECK ("quarterly_reviews"."work" is null or "quarterly_reviews"."work" between 0 and 10),
	CONSTRAINT "quarterly_reviews_play" CHECK ("quarterly_reviews"."play" is null or "quarterly_reviews"."play" between 0 and 10),
	CONSTRAINT "quarterly_reviews_love" CHECK ("quarterly_reviews"."love" is null or "quarterly_reviews"."love" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "quarterly_reviews" ADD CONSTRAINT "quarterly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_reviews" ADD CONSTRAINT "quarterly_reviews_active_plan_id_odyssey_plans_id_fk" FOREIGN KEY ("active_plan_id") REFERENCES "public"."odyssey_plans"("id") ON DELETE set null ON UPDATE no action;