import { NextRequest, NextResponse } from 'next/server';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';
import type { PaymentType } from '@/lib/payment';
import { handlePaymentNotify } from '@/lib/order/service';
import { extractHeaders } from '@/lib/utils/api';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createProviderFromInstance } from '@/lib/payment/provider-instance';
import { getEnv } from '@/lib/config';

// Stripe needs raw body - ensure Next.js doesn't parse it
export const dynamic = 'force-dynamic';

async function resolveStripeWebhookProvider(rawBody: Buffer, headers: Record<string, string>) {
  const instances = await prisma.paymentProviderInstance.findMany({
    where: { providerKey: 'stripe', enabled: true },
    select: { id: true, config: true },
  });

  const signatureErrors: string[] = [];

  for (const instance of instances) {
    try {
      const config = JSON.parse(decrypt(instance.config)) as Record<string, string>;
      if (!config.secretKey || !config.webhookSecret) {
        continue;
      }

      const provider = createProviderFromInstance('stripe', instance.id, config);
      const notification = await provider.verifyNotification(rawBody, headers);
      return { provider, notification };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      signatureErrors.push(`${instance.id}: ${message}`);
    }
  }

  const env = getEnv();
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    const provider = paymentRegistry.getProvider('stripe' as PaymentType);
    const notification = await provider.verifyNotification(rawBody, headers);
    return { provider, notification };
  }

  const detail =
    signatureErrors.length > 0
      ? `No Stripe webhook secret matched any enabled instance. Tried: ${signatureErrors.join(' | ')}`
      : 'No enabled Stripe instance has a usable secretKey + webhookSecret pair, and no default Stripe env config is available';
  throw new Error(detail);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureDBProviders();
    const rawBody = Buffer.from(await request.arrayBuffer());
    const headers = extractHeaders(request);
    const { provider, notification } = await resolveStripeWebhookProvider(rawBody, headers);

    if (!notification) {
      // Unknown event type — acknowledge receipt
      return NextResponse.json({ received: true });
    }
    const success = await handlePaymentNotify(notification, provider.name);

    if (!success) {
      // 处理失败（充值未完成等），返回 500 让 Stripe 重试
      return NextResponse.json({ error: 'Processing failed, will retry' }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
  }
}
