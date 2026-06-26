import { describe, expect, it, vi } from 'vitest';

// Mock transitive dependencies to prevent env validation
vi.mock('@/lib/system-config', () => ({
  getSystemConfig: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/config', () => ({
  getEnv: () => ({
    MIN_RECHARGE_AMOUNT: 1,
    MAX_RECHARGE_AMOUNT: 1000,
    MAX_DAILY_RECHARGE_AMOUNT: 10000,
    ORDER_TIMEOUT_MINUTES: 5,
  }),
}));

vi.mock('@/lib/payment', () => ({
  initPaymentProviders: vi.fn(),
  ensureDBProviders: vi.fn().mockResolvedValue(undefined),
  paymentRegistry: { getSupportedTypes: () => [] },
}));

import { resolveEnabledPaymentTypes } from '@/lib/payment/resolve-enabled-types';
import { resolveEnabledTypesFromInstances } from '@/lib/payment/resolve-enabled-types';

describe('resolveEnabledPaymentTypes', () => {
  const allTypes = ['alipay', 'wxpay', 'stripe'];

  it('returns all supported types when configuredTypes is undefined', () => {
    expect(resolveEnabledPaymentTypes(allTypes, undefined)).toEqual(allTypes);
  });

  it('returns all supported types when configuredTypes is empty string', () => {
    expect(resolveEnabledPaymentTypes(allTypes, '')).toEqual(allTypes);
  });

  it('returns all supported types when configuredTypes is whitespace', () => {
    expect(resolveEnabledPaymentTypes(allTypes, '   ')).toEqual(allTypes);
  });

  it('filters to configured types that exist in supported', () => {
    expect(resolveEnabledPaymentTypes(allTypes, 'alipay,stripe')).toEqual(['alipay', 'stripe']);
  });

  it('ignores configured types not in supported list', () => {
    expect(resolveEnabledPaymentTypes(allTypes, 'alipay,paypal')).toEqual(['alipay']);
  });

  it('handles whitespace around type names', () => {
    expect(resolveEnabledPaymentTypes(allTypes, ' alipay , wxpay ')).toEqual(['alipay', 'wxpay']);
  });

  it('preserves order from supported types', () => {
    expect(resolveEnabledPaymentTypes(allTypes, 'stripe,alipay')).toEqual(['alipay', 'stripe']);
  });

  it('returns empty array when no configured types match', () => {
    expect(resolveEnabledPaymentTypes(allTypes, 'paypal,bitcoin')).toEqual([]);
  });

  it('handles single type', () => {
    expect(resolveEnabledPaymentTypes(allTypes, 'wxpay')).toEqual(['wxpay']);
  });

  it('filters configured types by enabled instances', () => {
    const result = resolveEnabledTypesFromInstances(
      ['alipay', 'wxpay', 'alipay_direct', 'wxpay_direct', 'stripe'],
      'alipay,wxpay,alipay_direct,wxpay_direct,stripe',
      [
        { providerKey: 'easypay', supportedTypes: 'alipay,wxpay', sortOrder: 0 },
        { providerKey: 'alipay', supportedTypes: 'alipay_direct', sortOrder: 1 },
        { providerKey: 'stripe', supportedTypes: 'stripe', sortOrder: 2 },
      ],
      (type) => {
        if (type === 'alipay' || type === 'wxpay') return 'easypay';
        if (type === 'alipay_direct') return 'alipay';
        if (type === 'wxpay_direct') return 'wxpay';
        if (type === 'stripe') return 'stripe';
        return undefined;
      },
    );

    expect(result).toEqual(['alipay', 'wxpay', 'alipay_direct', 'stripe']);
  });
});
