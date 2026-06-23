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
    const serial = headers['wechatpay-serial']?.trim();

    let provider;
    if (serial) {
      const instances = await prisma.paymentProviderInstance.findMany({
        where: { providerKey: 'wxpay', enabled: true },
        select: { id: true, config: true },
      });
      const matched = instances.find((instance) => {
        try {
          const config = JSON.parse(decrypt(instance.config)) as Record<string, string>;
          return config.publicKeyId === serial;
        } catch {
          return false;
        }
      });
      if (matched) {
        const config = JSON.parse(decrypt(matched.config)) as Record<string, string>;
        provider = createProviderFromInstance('wxpay', matched.id, config);
      }
    }

    if (!provider) {
      const env = getEnv();
      if (!env.WXPAY_PUBLIC_KEY || !env.WXPAY_MCH_ID) {
        return Response.json({ code: 'SUCCESS', message: '成功' });
      }
      provider = paymentRegistry.getProvider('wxpay_direct' as PaymentType);
    }

    const notification = await provider.verifyNotification(rawBody, headers);
    if (!notification) {
      return Response.json({ code: 'SUCCESS', message: '成功' });
    }
    const success = await handlePaymentNotify(notification, provider.name);
    return Response.json(success ? { code: 'SUCCESS', message: '成功' } : { code: 'FAIL', message: '处理失败' }, {
      status: success ? 200 : 500,
    });
  } catch (error) {
    console.error('Wxpay notify error:', error);
    return Response.json({ code: 'FAIL', message: '处理失败' }, { status: 500 });
  }
}
