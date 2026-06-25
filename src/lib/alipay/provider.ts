import type {
  PaymentProvider,
  PaymentType,
  CreatePaymentRequest,
  CreatePaymentResponse,
  QueryOrderResponse,
  PaymentNotification,
  RefundRequest,
  RefundResponse,
} from '@/lib/payment/types';
import { pageExecute, execute } from './client';
import { verifySign } from './sign';
import { getEnv } from '@/lib/config';
import type { AlipayTradeQueryResponse, AlipayTradeRefundResponse, AlipayTradeCloseResponse } from './types';
import { parseAlipayNotificationParams } from './codec';

export interface BuildAlipayPaymentUrlInput {
  orderId: string;
  amount: number;
  subject: string;
  notifyUrl?: string;
  returnUrl?: string | null;
  isMobile?: boolean;
  mockGatewaySellerId?: string;
  mockGatewayPrivateKey?: string;
}

function isHostedMockMode(instanceConfig?: Record<string, string>): boolean {
  const gatewayBase = instanceConfig?.gatewayBase?.trim();
  return Boolean(gatewayBase && /localhost:3001|127\.0\.0\.1:3001|mock-sub2api/i.test(gatewayBase));
}

async function createHostedMockPayment(
  input: BuildAlipayPaymentUrlInput,
  instanceConfig?: Record<string, string>,
): Promise<CreatePaymentResponse> {
  const gatewayUrl = buildAlipayPaymentUrl(input, instanceConfig);
  const response = await fetch(gatewayUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });

  const location = response.headers.get('location');
  if (!location) {
    const body = await response.text().catch(() => '');
    throw new Error(`Alipay mock hosted create failed: ${response.status} ${body}`);
  }

  const payUrl = new URL(location, gatewayUrl).toString();
  return {
    tradeNo: input.orderId,
    payUrl,
    qrCode: payUrl,
  };
}

function isTradeNotExistError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('[ACQ.TRADE_NOT_EXIST]');
}

function getRequiredParam(params: Record<string, string>, key: string): string {
  const value = params[key]?.trim();
  if (!value) {
    throw new Error(`Alipay notification missing required field: ${key}`);
  }
  return value;
}

export function buildAlipayPaymentUrl(input: BuildAlipayPaymentUrlInput, instanceConfig?: Record<string, string>): string {
  const method = input.isMobile ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
  const productCode = input.isMobile ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';

  return pageExecute(
    {
      out_trade_no: input.orderId,
      product_code: productCode,
      total_amount: input.amount.toFixed(2),
      subject: input.subject,
    },
    {
      notifyUrl: input.notifyUrl,
      returnUrl: input.returnUrl,
      method,
      extraParams: {
        mock_gateway_seller_id: input.mockGatewaySellerId,
        mock_gateway_private_key: input.mockGatewayPrivateKey,
      },
    },
    instanceConfig,
  );
}

export function buildAlipayEntryUrl(orderId: string): string {
  const env = getEnv();
  return new URL(`/pay/${orderId}`, env.NEXT_PUBLIC_APP_URL).toString();
}

export class AlipayProvider implements PaymentProvider {
  readonly name: string;
  readonly providerKey = 'alipay';
  readonly supportedTypes: PaymentType[] = ['alipay_direct'];
  readonly defaultLimits = {
    alipay_direct: { singleMax: 1000, dailyMax: 10000 },
  };
  readonly instanceId?: string;
  private instanceConfig?: Record<string, string>;

  constructor(instanceId?: string, instanceConfig?: Record<string, string>) {
    this.instanceId = instanceId;
    this.instanceConfig = instanceConfig;
    this.name = instanceId ? `alipay:${instanceId}` : 'alipay-direct';
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    if (isHostedMockMode(this.instanceConfig)) {
      return createHostedMockPayment(
        {
          orderId: request.orderId,
          amount: request.amount,
          subject: request.subject,
          notifyUrl: request.notifyUrl,
          returnUrl: request.returnUrl,
          isMobile: request.isMobile,
          mockGatewaySellerId: this.instanceConfig?.sellerId,
          mockGatewayPrivateKey: this.instanceConfig?.privateKey,
        },
        this.instanceConfig,
      );
    }

    if (!request.isMobile) {
      const entryUrl = buildAlipayEntryUrl(request.orderId);
      return {
        tradeNo: request.orderId,
        payUrl: entryUrl,
        qrCode: entryUrl,
      };
    }

    const payUrl = buildAlipayPaymentUrl({
      orderId: request.orderId,
      amount: request.amount,
      subject: request.subject,
      notifyUrl: request.notifyUrl,
      returnUrl: request.returnUrl,
      isMobile: true,
    }, this.instanceConfig);

    return { tradeNo: request.orderId, payUrl };
  }

