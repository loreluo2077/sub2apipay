import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockVerifyAdminToken = vi.fn();
const mockGetAllSystemConfigs = vi.fn();
const mockSetSystemConfigs = vi.fn();
const mockGetSystemConfig = vi.fn();
const mockGetAppConfigValues = vi.fn();
const mockSetAppConfigValues = vi.fn();
const mockResolveAppByCode = vi.fn();
const mockGroupBy = vi.fn();

vi.mock('@/lib/admin-auth', () => ({
  verifyAdminToken: (...args: unknown[]) => mockVerifyAdminToken(...args),
  unauthorizedResponse: () => NextResponse.json({ error: '未授权' }, { status: 401 }),
}));

vi.mock('@/lib/app-context', () => ({
  resolveAppByCode: (...args: unknown[]) => mockResolveAppByCode(...args),
}));

vi.mock('@/lib/app-config', () => ({
  APP_CONFIG_KEYS: [
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
  ],
  getAppConfigValues: (...args: unknown[]) => mockGetAppConfigValues(...args),
  setAppConfigValues: (...args: unknown[]) => mockSetAppConfigValues(...args),
}));

vi.mock('@/lib/system-config', () => ({
  getAllSystemConfigs: (...args: unknown[]) => mockGetAllSystemConfigs(...args),
  setSystemConfigs: (...args: unknown[]) => mockSetSystemConfigs(...args),
  getSystemConfig: (...args: unknown[]) => mockGetSystemConfig(...args),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    paymentProviderInstance: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
  },
}));

import { GET, PUT } from '@/app/api/admin/config/route';

