CREATE TABLE "ad_integration_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"mode" text NOT NULL,
	"sso_url" text NOT NULL,
	"bind_dn" text DEFAULT '' NOT NULL,
	"bind_password" text DEFAULT '' NOT NULL,
	"base_dn" text DEFAULT '' NOT NULL,
	"sync_frequency_minutes" integer DEFAULT 60 NOT NULL,
	"last_sync_at" timestamp,
	"sync_status" text NOT NULL,
	"synced_users_count" integer DEFAULT 0 NOT NULL,
	"deactivated_count" integer DEFAULT 0 NOT NULL,
	"mapping_roles" text,
	"mapping_department" text DEFAULT 'department' NOT NULL,
	"mapping_legal_entity" text DEFAULT 'company' NOT NULL,
	"mapping_display_name" text DEFAULT 'displayName' NOT NULL,
	"mapping_email" text DEFAULT 'mail' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_sync_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"users_total" integer NOT NULL,
	"users_updated" integer NOT NULL,
	"users_deactivated" integer NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_query_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"question" text NOT NULL,
	"sources_used" text[] NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"model" text DEFAULT 'gpt-4o' NOT NULL,
	"base_url" text DEFAULT '',
	"enabled" boolean DEFAULT false NOT NULL,
	"logging_enabled" boolean DEFAULT true NOT NULL,
	"html_generator_enabled" boolean DEFAULT false NOT NULL,
	"html_generator_system_prompt" text DEFAULT '' NOT NULL,
	"file_storage_path" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_nodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"parent_id" varchar,
	"allowed_roles" text[],
	"owner_ids" text[],
	"default_visibility_group_ids" text[],
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "effective_vis_group_map" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar NOT NULL,
	"visibility_group_ids" text[] NOT NULL,
	CONSTRAINT "effective_vis_group_map_material_id_unique" UNIQUE("material_id")
);
--> statement-breakpoint
CREATE TABLE "email_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_address" text NOT NULL,
	"sender_name" text NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_user" text NOT NULL,
	"smtp_password" text DEFAULT '' NOT NULL,
	"smtp_use_tls" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "helpful_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"material_id" varchar NOT NULL,
	"date" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" text NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_subscribers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar NOT NULL,
	"user_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"changelog" text,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"purpose" text,
	"tags" text[] NOT NULL,
	"tag_groups" jsonb NOT NULL,
	"criticality" text NOT NULL,
	"section_id" varchar NOT NULL,
	"owner_id" varchar,
	"deputy_id" varchar,
	"legal_entity" text NOT NULL,
	"department" text,
	"required_training" boolean DEFAULT false NOT NULL,
	"related_links" jsonb,
	"last_reviewed_at" timestamp,
	"next_review_at" timestamp,
	"review_period_days" integer,
	"visibility_group_ids" text[] NOT NULL,
	"new_hire_required" boolean DEFAULT false NOT NULL,
	"content_kind" text NOT NULL,
	"content_file" jsonb,
	"content_file_data" text,
	"additional_files" jsonb,
	"additional_files_data" jsonb,
	"content_page" jsonb,
	"search_text" text,
	"discussions_enabled" boolean DEFAULT true NOT NULL,
	"discussion_visibility" text DEFAULT 'Все' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"helpful_yes" integer DEFAULT 0 NOT NULL,
	"helpful_no" integer DEFAULT 0 NOT NULL,
	"archived_by" varchar,
	"archived_at" timestamp,
	"approval_step" text,
	"rejected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "new_hire_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"material_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar NOT NULL,
	"batch_id" varchar NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_version_id" varchar
);
--> statement-breakpoint
CREATE TABLE "new_hire_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "new_hires_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"template" text NOT NULL,
	"related_material_id" varchar,
	"related_version_id" varchar,
	"related_rfc_id" varchar,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_rbac_defaults" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"roles" text[] NOT NULL,
	CONSTRAINT "policy_rbac_defaults_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "policy_review_periods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criticality" text NOT NULL,
	"days" integer NOT NULL,
	"remind_before_days" integer[] NOT NULL,
	"escalation_after_days" integer[] NOT NULL,
	CONSTRAINT "policy_review_periods_criticality_unique" UNIQUE("criticality")
);
--> statement-breakpoint
CREATE TABLE "rfc_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfc_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfcs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL,
	"assigned_to" varchar NOT NULL,
	"sla_reacted_at" timestamp,
	"sla_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"roles" text[] NOT NULL,
	"legal_entity" text NOT NULL,
	"department" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"ad_account_name" text,
	"last_sync_at" timestamp,
	"last_login_at" timestamp,
	"deactivated_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "view_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visibility_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"member_ids" text[] NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "helpful_ratings_user_material_date_idx" ON "helpful_ratings" USING btree ("user_id","material_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "material_subscribers_material_user_idx" ON "material_subscribers" USING btree ("material_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "new_hire_assignments_user_material_idx" ON "new_hire_assignments" USING btree ("user_id","material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "new_hire_profiles_user_idx" ON "new_hire_profiles" USING btree ("user_id");