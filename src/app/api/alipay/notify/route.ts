import { NextRequest } from 'next/server';
import { handlePaymentNotify } from '@/lib/order/service';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';
import type { PaymentType } from '@/lib/payment';
import { getEnv } from '@/lib/config';
import { extractHeaders } from '@/lib/utils/api';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createProviderFromInstance } from '@/lib/payment/provider-instance';

export async function POST(request: NextRequest) {
  try {
    await ensureDBProviders();
    const rawBody = await request.text();
    const headers = extractHeaders(request);
    const params = new URLSearchParams(rawBody);
    const appId = params.get('app_id')?.trim();

    let provider;
    if (appId) {
      const instances = await prisma.paymentProviderInstance.findMany({
        where: { providerKey: 'alipay', enabled: true },
        select: { id: true, config: true },
      });
      const matched = instances.find((instance) => {
        try {
          const config = JSON.parse(decrypt(instance.config)) as Record<string, string>;
          return config.appId === appId;
        } catch {
          return false;
        }
      });
      if (matched) {
        const config = JSON.parse(decrypt(matched.config)) as Record<string, string>;
        provider = createProviderFromInstance('alipay', matched.id, config);
      }
    }

    if (!provider) {
      const env = getEnv();
      if (!env.ALIPAY_APP_ID || !env.ALIPAY_PRIVATE_KEY) {
        return new Response('success', { headers: { 'Content-Type': 'text/plain' } });
      }
      provider = paymentRegistry.getProvider('alipay_direct' as PaymentType);
    }

    const notification = await provider.verifyNotification(rawBody, headers);
    if (!notification) {
      return new Response('success', { headers: { 'Content-Type': 'text/plain' } });
    }
    const success = await handlePaymentNotify(notification, provider.name);
    return new Response(success ? 'success' : 'fail', {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Alipay notify error:', error);
    return new Response('fail', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