function createRequest(method = 'GET', body?: object) {
  const headers: Record<string, string> = { Authorization: 'Bearer test-admin-token' };
  if (body) headers['Content-Type'] = 'application/json';
  return new NextRequest('https://pay.example.com/api/admin/config?app_code=default', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminToken.mockResolvedValue(true);
    mockResolveAppByCode.mockResolvedValue({ id: 'app_default', code: 'default', name: 'Default App', status: 'active' });
    mockGetAppConfigValues.mockResolvedValue({
      ENABLED_PAYMENT_TYPES: 'alipay,wxpay',
      ENABLED_PROVIDERS: 'easypay,alipay',
      PRODUCT_NAME_PREFIX: 'Sub2API',
      PRODUCT_NAME_SUFFIX: 'CNY',
      BALANCE_PAYMENT_DISABLED: 'false',
      CANCEL_RATE_LIMIT_ENABLED: 'false',
      CANCEL_RATE_LIMIT_WINDOW: '1',
      CANCEL_RATE_LIMIT_UNIT: 'day',
      CANCEL_RATE_LIMIT_MAX: '10',
      CANCEL_RATE_LIMIT_WINDOW_MODE: 'rolling',
      MAX_PENDING_ORDERS: '3',
      RECHARGE_MIN_AMOUNT: '10',
      RECHARGE_MAX_AMOUNT: '1000',
      DAILY_RECHARGE_LIMIT: '0',
      ORDER_TIMEOUT_MINUTES: '5',
      LOAD_BALANCE_STRATEGY: 'round-robin',
      DEFAULT_DEDUCT_BALANCE: 'true',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockVerifyAdminToken.mockResolvedValue(false);
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it('returns configs with sensitive values masked', async () => {
    mockGetAllSystemConfigs.mockResolvedValue([
      { key: 'SUB2API_ADMIN_API_KEY', value: 'my-super-secret-key-12345', group: 'general', label: null },
    ]);

    const res = await GET(createRequest());
    const data = await res.json();
    const target = data.configs.find((config: { key: string }) => config.key === 'SUB2API_ADMIN_API_KEY');

    expect(res.status).toBe(200);
    expect(target.value).toBe('*********************2345');
    expect(target.value).not.toBe('my-super-secret-key-12345');
    expect(data.configs.some((config: { key: string; value: string }) => config.key === 'RECHARGE_MIN_AMOUNT' && config.value === '10')).toBe(true);
  });

  it('masks short sensitive values (<=4 chars) to ****', async () => {
    mockGetAllSystemConfigs.mockResolvedValue([
      { key: 'STRIPE_SECRET_KEY', value: 'ab', group: 'general', label: null },
    ]);

    const res = await GET(createRequest());
    const data = await res.json();
    const target = data.configs.find((config: { key: string }) => config.key === 'STRIPE_SECRET_KEY');

    expect(target.value).toBe('****');
  });

  it('masks values for keys containing PASSWORD, PRIVATE, SECRET', async () => {
    mockGetAllSystemConfigs.mockResolvedValue([
      { key: 'DB_PASSWORD', value: 'longpassword123', group: 'general', label: null },
      { key: 'ALIPAY_PRIVATE_KEY', value: 'private-key-data', group: 'general', label: null },
      { key: 'MY_SECRET', value: 'secret-val', group: 'general', label: null },
    ]);

    const res = await GET(createRequest());
    const data = await res.json();
    const password = data.configs.find((config: { key: string }) => config.key === 'DB_PASSWORD');
    const privateKey = data.configs.find((config: { key: string }) => config.key === 'ALIPAY_PRIVATE_KEY');
    const secret = data.configs.find((config: { key: string }) => config.key === 'MY_SECRET');

    expect(password.value).toMatch(/^\*+d123$/);
    expect(privateKey.value).toMatch(/^\*+data$/);
    expect(secret.value).toMatch(/^\*+-val$/);
  });

  it('returns 500 on error', async () => {
    mockGetAllSystemConfigs.mockRejectedValue(new Error('DB error'));
    const res = await GET(createRequest());
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminToken.mockResolvedValue(true);
    mockSetSystemConfigs.mockResolvedValue(undefined);
    mockSetAppConfigValues.mockResolvedValue(undefined);
    mockResolveAppByCode.mockResolvedValue({ id: 'app_default', code: 'default', name: 'Default App', status: 'active' });
  });

  it('returns 401 when unauthenticated', async () => {
    mockVerifyAdminToken.mockResolvedValue(false);
    const res = await PUT(createRequest('PUT', { configs: [{ key: 'RECHARGE_MIN_AMOUNT', value: '5' }] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when configs is missing', async () => {
    const res = await PUT(createRequest('PUT', {}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('configs');
  });

  it('returns 400 when configs is empty array', async () => {
    const res = await PUT(createRequest('PUT', { configs: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when config entry missing key or value', async () => {
    const res = await PUT(createRequest('PUT', { configs: [{ key: 'RECHARGE_MIN_AMOUNT' }] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('key');
  });

  it('returns 400 for disallowed config key', async () => {
    const res = await PUT(createRequest('PUT', { configs: [{ key: 'DANGEROUS_KEY', value: 'hack' }] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('DANGEROUS_KEY');
  });

  it('updates allowed configs successfully', async () => {
    const res = await PUT(
      createRequest('PUT', {
        configs: [
          { key: 'RECHARGE_MIN_AMOUNT', value: '5' },
          { key: 'RECHARGE_MAX_AMOUNT', value: '500' },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockSetAppConfigValues).toHaveBeenCalledWith(
      'app_default',
      expect.objectContaining({
        RECHARGE_MIN_AMOUNT: '5',
        RECHARGE_MAX_AMOUNT: '500',
      }),
    );
  });

  it('filters out masked sensitive values (unchanged by user)', async () => {
    const res = await PUT(
      createRequest('PUT', {
        configs: [
          { key: 'SUB2API_ADMIN_API_KEY', value: '********************2345' },
          { key: 'RECHARGE_MIN_AMOUNT', value: '10' },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockSetAppConfigValues).toHaveBeenCalledWith(
      'app_default',
      expect.objectContaining({ RECHARGE_MIN_AMOUNT: '10' }),
    );
  });

  it('passes through actual (non-masked) sensitive values', async () => {
    const res = await PUT(
      createRequest('PUT', {
        configs: [{ key: 'SUB2API_ADMIN_API_KEY', value: 'new-real-api-key' }],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockSetSystemConfigs).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'SUB2API_ADMIN_API_KEY', value: 'new-real-api-key' }),
    ]);
  });

  it('returns 409 when removing a provider that has instances', async () => {
    mockGetSystemConfig.mockResolvedValue('easypay,alipay,wxpay');
    mockGroupBy.mockResolvedValue([{ providerKey: 'easypay', _count: 2 }]);

    const res = await PUT(
      createRequest('PUT', {
        configs: [{ key: 'ENABLED_PROVIDERS', value: 'alipay,wxpay' }],
      }),
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('easypay');
  });

  it('allows removing a provider that has no instances', async () => {
    mockGetSystemConfig.mockResolvedValue('easypay,alipay');
    mockGroupBy.mockResolvedValue([]);

    const res = await PUT(
      createRequest('PUT', {
        configs: [{ key: 'ENABLED_PROVIDERS', value: 'alipay' }],
      }),
    );

    expect(res.status).toBe(200);
  });

  it('allows adding new providers', async () => {
    mockGetSystemConfig.mockResolvedValue('easypay');
    // No providers removed, so groupBy should not block
    mockGroupBy.mockResolvedValue([]);

    const res = await PUT(
      createRequest('PUT', {
        configs: [{ key: 'ENABLED_PROVIDERS', value: 'easypay,alipay,stripe' }],
      }),
    );

    expect(res.status).toBe(200);
  });

  it('skips provider validation when ENABLED_PROVIDERS is not being updated', async () => {
    const res = await PUT(
      createRequest('PUT', {
        configs: [{ key: 'RECHARGE_MIN_AMOUNT', value: '5' }],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockGetSystemConfig).not.toHaveBeenCalled();
  });

  it('skips provider validation when no current ENABLED_PROVIDERS exists', async () => {
    mockGetSystemConfig.mockResolvedValue(undefined);

    const res = await PUT(
      createRequest('PUT', {
        configs: [{ key: 'ENABLED_PROVIDERS', value: 'easypay' }],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockSetAppConfigValues.mockRejectedValue(new Error('DB error'));
    const res = await PUT(createRequest('PUT', { configs: [{ key: 'RECHARGE_MIN_AMOUNT', value: '5' }] }));
    expect(res.status).toBe(500);
  });
});
