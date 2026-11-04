CREATE TABLE "compass" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"workview" text NOT NULL,
	"lifeview" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"intention" jsonb,
	"energy" smallint,
	"engagement" smallint,
	"meaning_sources" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"top3_task_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"morning_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "daily_logs_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "daily_logs_energy" CHECK ("daily_logs"."energy" is null or "daily_logs"."energy" between 1 and 5),
	CONSTRAINT "daily_logs_engagement" CHECK ("daily_logs"."engagement" is null or "daily_logs"."engagement" between 1 and 5),
	CONSTRAINT "daily_logs_meaning_sources" CHECK ("daily_logs"."meaning_sources" <@ array['wonder', 'coherence', 'flow', 'community']::text[]),
	CONSTRAINT "daily_logs_top3" CHECK (cardinality("daily_logs"."top3_task_ids") <= 3)
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"decision" text NOT NULL,
	"driven_by" text DEFAULT '' NOT NULL,
	"linked_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"title" text NOT NULL,
	"quarter" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objectives_quarter" CHECK ("objectives"."quarter" ~ '^[0-9]{4}-Q[1-4]$'),
	CONSTRAINT "objectives_status" CHECK ("objectives"."status" in ('active', 'done', 'dropped'))
);
--> statement-breakpoint
CREATE TABLE "odyssey_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot" smallint NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"questions" text DEFAULT '' NOT NULL,
	"resources" smallint,
	"likability" smallint,
	"confidence" smallint,
	"coherence" smallint,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "odyssey_plans_user_slot" UNIQUE("user_id","slot"),
	CONSTRAINT "odyssey_plans_slot" CHECK ("odyssey_plans"."slot" between 1 and 3),
	CONSTRAINT "odyssey_plans_resources" CHECK ("odyssey_plans"."resources" is null or "odyssey_plans"."resources" between 0 and 10),
	CONSTRAINT "odyssey_plans_likability" CHECK ("odyssey_plans"."likability" is null or "odyssey_plans"."likability" between 0 and 10),
	CONSTRAINT "odyssey_plans_confidence" CHECK ("odyssey_plans"."confidence" is null or "odyssey_plans"."confidence" between 0 and 10),
	CONSTRAINT "odyssey_plans_coherence" CHECK ("odyssey_plans"."coherence" is null or "odyssey_plans"."coherence" between 0 and 10)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"objective_id" uuid,
	"prototype_plan_id" uuid,
	"title" text NOT NULL,
	"due_date" date,
	"top3_date" date,
	"done_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_kind_link" CHECK (("tasks"."kind" = 'objective' and "tasks"."objective_id" is not null and "tasks"."prototype_plan_id" is null)
       or ("tasks"."kind" = 'prototype' and "tasks"."prototype_plan_id" is not null and "tasks"."objective_id" is null)
       or ("tasks"."kind" = 'maintenance' and "tasks"."objective_id" is null and "tasks"."prototype_plan_id" is null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"timezone" text NOT NULL,
	"reminder_time" text DEFAULT '07:00' NOT NULL,
	"evening_hour" smallint DEFAULT 19 NOT NULL,
	"day_end_hour" smallint DEFAULT 4 NOT NULL,
	"theme" text DEFAULT 'sky' NOT NULL,
	"locale" text DEFAULT 'vi' NOT NULL,
	"push_subscription" jsonb,
	"reminder_schedule_id" text,
	"onboarded_at" timestamp with time zone,
	"onboarding" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_theme" CHECK ("users"."theme" in ('sky', 'light', 'dark')),
	CONSTRAINT "users_locale" CHECK ("users"."locale" in ('vi', 'en')),
	CONSTRAINT "users_evening_hour" CHECK ("users"."evening_hour" between 0 and 23),
	CONSTRAINT "users_day_end_hour" CHECK ("users"."day_end_hour" between 0 and 23),
	CONSTRAINT "users_reminder_time" CHECK ("users"."reminder_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "compass" ADD CONSTRAINT "compass_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_linked_plan_id_odyssey_plans_id_fk" FOREIGN KEY ("linked_plan_id") REFERENCES "public"."odyssey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_plan_id_odyssey_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."odyssey_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odyssey_plans" ADD CONSTRAINT "odyssey_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prototype_plan_id_odyssey_plans_id_fk" FOREIGN KEY ("prototype_plan_id") REFERENCES "public"."odyssey_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "objectives_user_quarter" ON "objectives" USING btree ("user_id","quarter");--> statement-breakpoint
CREATE UNIQUE INDEX "odyssey_plans_one_active" ON "odyssey_plans" USING btree ("user_id") WHERE "odyssey_plans"."is_active";--> statement-breakpoint
CREATE INDEX "tasks_user_open" ON "tasks" USING btree ("user_id") WHERE "tasks"."done_at" is null and "tasks"."closed_at" is null;