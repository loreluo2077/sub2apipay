CREATE TABLE "app_configs" (
  "app_id" TEXT NOT NULL,
  "enabled_payment_types" TEXT NOT NULL DEFAULT '',
  "enabled_providers" TEXT NOT NULL DEFAULT '',
  "product_name_prefix" TEXT NOT NULL DEFAULT '',
  "product_name_suffix" TEXT NOT NULL DEFAULT '',
  "balance_payment_disabled" BOOLEAN NOT NULL DEFAULT false,
  "cancel_rate_limit_enabled" BOOLEAN NOT NULL DEFAULT false,
  "cancel_rate_limit_window" INTEGER NOT NULL DEFAULT 1,
  "cancel_rate_limit_unit" TEXT NOT NULL DEFAULT 'day',
  "cancel_rate_limit_max" INTEGER NOT NULL DEFAULT 10,
  "cancel_rate_limit_window_mode" TEXT NOT NULL DEFAULT 'rolling',
  "max_pending_orders" INTEGER NOT NULL DEFAULT 3,
  "recharge_min_amount" DECIMAL(10,2),
  "recharge_max_amount" DECIMAL(10,2),
  "daily_recharge_limit" DECIMAL(10,2),
  "order_timeout_minutes" INTEGER,
  "load_balance_strategy" TEXT NOT NULL DEFAULT 'round-robin',
  "default_deduct_balance" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_configs_pkey" PRIMARY KEY ("app_id")
);

ALTER TABLE "app_configs"
ADD CONSTRAINT "app_configs_app_id_fkey"
FOREIGN KEY ("app_id") REFERENCES "apps"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "app_configs" (
  "app_id",
  "enabled_payment_types",
  "enabled_providers",
  "product_name_prefix",
  "product_name_suffix",
  "balance_payment_disabled",
  "cancel_rate_limit_enabled",
  "cancel_rate_limit_window",
  "cancel_rate_limit_unit",
  "cancel_rate_limit_max",
  "cancel_rate_limit_window_mode",
  "max_pending_orders",
  "recharge_min_amount",
  "recharge_max_amount",
  "daily_recharge_limit",
  "order_timeout_minutes",
  "load_balance_strategy",
  "default_deduct_balance",
  "updated_at"
)
SELECT
  a."id",
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'ENABLED_PAYMENT_TYPES'), ''),
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'ENABLED_PROVIDERS'), ''),
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'PRODUCT_NAME_PREFIX'), ''),
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'PRODUCT_NAME_SUFFIX'), ''),
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'BALANCE_PAYMENT_DISABLED'), 'false') = 'true',
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'CANCEL_RATE_LIMIT_ENABLED'), 'false') = 'true',
  COALESCE(NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'CANCEL_RATE_LIMIT_WINDOW'), ''), '1')::INTEGER,
  COALESCE(NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'CANCEL_RATE_LIMIT_UNIT'), ''), 'day'),
  COALESCE(NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'CANCEL_RATE_LIMIT_MAX'), ''), '10')::INTEGER,
  COALESCE(NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'CANCEL_RATE_LIMIT_WINDOW_MODE'), ''), 'rolling'),
  COALESCE(NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'MAX_PENDING_ORDERS'), ''), '3')::INTEGER,
  NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'RECHARGE_MIN_AMOUNT'), '')::DECIMAL(10,2),
  NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'RECHARGE_MAX_AMOUNT'), '')::DECIMAL(10,2),
  NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'DAILY_RECHARGE_LIMIT'), '')::DECIMAL(10,2),
  NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'ORDER_TIMEOUT_MINUTES'), '')::INTEGER,
  COALESCE(NULLIF((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'LOAD_BALANCE_STRATEGY'), ''), 'round-robin'),
  COALESCE((SELECT sc."value" FROM "system_configs" sc WHERE sc."key" = 'DEFAULT_DEDUCT_BALANCE'), 'true') <> 'false',
  NOW()
FROM "apps" a
ON CONFLICT ("app_id") DO NOTHING;
