CREATE TABLE "apps" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "apps_code_key" ON "apps"("code");
CREATE INDEX "apps_status_idx" ON "apps"("status");

INSERT INTO "apps" ("id", "code", "name", "status", "created_at", "updated_at")
VALUES ('app_default', 'default', 'Default App', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "orders"
  ADD COLUMN "app_id" TEXT,
  ADD COLUMN "biz_order_id" TEXT,
  ADD COLUMN "biz_user_id" TEXT;

ALTER TABLE "channels"
  ADD COLUMN "app_id" TEXT;

ALTER TABLE "subscription_plans"
  ADD COLUMN "app_id" TEXT;

ALTER TABLE "payment_provider_instances"
  ADD COLUMN "app_id" TEXT;

UPDATE "orders" SET "app_id" = 'app_default' WHERE "app_id" IS NULL;
UPDATE "channels" SET "app_id" = 'app_default' WHERE "app_id" IS NULL;
UPDATE "subscription_plans" SET "app_id" = 'app_default' WHERE "app_id" IS NULL;
UPDATE "payment_provider_instances" SET "app_id" = 'app_default' WHERE "app_id" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "app_id" SET NOT NULL;
ALTER TABLE "channels" ALTER COLUMN "app_id" SET NOT NULL;
ALTER TABLE "subscription_plans" ALTER COLUMN "app_id" SET NOT NULL;
ALTER TABLE "payment_provider_instances" ALTER COLUMN "app_id" SET NOT NULL;

CREATE INDEX "orders_app_id_idx" ON "orders"("app_id");
CREATE INDEX "orders_biz_order_id_idx" ON "orders"("biz_order_id");
CREATE INDEX "channels_app_id_idx" ON "channels"("app_id");
CREATE INDEX "subscription_plans_app_id_idx" ON "subscription_plans"("app_id");
CREATE INDEX "payment_provider_instances_app_id_idx" ON "payment_provider_instances"("app_id");
CREATE INDEX "payment_provider_instances_app_id_provider_key_enabled_idx"
  ON "payment_provider_instances"("app_id", "provider_key", "enabled");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_app_id_fkey"
  FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "channels"
  ADD CONSTRAINT "channels_app_id_fkey"
  FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "subscription_plans_app_id_fkey"
  FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_provider_instances"
  ADD CONSTRAINT "payment_provider_instances_app_id_fkey"
  FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
