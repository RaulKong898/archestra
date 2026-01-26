ALTER TABLE "agents" ADD COLUMN "llm_provider" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_model" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_api_key_strategy" text DEFAULT 'dynamic' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_static_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_llm_static_api_key_id_chat_api_keys_id_fk" FOREIGN KEY ("llm_static_api_key_id") REFERENCES "public"."chat_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_llm_static_api_key_id_idx" ON "agents" USING btree ("llm_static_api_key_id");