import { getEnv } from '@/lib/config';
import { generateSign } from './sign';
import type { EasyPayCreateResponse, EasyPayQueryResponse, EasyPayRefundResponse } from './types';

export interface CreatePaymentOptions {
  outTradeNo: string;
  amount: string;
  paymentType: string;
  clientIp: string;
  productName: string;
  returnUrl?: string;
  isMobile?: boolean;
}

function normalizeCidList(cid?: string): string | undefined {
  if (!cid) return undefined;
  const normalized = cid
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');
  return normalized || undefined;
}

function resolveCid(paymentType: string, instanceConfig?: Record<string, string>): string | undefined {
  if (instanceConfig) {
    if (paymentType === 'alipay') {
      return normalizeCidList(instanceConfig.cidAlipay) || normalizeCidList(instanceConfig.cid);
    }
    return normalizeCidList(instanceConfig.cidWxpay) || normalizeCidList(instanceConfig.cid);
  }
  const env = getEnv();
  if (paymentType === 'alipay') {
    return normalizeCidList(env.EASY_PAY_CID_ALIPAY) || normalizeCidList(env.EASY_PAY_CID);
  }
  return normalizeCidList(env.EASY_PAY_CID_WXPAY) || normalizeCidList(env.EASY_PAY_CID);
}

type EasyPayConfigField = 'pid' | 'pkey' | 'apiBase' | 'notifyUrl' | 'returnUrl';

const ENV_FIELD_MAP: Record<EasyPayConfigField, keyof ReturnType<typeof getEnv>> = {
  pid: 'EASY_PAY_PID',
  pkey: 'EASY_PAY_PKEY',
  apiBase: 'EASY_PAY_API_BASE',
  notifyUrl: 'EASY_PAY_NOTIFY_URL',
  returnUrl: 'EASY_PAY_RETURN_URL',
};

interface ResolvedEasyPayConfig {
  pid: string;
  pkey: string;
  apiBase: string;
  notifyUrl: string;
  returnUrl: string;
}

function isMissingValue(value: string | undefined): boolean {
  return !value || value.trim() === '';
}

function getEnvFieldValue(env: ReturnType<typeof getEnv>, field: EasyPayConfigField): string | undefined {
  switch (field) {
    case 'pid':
      return env.EASY_PAY_PID;
    case 'pkey':
      return env.EASY_PAY_PKEY;
    case 'apiBase':
      return env.EASY_PAY_API_BASE;
    case 'notifyUrl':
      return env.EASY_PAY_NOTIFY_URL;
    case 'returnUrl':
      return env.EASY_PAY_RETURN_URL;
  }
}

function resolveEasyPayConfig(
  requiredFields: EasyPayConfigField[],
  instanceConfig?: Record<string, string>,
): ResolvedEasyPayConfig {
  if (instanceConfig) {
    const missingFields = requiredFields.filter((field) => isMissingValue(instanceConfig[field]));
    if (missingFields.length > 0) {
      throw new Error(`EasyPay instance config missing required fields: ${missingFields.join(', ')}`);
    }

    return {
      pid: instanceConfig.pid!,
      pkey: instanceConfig.pkey!,
      apiBase: instanceConfig.apiBase!,
      notifyUrl: instanceConfig.notifyUrl,
      returnUrl: instanceConfig.returnUrl,
    };
  }

  const env = getEnv();
  const missingEnvFields = requiredFields.filter((field) => isMissingValue(getEnvFieldValue(env, field)));

  if (missingEnvFields.length > 0) {
    const envKeys = missingEnvFields.map((field) => ENV_FIELD_MAP[field]);
    throw new Error(`EasyPay environment variables missing required fields: ${envKeys.join(', ')}`);
  }

  return {
    pid: env.EASY_PAY_PID!,
    pkey: env.EASY_PAY_PKEY!,
    apiBase: env.EASY_PAY_API_BASE!,
    notifyUrl: env.EASY_PAY_NOTIFY_URL ?? '',
    returnUrl: env.EASY_PAY_RETURN_URL ?? '',
  };
}

export async function createPayment(
  opts: CreatePaymentOptions,
  instanceConfig?: Record<string, string>,
): Promise<EasyPayCreateResponse> {
  const { pid, pkey, apiBase, notifyUrl, returnUrl } = resolveEasyPayConfig(
    ['pid', 'pkey', 'apiBase', 'notifyUrl', 'returnUrl'],
    instanceConfig,
  );

  const params: Record<string, string> = {
    pid,
    type: opts.paymentType,
    out_trade_no: opts.outTradeNo,
    notify_url: notifyUrl,
    return_url: opts.returnUrl || returnUrl,
    name: opts.productName,
    money: opts.amount,
    clientip: opts.clientIp,
  };

  const cid = resolveCid(opts.paymentType, instanceConfig);
  if (cid) {
    params.cid = cid;
  }

  if (opts.isMobile) {
    params.device = 'mobile';
  }

  const sign = generateSign(params, pkey);
  params.sign = sign;
  params.sign_type = 'MD5';

  const formData = new URLSearchParams(params);
  const response = await fetch(`${apiBase}/mapi.php`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await response.json()) as EasyPayCreateResponse;
  if (data.code !== 1) {
    throw new Error(`EasyPay create payment failed: ${data.msg || 'unknown error'}`);
  }
  return data;
}

export async function queryOrder(
  outTradeNo: string,
  instanceConfig?: Record<string, string>,
): Promise<EasyPayQueryResponse> {
  const { pid, pkey, apiBase } = resolveEasyPayConfig(['pid', 'pkey', 'apiBase'], instanceConfig);

  // 使用 POST 避免密钥暴露在 URL 中（URL 会被记录到服务器/CDN 日志）
  const params = new URLSearchParams({
    act: 'order',
    pid,
    key: pkey,
    out_trade_no: outTradeNo,
  });
  const response = await fetch(`${apiBase}/api.php`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json()) as EasyPayQueryResponse;
  if (data.code !== 1) {
    throw new Error(`EasyPay query order failed: ${data.msg || 'unknown error'}`);
  }
  return data;
}

export async function refund(
  tradeNo: string,
  outTradeNo: string,
  money: string,
  instanceConfig?: Record<string, string>,
): Promise<EasyPayRefundResponse> {
  const { pid, pkey, apiBase } = resolveEasyPayConfig(['pid', 'pkey', 'apiBase'], instanceConfig);

  const params = new URLSearchParams({
    pid,
    key: pkey,
    trade_no: tradeNo,
    out_trade_no: outTradeNo,
    money,
  });
  const response = await fetch(`${apiBase}/api.php?act=refund`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json()) as EasyPayRefundResponse;
  if (data.code !== 1) {
    throw new Error(`EasyPay refund failed: ${data.msg || 'unknown error'}`);
  }
  return data;
}
