import { getAppConfigValue } from '@/lib/app-config';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';
import { matchesSupportedType } from '@/lib/payment/provider-instance';

interface EnabledInstanceLike {
  providerKey: string;
  supportedTypes: string | null;
  sortOrder?: number;
}

/**
 * 根据 ENABLED_PAYMENT_TYPES 配置过滤支持的支付类型。
 * configuredTypes 为 undefined 或空字符串时回退到全部支持类型。
 */
export function resolveEnabledPaymentTypes(supportedTypes: string[], configuredTypes: string | undefined): string[] {
  if (configuredTypes === undefined) return supportedTypes;

  const configuredTypeSet = new Set(
    configuredTypes
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean),
  );
  if (configuredTypeSet.size === 0) return supportedTypes;

  return supportedTypes.filter((type) => configuredTypeSet.has(type));
}

/**
 * 获取当前启用的支付类型（结合 registry 支持类型 + 数据库 ENABLED_PAYMENT_TYPES 配置）。
 */
export async function getEnabledPaymentTypes(appId: string): Promise<string[]> {
  await ensureDBProviders();
  const supportedTypes = paymentRegistry.getSupportedTypes();
  const configuredTypes = await getAppConfigValue(appId, 'ENABLED_PAYMENT_TYPES');
  return resolveEnabledPaymentTypes(supportedTypes, configuredTypes);
}

/**
 * 基于当前 App 已启用实例推导前台可见的支付类型。
 * 这一步会同时校验：
 * 1. registry 当前真正支持该类型
 * 2. App 配置允许该类型
 * 3. 至少存在一个启用实例可承载该类型
 */
export function resolveEnabledTypesFromInstances(
  supportedTypes: string[],
  configuredTypes: string | undefined,
  instances: EnabledInstanceLike[],
  getProviderKey: (type: string) => string | undefined,
): string[] {
  const configuredEnabledTypes = resolveEnabledPaymentTypes(supportedTypes, configuredTypes);

  return configuredEnabledTypes.filter((type) => {
    const providerKey = getProviderKey(type);
    if (!providerKey) return false;

    return instances.some((instance) => {
      if (instance.providerKey !== providerKey) return false;
      return matchesSupportedType(instance.supportedTypes, type);
    });
  });
}
