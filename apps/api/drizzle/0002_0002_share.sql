CREATE TABLE "canvas_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_share_links" (
	"canvas_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"mode" text DEFAULT 'closed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_shares" (
	"canvas_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvas_shares_canvas_id_user_id_pk" PRIMARY KEY("canvas_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "canvas_invites" ADD CONSTRAINT "canvas_invites_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_share_links" ADD CONSTRAINT "canvas_share_links_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_shares" ADD CONSTRAINT "canvas_shares_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_shares" ADD CONSTRAINT "canvas_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_invites_token_idx" ON "canvas_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_invites_canvas_email_idx" ON "canvas_invites" USING btree ("canvas_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_share_links_token_idx" ON "canvas_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "canvas_shares_user_id_idx" ON "canvas_shares" USING btree ("user_id");