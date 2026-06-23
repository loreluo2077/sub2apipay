import WxPay from 'wechatpay-node-v3';
import crypto from 'crypto';
import { getEnv } from '@/lib/config';
import type { WxpayPcOrderParams, WxpayH5OrderParams, WxpayRefundParams } from './types';

/** 自动补全 PEM 格式（公钥） */
function formatPublicKey(key: string): string {
  if (key.includes('-----BEGIN')) return key;
  return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
}

const BASE_URL = 'https://api.mch.weixin.qq.com';

type WxpayConfigField =
  | 'appId'
  | 'mchId'
  | 'privateKey'
  | 'apiV3Key'
  | 'publicKey'
  | 'publicKeyId'
  | 'certSerial';

interface ResolvedWxpayConfig {
  appId: string;
  mchId: string;
  privateKey: string;
  apiV3Key: string;
  publicKey?: string;
  publicKeyId?: string;
  certSerial?: string;
  notifyUrl?: string;
}

function assertWxpayEnv(env: ReturnType<typeof getEnv>) {
  if (!env.WXPAY_APP_ID || !env.WXPAY_MCH_ID || !env.WXPAY_PRIVATE_KEY || !env.WXPAY_API_V3_KEY) {
    throw new Error(
      'Wxpay environment variables (WXPAY_APP_ID, WXPAY_MCH_ID, WXPAY_PRIVATE_KEY, WXPAY_API_V3_KEY) are required',
    );
  }
  if (env.WXPAY_API_V3_KEY.length !== 32) {
    throw new Error(`WXPAY_API_V3_KEY must be exactly 32 bytes for AES-256-GCM, got ${env.WXPAY_API_V3_KEY.length}`);
  }
  return env as typeof env & {
    WXPAY_APP_ID: string;
    WXPAY_MCH_ID: string;
    WXPAY_PRIVATE_KEY: string;
    WXPAY_API_V3_KEY: string;
  };
}

function resolveWxpayConfig(
  requiredFields: WxpayConfigField[],
  instanceConfig?: Record<string, string>,
): ResolvedWxpayConfig {
  if (instanceConfig) {
    const missingFields = requiredFields.filter((field) => !instanceConfig[field]?.trim());
    if (missingFields.length > 0) {
      throw new Error(`Wxpay instance config missing required fields: ${missingFields.join(', ')}`);
    }
    const apiV3Key = instanceConfig.apiV3Key;
    if (apiV3Key.length !== 32) {
      throw new Error(`Wxpay instance config apiV3Key must be exactly 32 bytes, got ${apiV3Key.length}`);
    }
    return {
      appId: instanceConfig.appId,
      mchId: instanceConfig.mchId,
      privateKey: instanceConfig.privateKey,
      apiV3Key,
      publicKey: instanceConfig.publicKey,
      publicKeyId: instanceConfig.publicKeyId,
      certSerial: instanceConfig.certSerial,
      notifyUrl: instanceConfig.notifyUrl,
    };
  }

  const env = assertWxpayEnv(getEnv());
  return {
    appId: env.WXPAY_APP_ID,
    mchId: env.WXPAY_MCH_ID,
    privateKey: env.WXPAY_PRIVATE_KEY,
    apiV3Key: env.WXPAY_API_V3_KEY,
    publicKey: env.WXPAY_PUBLIC_KEY,
    publicKeyId: env.WXPAY_PUBLIC_KEY_ID,
    certSerial: env.WXPAY_CERT_SERIAL,
    notifyUrl: env.WXPAY_NOTIFY_URL,
  };
}

const payInstanceCache = new Map<string, WxPay>();

function getWxpayCacheKey(config: ResolvedWxpayConfig): string {
  return [
    config.appId,
    config.mchId,
    config.privateKey,
    config.apiV3Key,
    config.publicKey || '',
    config.certSerial || '',
  ].join('::');
}

function getPayInstance(instanceConfig?: Record<string, string>): WxPay {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], instanceConfig);
  const cacheKey = getWxpayCacheKey(config);
  const cached = payInstanceCache.get(cacheKey);
  if (cached) return cached;

  const privateKey = Buffer.from(config.privateKey);
  if (!config.publicKey) {
    throw new Error('WXPAY_PUBLIC_KEY is required');
  }
  const publicKey = Buffer.from(formatPublicKey(config.publicKey));

  const pay = new WxPay({
    appid: config.appId,
    mchid: config.mchId,
    publicKey,
    privateKey,
    key: config.apiV3Key,
    serial_no: config.certSerial,
  });
  payInstanceCache.set(cacheKey, pay);
  return pay;
}