  async queryOrder(tradeNo: string): Promise<QueryOrderResponse> {
    let result: AlipayTradeQueryResponse;
    try {
      result = await execute<AlipayTradeQueryResponse>('alipay.trade.query', {
        out_trade_no: tradeNo,
      }, undefined, this.instanceConfig);
    } catch (error) {
      if (isTradeNotExistError(error)) {
        return {
          tradeNo,
          status: 'pending',
          amount: 0,
        };
      }
      throw error;
    }

    let status: 'pending' | 'paid' | 'failed' | 'refunded';
    switch (result.trade_status) {
      case 'TRADE_SUCCESS':
      case 'TRADE_FINISHED':
        status = 'paid';
        break;
      case 'TRADE_CLOSED':
        status = 'failed';
        break;
      default:
        status = 'pending';
    }

    const amount = parseFloat(result.total_amount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Alipay queryOrder: invalid total_amount "${result.total_amount}" for trade ${tradeNo}`);
    }

    return {
      tradeNo: result.trade_no || tradeNo,
      status,
      amount: Math.round(amount * 100) / 100,
      paidAt: result.send_pay_date ? new Date(result.send_pay_date) : undefined,
    };
  }

  async verifyNotification(rawBody: string | Buffer, headers: Record<string, string>): Promise<PaymentNotification> {
    const env = getEnv();
    const params = parseAlipayNotificationParams(rawBody, headers);
    const appId = this.instanceConfig?.appId || env.ALIPAY_APP_ID || '';
    const publicKey = this.instanceConfig?.publicKey || env.ALIPAY_PUBLIC_KEY || '';

    if (params.sign_type && params.sign_type.toUpperCase() !== 'RSA2') {
      throw new Error('Unsupported sign_type, only RSA2 is accepted');
    }

    const sign = getRequiredParam(params, 'sign');
    if (!publicKey || !verifySign(params, publicKey, sign)) {
      throw new Error(
        'Alipay notification signature verification failed (check ALIPAY_PUBLIC_KEY uses Alipay public key, not app public key, and rebuild/redeploy the latest image)',
      );
    }

    const tradeNo = getRequiredParam(params, 'trade_no');
    const orderId = getRequiredParam(params, 'out_trade_no');
    const tradeStatus = getRequiredParam(params, 'trade_status');
    const notifyAppId = getRequiredParam(params, 'app_id');

    if (!appId || notifyAppId !== appId) {
      throw new Error('Alipay notification app_id mismatch');
    }

    const amount = Number.parseFloat(getRequiredParam(params, 'total_amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Alipay notification invalid total_amount');
    }

    return {
      tradeNo,
      orderId,
      amount: Math.round(amount * 100) / 100,
      status: tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED' ? 'success' : 'failed',
      rawData: params,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    const result = await execute<AlipayTradeRefundResponse>('alipay.trade.refund', {
      out_trade_no: request.orderId,
      refund_amount: request.amount.toFixed(2),
      refund_reason: request.reason || '',
      out_request_no: request.orderId + '-refund',
    }, undefined, this.instanceConfig);

    return {
      refundId: result.trade_no || `${request.orderId}-refund`,
      status: result.fund_change === 'Y' ? 'success' : 'pending',
    };
  }

  async cancelPayment(tradeNo: string): Promise<void> {
    try {
      await execute<AlipayTradeCloseResponse>('alipay.trade.close', {
        out_trade_no: tradeNo,
      }, undefined, this.instanceConfig);
    } catch (error) {
      if (isTradeNotExistError(error)) {
        return;
      }
      throw error;
    }
  }
}
