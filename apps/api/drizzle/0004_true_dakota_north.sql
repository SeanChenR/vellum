CREATE TABLE "user_ai_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferred_provider" text NOT NULL,
	"preferred_model" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;