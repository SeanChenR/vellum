ALTER TABLE "user_ai_preferences" DROP CONSTRAINT "user_ai_preferences_pkey";
--> statement-breakpoint
ALTER TABLE "user_ai_preferences" RENAME COLUMN "preferred_provider" TO "provider";
--> statement-breakpoint
ALTER TABLE "user_ai_preferences" RENAME COLUMN "preferred_model" TO "model";
--> statement-breakpoint
ALTER TABLE "user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_user_id_provider_pk" PRIMARY KEY ("user_id", "provider");
