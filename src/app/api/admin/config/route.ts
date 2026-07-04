import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';
import { getAllSystemConfigs, setSystemConfigs, getSystemConfig } from '@/lib/system-config';
import { prisma } from '@/lib/db';
import { getAppConfigValues, setAppConfigValues, APP_CONFIG_KEYS } from '@/lib/app-config';
import { resolveAppByCode } from '@/lib/app-context';

function parseCSV(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Check if any of the removed provider keys still have instances in DB.
 * Returns the blocked provider keys, or empty array if none.
 */
async function findBlockedProviders(removedProviders: string[]): Promise<string[]> {
  if (removedProviders.length === 0) return [];
  const groups = await prisma.paymentProviderInstance.groupBy({
    by: ['providerKey'],
    where: { providerKey: { in: removedProviders } },
    _count: true,
  });
  return groups.filter((g) => g._count > 0).map((g) => g.providerKey);
}

/**
 * Validate that ENABLED_PROVIDERS does not remove providers with existing instances.
 * Returns an error response if blocked, or null if OK.
 */
async function validateEnabledProviders(configs: { key: string; value: string }[]): Promise<NextResponse | null> {
  const entry = configs.find((c) => c.key === 'ENABLED_PROVIDERS');
  if (!entry) return null;

  const currentRaw = await getSystemConfig('ENABLED_PROVIDERS');
  if (!currentRaw) return null;

  const newSet = new Set(parseCSV(entry.value));
  const removed = parseCSV(currentRaw).filter((p) => !newSet.has(p));
  const blocked = await findBlockedProviders(removed);

  if (blocked.length > 0) {
    return NextResponse.json(
      { error: `无法关闭服务商类型 [${blocked.join(', ')}]：存在关联实例，请先删除所有实例` },
      { status: 409 },
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const appCode = request.nextUrl.searchParams.get('app_code');
    const app = await resolveAppByCode(appCode);
    const [appConfigs, sharedConfigs] = await Promise.all([
      getAppConfigValues(app.id),
      getAllSystemConfigs(),
    ]);
    const appConfigRows = APP_CONFIG_KEYS.map((key) => ({
      key,
      value: appConfigs[key],
      group: 'payment',
      label: key,
    }));
    const sharedRows = sharedConfigs.filter((config) => !APP_CONFIG_KEYS.includes(config.key as (typeof APP_CONFIG_KEYS)[number]));
    return NextResponse.json({ configs: [...appConfigRows, ...sharedRows] });
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_NOT_FOUND') {
      return NextResponse.json({ error: '业务应用不存在' }, { status: 404 });
    }
    console.error('Failed to get system configs:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: '获取系统配置失败' }, { status: 500 });
  }
}

const ALLOWED_CONFIG_KEYS = new Set([
  'ENABLED_PAYMENT_TYPES',
  'RECHARGE_MIN_AMOUNT',
  'RECHARGE_MAX_AMOUNT',
  'DAILY_RECHARGE_LIMIT',
  'ORDER_TIMEOUT_MINUTES',
  'IFRAME_ALLOW_ORIGINS',
  'PRODUCT_NAME_PREFIX',
  'PRODUCT_NAME_SUFFIX',
  'BALANCE_PAYMENT_DISABLED',
  'CANCEL_RATE_LIMIT_ENABLED',
  'CANCEL_RATE_LIMIT_WINDOW',
  'CANCEL_RATE_LIMIT_UNIT',
  'CANCEL_RATE_LIMIT_MAX',
  'CANCEL_RATE_LIMIT_WINDOW_MODE',
  'MAX_PENDING_ORDERS',
  'LOAD_BALANCE_STRATEGY',
  'ENABLED_PROVIDERS',
  'SUB2API_ADMIN_API_KEY',
  'DEFAULT_DEDUCT_BALANCE',
]);

export async function PUT(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const appCode = request.nextUrl.searchParams.get('app_code');
    const app = await resolveAppByCode(appCode);
    const body = await request.json();
    const { configs } = body;

    if (!Array.isArray(configs) || configs.length === 0) {
      return NextResponse.json({ error: '缺少必填字段: configs 数组' }, { status: 400 });
    }

    for (const config of configs) {
      if (!config.key || config.value === undefined) {
        return NextResponse.json({ error: '每条配置必须包含 key 和 value' }, { status: 400 });
      }
      if (!ALLOWED_CONFIG_KEYS.has(config.key)) {
        return NextResponse.json({ error: `不允许修改配置项: ${config.key}` }, { status: 400 });
      }
    }

    const appScopedConfigs = configs.filter((config: { key: string }) => APP_CONFIG_KEYS.includes(config.key as (typeof APP_CONFIG_KEYS)[number]));
    const sharedConfigs = configs.filter((config: { key: string }) => !APP_CONFIG_KEYS.includes(config.key as (typeof APP_CONFIG_KEYS)[number]));

    const blocked = await validateEnabledProviders(appScopedConfigs);
    if (blocked) return blocked;

    const filteredAppConfigs = configs.filter((config: { key: string }) =>
      APP_CONFIG_KEYS.includes(config.key as (typeof APP_CONFIG_KEYS)[number]),
    );
    const filteredSharedConfigs = configs.filter((config: { key: string }) =>
      !APP_CONFIG_KEYS.includes(config.key as (typeof APP_CONFIG_KEYS)[number]),
    );

    if (filteredAppConfigs.length > 0) {
      await setAppConfigValues(
        app.id,
        Object.fromEntries(filteredAppConfigs.map((config: { key: string; value: string }) => [config.key, config.value])),
      );
    }

    if (filteredSharedConfigs.length > 0) {
      await setSystemConfigs(
        filteredSharedConfigs.map((c: { key: string; value: string; group?: string; label?: string }) => ({
          key: c.key,
          value: c.value,
          group: c.group,
          label: c.label,
        })),
      );
    }

    return NextResponse.json({ success: true, updated: configs.length });
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_NOT_FOUND') {
      return NextResponse.json({ error: '业务应用不存在' }, { status: 404 });
    }
    console.error('Failed to update system configs:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: '更新系统配置失败' }, { status: 500 });
  }
}
