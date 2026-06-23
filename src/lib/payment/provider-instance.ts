import { EasyPayProvider } from '@/lib/easy-pay/provider';
import { StripeProvider } from '@/lib/stripe/provider';
import { AlipayProvider } from '@/lib/alipay/provider';
import { WxpayProvider } from '@/lib/wxpay/provider';
import { getBasePaymentType, type PaymentProvider } from './types';

export function matchesSupportedType(configuredTypes: string | null | undefined, paymentType: string): boolean {
  if (!configuredTypes) return true;

  const types = configuredTypes
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (types.length === 0) return true;

  const baseType = getBasePaymentType(paymentType);
  return types.includes(paymentType) || types.includes(baseType);
}

export function createProviderFromInstance(
  providerKey: string,
  instanceId: string,
  config: Record<string, string>,
): PaymentProvider {
  switch (providerKey) {
    case 'easypay':
      return new EasyPayProvider(instanceId, config);
    case 'alipay':
      return new AlipayProvider(instanceId, config);
    case 'wxpay':
      return new WxpayProvider(instanceId, config);
    case 'stripe':
      return new StripeProvider(instanceId, config);
    default:
      throw new Error(`Unsupported provider instance type: ${providerKey}`);
  }
}
