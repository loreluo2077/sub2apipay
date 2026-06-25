import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config';
import { getSystemConfig } from '@/lib/system-config';

export const APP_CONFIG_KEYS = [
  'ENABLED_PAYMENT_TYPES',
  'ENABLED_PROVIDERS',
  'PRODUCT_NAME_PREFIX',
  'PRODUCT_NAME_SUFFIX',
  'BALANCE_PAYMENT_DISABLED',
  'CANCEL_RATE_LIMIT_ENABLED',
  'CANCEL_RATE_LIMIT_WINDOW',
  'CANCEL_RATE_LIMIT_UNIT',
  'CANCEL_RATE_LIMIT_MAX',
  'CANCEL_RATE_LIMIT_WINDOW_MODE',
  'MAX_PENDING_ORDERS',
  'RECHARGE_MIN_AMOUNT',
  'RECHARGE_MAX_AMOUNT',
  'DAILY_RECHARGE_LIMIT',
  'ORDER_TIMEOUT_MINUTES',
  'LOAD_BALANCE_STRATEGY',
  'DEFAULT_DEDUCT_BALANCE',
] as const;

export type AppConfigKey = (typeof APP_CONFIG_KEYS)[number];

export interface AppConfigValues {
  ENABLED_PAYMENT_TYPES: string;
  ENABLED_PROVIDERS: string;
  PRODUCT_NAME_PREFIX: string;
  PRODUCT_NAME_SUFFIX: string;
  BALANCE_PAYMENT_DISABLED: string;
  CANCEL_RATE_LIMIT_ENABLED: string;
  CANCEL_RATE_LIMIT_WINDOW: string;
  CANCEL_RATE_LIMIT_UNIT: string;
  CANCEL_RATE_LIMIT_MAX: string;
  CANCEL_RATE_LIMIT_WINDOW_MODE: string;
  MAX_PENDING_ORDERS: string;
  RECHARGE_MIN_AMOUNT: string;
  RECHARGE_MAX_AMOUNT: string;
  DAILY_RECHARGE_LIMIT: string;
  ORDER_TIMEOUT_MINUTES: string;
  LOAD_BALANCE_STRATEGY: string;
  DEFAULT_DEDUCT_BALANCE: string;
}

type AppConfigRow = Awaited<
  ReturnType<
    typeof prisma.appConfig.findUnique<{
      where: { appId: string };
    }>
  >
>;

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString();
}

async function buildDefaultAppConfigValues(): Promise<AppConfigValues> {
  const env = getEnv();
  const enabledProviders = (await getSystemConfig('ENABLED_PROVIDERS')) ?? '';
  const enabledPaymentTypes = (await getSystemConfig('ENABLED_PAYMENT_TYPES')) ?? '';
  const defaultDeductBalance = (await getSystemConfig('DEFAULT_DEDUCT_BALANCE')) ?? 'true';

  return {
    ENABLED_PAYMENT_TYPES: enabledPaymentTypes,
    ENABLED_PROVIDERS: enabledProviders,
    PRODUCT_NAME_PREFIX: '',
    PRODUCT_NAME_SUFFIX: '',
    BALANCE_PAYMENT_DISABLED: 'false',
    CANCEL_RATE_LIMIT_ENABLED: 'false',
    CANCEL_RATE_LIMIT_WINDOW: '1',
    CANCEL_RATE_LIMIT_UNIT: 'day',
    CANCEL_RATE_LIMIT_MAX: '10',
    CANCEL_RATE_LIMIT_WINDOW_MODE: 'rolling',
    MAX_PENDING_ORDERS: '3',
    RECHARGE_MIN_AMOUNT: String(env.MIN_RECHARGE_AMOUNT),
    RECHARGE_MAX_AMOUNT: String(env.MAX_RECHARGE_AMOUNT),
    DAILY_RECHARGE_LIMIT: String(env.MAX_DAILY_RECHARGE_AMOUNT),
    ORDER_TIMEOUT_MINUTES: String(env.ORDER_TIMEOUT_MINUTES),
    LOAD_BALANCE_STRATEGY: 'round-robin',
    DEFAULT_DEDUCT_BALANCE: defaultDeductBalance === 'false' ? 'false' : 'true',
  };
}