function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}

async function request<T>(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  instanceConfig?: Record<string, string>,
): Promise<T> {
  const pay = getPayInstance(instanceConfig);
  const nonce_str = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = pay.getSignature(method, nonce_str, timestamp, url, body ? JSON.stringify(body) : '');
  const authorization = pay.getAuthorization(nonce_str, timestamp, signature);

  const headers: Record<string, string> = {
    Authorization: authorization,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'Sub2ApiPay/1.0',
  };

  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 204) return {} as T;

  const data = await res.json();
  if (!res.ok) {
    const code = (data as Record<string, string>).code || res.status;
    const message = (data as Record<string, string>).message || res.statusText;
    throw new Error(`Wxpay API error: [${code}] ${message}`);
  }

  return data as T;
}

/** PC 扫码支付（微信官方 API: /v3/pay/transactions/native） */
export async function createPcOrder(params: WxpayPcOrderParams): Promise<string> {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], params.instanceConfig);
  const result = await request<{ code_url: string }>('POST', '/v3/pay/transactions/native', {
    appid: config.appId,
    mchid: config.mchId,
    description: params.description,
    out_trade_no: params.out_trade_no,
    notify_url: params.notify_url,
    amount: { total: yuanToFen(params.amount), currency: 'CNY' },
  }, params.instanceConfig);
  return result.code_url;
}

export async function createH5Order(params: WxpayH5OrderParams): Promise<string> {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], params.instanceConfig);
  const result = await request<{ h5_url: string }>('POST', '/v3/pay/transactions/h5', {
    appid: config.appId,
    mchid: config.mchId,
    description: params.description,
    out_trade_no: params.out_trade_no,
    notify_url: params.notify_url,
    amount: { total: yuanToFen(params.amount), currency: 'CNY' },
    scene_info: {
      payer_client_ip: params.payer_client_ip,
      h5_info: { type: 'Wap' },
    },
  }, params.instanceConfig);
  return result.h5_url;
}

export async function queryOrder(outTradeNo: string, instanceConfig?: Record<string, string>): Promise<Record<string, unknown>> {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], instanceConfig);
  const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.mchId}`;
  return request<Record<string, unknown>>('GET', url, undefined, instanceConfig);
}

export async function closeOrder(outTradeNo: string, instanceConfig?: Record<string, string>): Promise<void> {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], instanceConfig);
  const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`;
  await request('POST', url, { mchid: config.mchId }, instanceConfig);
}

export async function createRefund(params: WxpayRefundParams): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('POST', '/v3/refund/domestic/refunds', {
    out_trade_no: params.out_trade_no,
    out_refund_no: params.out_refund_no,
    reason: params.reason,
    amount: {
      refund: yuanToFen(params.amount),
      total: yuanToFen(params.total),
      currency: 'CNY',
    },
  }, params.instanceConfig);
}

export function decipherNotify<T>(
  ciphertext: string,
  associatedData: string,
  nonce: string,
  instanceConfig?: Record<string, string>,
): T {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], instanceConfig);
  const key = config.apiV3Key;
  const ciphertextBuf = Buffer.from(ciphertext, 'base64');
  // AES-GCM 最后 16 字节是 AuthTag
  const authTag = ciphertextBuf.subarray(ciphertextBuf.length - 16);
  const data = ciphertextBuf.subarray(0, ciphertextBuf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData));
  const decoded = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decoded.toString('utf-8')) as T;
}

export async function verifyNotifySign(params: {
  timestamp: string;
  nonce: string;
  body: string;
  serial: string;
  signature: string;
}, instanceConfig?: Record<string, string>): Promise<boolean> {
  const config = resolveWxpayConfig(['appId', 'mchId', 'privateKey', 'apiV3Key'], instanceConfig);
  if (!config.publicKey) {
    throw new Error('WXPAY_PUBLIC_KEY is required for signature verification');
  }

  // 微信支付公钥模式：直接用公钥验签，不拉取平台证书
  const message = `${params.timestamp}\n${params.nonce}\n${params.body}\n`;
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(message);
  return verify.verify(formatPublicKey(config.publicKey), params.signature, 'base64');
}