function mergeAppConfig(row: AppConfigRow, defaults: AppConfigValues): AppConfigValues {
  if (!row) return defaults;

  return {
    ENABLED_PAYMENT_TYPES: row.enabledPaymentTypes || defaults.ENABLED_PAYMENT_TYPES,
    ENABLED_PROVIDERS: row.enabledProviders || defaults.ENABLED_PROVIDERS,
    PRODUCT_NAME_PREFIX: row.productNamePrefix,
    PRODUCT_NAME_SUFFIX: row.productNameSuffix,
    BALANCE_PAYMENT_DISABLED: row.balancePaymentDisabled ? 'true' : 'false',
    CANCEL_RATE_LIMIT_ENABLED: row.cancelRateLimitEnabled ? 'true' : 'false',
    CANCEL_RATE_LIMIT_WINDOW: String(row.cancelRateLimitWindow),
    CANCEL_RATE_LIMIT_UNIT: row.cancelRateLimitUnit,
    CANCEL_RATE_LIMIT_MAX: String(row.cancelRateLimitMax),
    CANCEL_RATE_LIMIT_WINDOW_MODE: row.cancelRateLimitWindowMode,
    MAX_PENDING_ORDERS: String(row.maxPendingOrders),
    RECHARGE_MIN_AMOUNT: decimalToString(row.rechargeMinAmount) || defaults.RECHARGE_MIN_AMOUNT,
    RECHARGE_MAX_AMOUNT: decimalToString(row.rechargeMaxAmount) || defaults.RECHARGE_MAX_AMOUNT,
    DAILY_RECHARGE_LIMIT: decimalToString(row.dailyRechargeLimit) || defaults.DAILY_RECHARGE_LIMIT,
    ORDER_TIMEOUT_MINUTES: row.orderTimeoutMinutes ? String(row.orderTimeoutMinutes) : defaults.ORDER_TIMEOUT_MINUTES,
    LOAD_BALANCE_STRATEGY: row.loadBalanceStrategy || defaults.LOAD_BALANCE_STRATEGY,
    DEFAULT_DEDUCT_BALANCE: row.defaultDeductBalance ? 'true' : 'false',
  };
}

export async function getAppConfigValues(appId: string): Promise<AppConfigValues> {
  const [row, defaults] = await Promise.all([
    prisma.appConfig.findUnique({ where: { appId } }),
    buildDefaultAppConfigValues(),
  ]);
  return mergeAppConfig(row, defaults);
}

export async function getAppConfigValue(appId: string, key: AppConfigKey): Promise<string> {
  const values = await getAppConfigValues(appId);
  return values[key];
}

export async function setAppConfigValues(
  appId: string,
  values: Partial<AppConfigValues>,
): Promise<void> {
  const data: Prisma.AppConfigUncheckedCreateInput = {
    appId,
    enabledPaymentTypes: values.ENABLED_PAYMENT_TYPES ?? '',
    enabledProviders: values.ENABLED_PROVIDERS ?? '',
    productNamePrefix: values.PRODUCT_NAME_PREFIX ?? '',
    productNameSuffix: values.PRODUCT_NAME_SUFFIX ?? '',
    balancePaymentDisabled: values.BALANCE_PAYMENT_DISABLED === 'true',
    cancelRateLimitEnabled: values.CANCEL_RATE_LIMIT_ENABLED === 'true',
    cancelRateLimitWindow: parseInt(values.CANCEL_RATE_LIMIT_WINDOW ?? '1', 10) || 1,
    cancelRateLimitUnit: values.CANCEL_RATE_LIMIT_UNIT ?? 'day',
    cancelRateLimitMax: parseInt(values.CANCEL_RATE_LIMIT_MAX ?? '10', 10) || 10,
    cancelRateLimitWindowMode: values.CANCEL_RATE_LIMIT_WINDOW_MODE ?? 'rolling',
    maxPendingOrders: parseInt(values.MAX_PENDING_ORDERS ?? '3', 10) || 3,
    rechargeMinAmount: values.RECHARGE_MIN_AMOUNT ? new Prisma.Decimal(values.RECHARGE_MIN_AMOUNT) : null,
    rechargeMaxAmount: values.RECHARGE_MAX_AMOUNT ? new Prisma.Decimal(values.RECHARGE_MAX_AMOUNT) : null,
    dailyRechargeLimit: values.DAILY_RECHARGE_LIMIT ? new Prisma.Decimal(values.DAILY_RECHARGE_LIMIT) : null,
    orderTimeoutMinutes: values.ORDER_TIMEOUT_MINUTES ? parseInt(values.ORDER_TIMEOUT_MINUTES, 10) || null : null,
    loadBalanceStrategy: values.LOAD_BALANCE_STRATEGY ?? 'round-robin',
    defaultDeductBalance: values.DEFAULT_DEDUCT_BALANCE !== 'false',
  };

  await prisma.appConfig.upsert({
    where: { appId },
    update: data,
    create: data,
  });
}

export async function seedDefaultAppConfig(appId: string): Promise<void> {
  const exists = await prisma.appConfig.findUnique({ where: { appId }, select: { appId: true } });
  if (exists) return;
  const defaults = await buildDefaultAppConfigValues();
  await setAppConfigValues(appId, defaults);
}
