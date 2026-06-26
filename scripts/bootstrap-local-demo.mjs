import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';

const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env');
const MOCK_DB_FILE = path.join(ROOT_DIR, 'mock-sub2api', 'data', 'db.json');

const DEFAULT_APP_CODE = 'default';
const DEFAULT_APP_NAME = 'Default App';
const DEFAULT_MAIN_APP_URL = 'http://localhost:3000';
const DEFAULT_MOCK_APP_URL = 'http://localhost:3001';

const DEFAULT_CHANNELS = [
  {
    groupId: 101,
    name: 'Claude Shared Pool',
    platform: 'claude',
    rateMultiplier: '0.1500',
    description: 'Claude 共享池，适合测试真实充值渠道展示。',
    models: JSON.stringify(['claude-sonnet-4', 'claude-opus-4']),
    features: JSON.stringify(['低倍率', '共享池', '支持 messages']),
    sortOrder: 1,
    enabled: true,
  },
  {
    groupId: 102,
    name: 'OpenAI Fast Pool',
    platform: 'openai',
    rateMultiplier: '0.2000',
    description: 'OpenAI 快速通道，用于演示多商品充值入口。',
    models: JSON.stringify(['gpt-4.1', 'gpt-4o-mini']),
    features: JSON.stringify(['多模型', '快速线路', '真实联调']),
    sortOrder: 2,
    enabled: true,
  },
];

const DEFAULT_PLANS = [
  {
    groupId: 201,
    name: 'Claude Monthly Pro',
    description: 'Claude 月付订阅套餐，适合演示订阅购买流程。',
    price: '29.90',
    originalPrice: '39.90',
    validityDays: 30,
    validityUnit: 'day',
    features: JSON.stringify(['30天有效', 'Claude Sonnet', '演示订阅']),
    productName: 'Claude Pro Monthly',
    forSale: true,
    sortOrder: 1,
  },
  {
    groupId: 202,
    name: 'OpenAI Quarterly Pro',
    description: 'OpenAI 季付订阅套餐，适合演示多商品订阅布局。',
    price: '99.00',
    originalPrice: '129.00',
    validityDays: 90,
    validityUnit: 'day',
    features: JSON.stringify(['90天有效', 'GPT-4.1', '更高额度']),
    productName: 'OpenAI Pro Quarterly',
    forSale: true,
    sortOrder: 2,
  },
];

const DEFAULT_ALIPAY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCsj3lSpHrKXiEf
/6kRjdw9XT5KTroEwH8RlOlKD+j7fXhecBD9IeSe8pzOnFUrqd+ENDy2z/ZN56A8
Ym2C3y6wxM1HzijGCs3Fz4Lm7eZ2DXt520eRX1W7monhEzWXmZqE+X/TWXxVZ2ca
eSzme0B8Va0ugDX4lxpGaUxZrWfreGIzZ0ldhkwNbtuqYDvU7AbAlNu0R40qcPXl
cqihjhivF4zBcU0wi7x50P3VrYYzGuE2AEvWj5wDnBuCXofTNWhGMhjWXWyN3l3D
oET7CZq141z8YimDdKCEVKF2uf6YZ1YcQ/X68Eghdght0EC93BZch10OhRn94aK7
09uJFDSVAgMBAAECggEAFAKkO0LjEVYGidckFCrK7BvEtim4dQYchh2qSuIa7pTv
cSYWNkBoqkzwhZ4H22MczhAfrURi58hRIsd4Mwmt+KYttuKvhD2q/IISiDR0ueJY
2/nja/Zt8u4aCI1pdM3FZx+mpMvW+PFfeaitHgITaYem6EJKX+wnyhv6VFjhOOMg
/ule4aSYsbSGYHs6+tL5ctaQNnd4kP3jMqqvibV/O/XJltTpPpvA8xjFnrXSJNME
tMB7EH+hCGv/xHQiXXZM2ivkxn5o6LrXvcq2ZMHaU9EF+92YihRt1Qme+hPz9Sea
bmrDOHN5tBWpwvizjV9aZwUgqI32yC2A+QToFTxUGQKBgQDujgMXZx9YCxqJajMb
dg10z5eG3hrv7Gng5T++p7oAN677TakOTCe+OiMv2nqCjHUpzOBTg2IpO75XZxwA
7FFG+WZwJkC6vn14/kWIlPBjArLFVzod9GdMf6e4ABJrFklzM03Agl4b7wfw31Y3
BfP79iC/EdeULHEr2tmRbjRQHQKBgQC5Lfs/QmN44zSHK4x/0xOuwc3xXwxiesFj
ntgEAoBUnO7lKAHPsj3cAz1wn3wMh9QGOaXGN/ypnDv6PYm6G9jpI5thmU8vB9F0
P75AwgR27hXPky7AcWsgwBXVNBhCxPRs3hd6FtW5LSvUasv6CQ7KNTxyDiO4uoyH
EFfjnNO82QKBgQCS1YCboBLP64269U5d4c0okDqRfhaQhTEqh5Ez9iNrzNp8vnGH
ZmK0GS7dXpo3zuKzBvMxFFaQUMC5JbM78jmY+RwPfcwr5eJvXftItXw9RUTqaOVR
2MTYdl6yyACOP5qYOQTrsJLimL+HiMCVf6mM9hNz6DSMdMp4Fu4CMRYsFQKBgDrL
ZqJHKd4QBXWFVi6fjfhGgGTKkNwTraM7o8piIOy8hv0rHqgbJ5jbTn6bpH82AROY
6hFtZUNU35YsQ7ZbcRtUutjaHFIKYW5PbtCQyWoZXcNyL73aRPE5C7WNvMY2UoTe
XwXcii8pMGlZHzpb9d4t2Os9ognc8RFRFxaljHTBAoGBALxSpkiEDhFqa6i2hfnT
0/KsJPiAlPA6pxTIkSyTtgAJNUjqKLFviDdM/KEZxPmMWB/7QJ+YsUs0f+aMwzFj
tbFm7tcao7Gavj3qKRv8Tun1leoyxdhimCgJZkif0HsCTlR47gp/bRj7MBPPXuRl
z0O3ltvvtN3iJ2xi/UWcsl1j
-----END PRIVATE KEY-----
`;

const DEFAULT_ALIPAY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArI95UqR6yl4hH/+pEY3c
PV0+Sk66BMB/EZTpSg/o+314XnAQ/SHknvKczpxVK6nfhDQ8ts/2TeegPGJtgt8u
sMTNR84oxgrNxc+C5u3mdg17edtHkV9Vu5qJ4RM1l5mahPl/01l8VWdnGnks5ntA
fFWtLoA1+JcaRmlMWa1n63hiM2dJXYZMDW7bqmA71OwGwJTbtEeNKnD15XKooY4Y
rxeMwXFNMIu8edD91a2GMxrhNgBL1o+cA5wbgl6H0zVoRjIY1l1sjd5dw6BE+wma
teNc/GIpg3SghFShdrn+mGdWHEP1+vBIIXYIbdBAvdwWXIddDoUZ/eGiu9PbiRQ0
lQIDAQAB
-----END PUBLIC KEY-----
`;

const DEFAULT_WXPAY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2Dx26bUKKxRW2
Q5TUhdV9+awym6aiDqp7fD0fm7+CV/jO5THm5KQi/VC5yoBS8PZbxqb/FBbpbwCp
Q31yYM6aygk6pF5ShIqj0MG3XRHJB6saKHm1oW5yHuRbbC1BuNAsfuCQjPpfsje2
Hn/BzofzebXtC2BbVDVFxdO/uhcPJO1bhrqfsblwl13PCTDvST/A6f9BTffSwiLK
I7iq/uRVYKh05+Y2SjuOfJnoogRREnddihcGI2lUx+yp52h7YFmbtYKg9ij/TIgn
qXaVcE+HfDmREuDCJKKm8TwQTmDwWjb4dnu7XbHIM8861gcjTZCgVCHN5G46cT33
vggjC8F1AgMBAAECggEAT3U7eVEUWLJ5rmnCfBrJOckNQa0zRcl22Jw5pSD5rW6t
tcbMR8SEaoz6fYwHA6wNKbMC0ZM4CLuco0NEbfYYVfBVpNV2ITedtq92zIt/JqkF
IU6HCCGjrYUUD16gRe3eVX0uj4goAjorHH4lLjXwmfAF2aY8cL/I3GHh7+zNAZtU
kyyhPXIoHSjohOjasblLTv+tHdsnjO3/hoHbRnRPCPu6I7qrNbmVxdNwxReX/BG+
8RtCudSXv7ZbR0HyYRAvaUt+UWGsjFvmAAV1ZzjhfwK6N/2+8raUjU75qlYoHj9i
6dntPt+aSFHT2wWaxWoTkIiydNRDoD+Xm+36XP7hBQKBgQDjmEHjf/Bb7ukSkpLf
GLgYAzgRCQLD8F91Psq/r/5JNsVW6IhMvGxyPsIsJjLiv+mJwcEjBYpHsKnoiG/x
BfZ4wqDXTLsvuLp1BgNGr0HP9w1GbtLnZrrkd2WWstfDvVlO4aUwGzl9UZcMk2X+
Z6sa43D3ym3uc/iXZvT3yT4sxwKBgQDMx/mOp4HONmRudydWqDbpNoD2pWk8UIeQ
8bcqXUmJN3svwfEKEuf3lrpA3Gm7x8sz12QRqYUKzDQvhjmZB8mfUeYtSSZzpnVF
IuzIImnQLcY6qmPtXB2KD6/08A8MWyGeKLpou6xe2gwNrNt20bKvyGUVgQ2nSRHA
pDqOvpaL4wKBgQC+TsJJiOFi/hLGBOnqwrCs44QuOmqljIlFcIv4XSEz9yhr02Sl
RakonnGemRJTqEWPewQUVL2b1I0+c1enImVF9PipDvA2pzDCSZTTthhB3UKscl7I
P45nG69Go6Tnd50F6IhIAXvA3kh/q4DNicH5adU8XXguu6pSbzTHPO9QYQKBgEuN
7LGJdAcVYnCvXcBHSBs7lNFrriwmuh3sUNw8lwkdg0HXmItS9msPHaEYsZoq2PpD
mhQ6K3AUb5ypNU8U5Hr3yKkkuB8rZ1Ee1aXxrIC2otC6VSwaNHvf1dfVSngQl5K3
DC/gLnTAlnnlMQPh0r+wfDs25ka2WupsrX5FK15pAoGBAN6JpEMdNd+5f6EpK1Kp
HfZDRfODGiljL2C5kG9VkClnTl9gnBJtiLhKE5iP9MBuuFBnOCFbHb8XLTEiHOLD
vZfHYDQCN5ForwydfyY23Mu8uhAK/hthCFF/zhGR9BDuSsLIdWiaL1E8yR4O42D6
fByoSK7Z76FZvIW7wSaYtO3q
-----END PRIVATE KEY-----
`;

const DEFAULT_WXPAY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtg8dum1CisUVtkOU1IXV
ffmsMpumog6qe3w9H5u/glf4zuUx5uSkIv1QucqAUvD2W8am/xQW6W8AqUN9cmDO
msoJOqReUoSKo9DBt10RyQerGih5taFuch7kW2wtQbjQLH7gkIz6X7I3th5/wc6H
83m17QtgW1Q1RcXTv7oXDyTtW4a6n7G5cJddzwkw70k/wOn/QU330sIiyiO4qv7k
VWCodOfmNko7jnyZ6KIEURJ3XYoXBiNpVMfsqedoe2BZm7WCoPYo/0yIJ6l2lXBP
h3w5kRLgwiSipvE8EE5g8Fo2+HZ7u12xyDPPOtYHI02QoFQhzeRuOnE9974IIwvB
dQIDAQAB
-----END PUBLIC KEY-----
`;

const DEFAULT_PROVIDER_INSTANCES = {
  easypay: {
    name: 'EasyPay',
    supportedTypes: 'wxpay,alipay',
    sortOrder: 0,
    refundEnabled: false,
    config: {
      pid: 'mock-pid',
      pkey: 'mock-pkey',
      apiBase: DEFAULT_MOCK_APP_URL,
      notifyUrl: `${DEFAULT_MAIN_APP_URL}/api/easy-pay/notify`,
      returnUrl: `${DEFAULT_MAIN_APP_URL}/pay/result`,
    },
  },
  alipay: {
    name: 'Mock Alipay Official',
    supportedTypes: 'alipay_direct',
    sortOrder: 0,
    refundEnabled: true,
    config: {
      appId: 'mock-alipay-app',
      privateKey: DEFAULT_ALIPAY_PRIVATE_KEY,
      publicKey: DEFAULT_ALIPAY_PUBLIC_KEY,
      notifyUrl: `${DEFAULT_MAIN_APP_URL}/api/alipay/notify`,
      gatewayBase: `${DEFAULT_MOCK_APP_URL}/mock-api/alipay/gateway.do`,
      sellerId: '2088100000000000',
    },
  },
  wxpay: {
    name: 'Mock Wxpay Official',
    supportedTypes: 'wxpay_direct',
    sortOrder: 1,
    refundEnabled: true,
    config: {
      appId: 'wx1234567890abcdef',
      mchId: '1900000109',
      privateKey: DEFAULT_WXPAY_PRIVATE_KEY,
      apiV3Key: '0123456789abcdef0123456789abcdef',
      publicKey: DEFAULT_WXPAY_PUBLIC_KEY,
      publicKeyId: 'PUB_KEY_ID_001',
      certSerial: 'SERIAL001',
      notifyUrl: `${DEFAULT_MAIN_APP_URL}/api/wxpay/notify`,
      apiBase: DEFAULT_MOCK_APP_URL,
    },
  },
  stripe: {
    name: 'Mock Stripe Hosted',
    supportedTypes: 'stripe',
    sortOrder: 2,
    refundEnabled: true,
    config: {
      secretKey: 'sk_test_mock_local',
      publishableKey: 'pk_test_mock_local',
      webhookSecret: 'whsec_mock_local',
      apiBase: DEFAULT_MOCK_APP_URL,
      checkoutMode: 'hosted',
    },
  },
};

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

function deriveKey() {
  return crypto.createHash('sha256').update(process.env.ADMIN_TOKEN || '').digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(ciphertext) {
  const [ivB64, tagB64, dataB64] = String(ciphertext || '').split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

function upsertSystemConfigSql() {
  return `
    insert into system_configs (key, value, "group", label, updated_at)
    values ($1, $2, $3, $4, now())
    on conflict (key) do nothing
  `;
}

function normalizePemBody(value) {
  return String(value || '')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function wrapPem(label, body) {
  const lines = body.match(/.{1,64}/g)?.join('\n') ?? body;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function isValidWxpayPrivateKey(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const candidates = trimmed.includes('-----BEGIN')
    ? [trimmed, wrapPem('PRIVATE KEY', normalizePemBody(trimmed)), wrapPem('RSA PRIVATE KEY', normalizePemBody(trimmed))]
    : [wrapPem('PRIVATE KEY', normalizePemBody(trimmed)), wrapPem('RSA PRIVATE KEY', normalizePemBody(trimmed))];

  for (const candidate of candidates) {
    try {
      crypto.createPrivateKey(candidate);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function ensureDefaultApp(client) {
  await client.query(
    `
      insert into apps (id, code, name, status, created_at, updated_at)
      values ('app_default', $1, $2, 'active', now(), now())
      on conflict (code)
      do update set name = excluded.name, status = excluded.status, updated_at = now()
    `,
    [DEFAULT_APP_CODE, DEFAULT_APP_NAME],
  );

  const result = await client.query(`select id from apps where code = $1 limit 1`, [DEFAULT_APP_CODE]);
  return result.rows[0].id;
}

async function ensureSystemConfigs(client) {
  const sql = upsertSystemConfigSql();
  const entries = [
    ['SUB2API_ADMIN_API_KEY', 'mock-sub2api-admin-key', 'integration', 'Mock Sub2API API Key'],
    ['ENABLED_PROVIDERS', 'easypay,alipay,wxpay,stripe', 'payment', 'Enabled providers'],
    ['ENABLED_PAYMENT_TYPES', 'alipay,wxpay,alipay_direct,wxpay_direct,stripe', 'payment', 'Enabled payment types'],
    ['BALANCE_PAYMENT_DISABLED', 'false', 'payment', 'Disable balance payment'],
    ['MAX_PENDING_ORDERS', '3', 'payment', 'Max pending orders'],
    ['RECHARGE_MIN_AMOUNT', '1', 'payment', 'Min recharge amount'],
    ['RECHARGE_MAX_AMOUNT', '1000', 'payment', 'Max recharge amount'],
    ['DAILY_RECHARGE_LIMIT', '0', 'payment', 'Daily recharge limit'],
  ];

  for (const [key, value, group, label] of entries) {
    await client.query(sql, [key, value, group, label]);
  }
}

async function ensureChannels(client, appId) {
  for (const channel of DEFAULT_CHANNELS) {
    await client.query(
      `
        insert into channels (id, app_id, group_id, name, platform, rate_multiplier, description, models, features, sort_order, enabled, created_at, updated_at)
        values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
        on conflict (group_id) do nothing
      `,
      [
        appId,
        channel.groupId,
        channel.name,
        channel.platform,
        channel.rateMultiplier,
        channel.description,
        channel.models,
        channel.features,
        channel.sortOrder,
        channel.enabled,
      ],
    );
  }
}

async function ensurePlans(client, appId) {
  for (const plan of DEFAULT_PLANS) {
    await client.query(
      `
        insert into subscription_plans (id, app_id, group_id, name, description, price, original_price, validity_days, validity_unit, features, product_name, for_sale, sort_order, created_at, updated_at)
        values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
        on conflict do nothing
      `,
      [
        appId,
        plan.groupId,
        plan.name,
        plan.description,
        plan.price,
        plan.originalPrice,
        plan.validityDays,
        plan.validityUnit,
        plan.features,
        plan.productName,
        plan.forSale,
        plan.sortOrder,
      ],
    );
  }
}

async function ensureProviderInstance(client, appId, providerKey, spec) {
  const existing = await client.query(
    `
      select id, name, config, supported_types, enabled, sort_order, refund_enabled
      from payment_provider_instances
      where app_id = $1 and provider_key = $2
      order by sort_order asc, created_at asc
      limit 1
    `,
    [appId, providerKey],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `
        insert into payment_provider_instances
          (id, app_id, provider_key, name, config, supported_types, enabled, sort_order, refund_enabled, created_at, updated_at)
        values
          (gen_random_uuid()::text, $1, $2, $3, $4, $5, true, $6, $7, now(), now())
      `,
      [appId, providerKey, spec.name, encrypt(JSON.stringify(spec.config)), spec.supportedTypes, spec.sortOrder, spec.refundEnabled],
    );
    return `created ${providerKey}`;
  }

  const row = existing.rows[0];
  let nextConfig = JSON.parse(decrypt(row.config));
  let shouldUpdate = false;

  if (providerKey === 'wxpay') {
    if (!isValidWxpayPrivateKey(nextConfig.privateKey)) {
      nextConfig = { ...nextConfig, ...spec.config };
      shouldUpdate = true;
    } else {
      for (const [key, value] of Object.entries(spec.config)) {
        if (!nextConfig[key]) {
          nextConfig[key] = value;
          shouldUpdate = true;
        }
      }
    }
  } else if (providerKey === 'stripe') {
    if (nextConfig.apiBase?.trim() === DEFAULT_MOCK_APP_URL && nextConfig.checkoutMode !== 'hosted') {
      nextConfig.checkoutMode = 'hosted';
      shouldUpdate = true;
    }
    for (const [key, value] of Object.entries(spec.config)) {
      if (!nextConfig[key]) {
        nextConfig[key] = value;
        shouldUpdate = true;
      }
    }
  } else if (providerKey === 'alipay') {
    for (const [key, value] of Object.entries(spec.config)) {
      if (!nextConfig[key]) {
        nextConfig[key] = value;
        shouldUpdate = true;
      }
    }
  } else if (providerKey === 'easypay') {
    for (const [key, value] of Object.entries(spec.config)) {
      if (!nextConfig[key]) {
        nextConfig[key] = value;
        shouldUpdate = true;
      }
    }
  }

  const metaChanged =
    row.name !== spec.name ||
    row.supported_types !== spec.supportedTypes ||
    row.enabled !== true ||
    row.sort_order !== spec.sortOrder ||
    row.refund_enabled !== spec.refundEnabled;

  if (!shouldUpdate && !metaChanged) {
    return `kept ${providerKey}`;
  }

  await client.query(
    `
      update payment_provider_instances
      set
        name = $2,
        config = $3,
        supported_types = $4,
        enabled = true,
        sort_order = $5,
        refund_enabled = $6,
        updated_at = now()
      where id = $1
    `,
    [row.id, spec.name, encrypt(JSON.stringify(nextConfig)), spec.supportedTypes, spec.sortOrder, spec.refundEnabled],
  );
  return `updated ${providerKey}`;
}

function ensureMockProviderConfigsFile() {
  if (!fs.existsSync(MOCK_DB_FILE)) return 'mock db missing, skipped file sync';

  const db = JSON.parse(fs.readFileSync(MOCK_DB_FILE, 'utf8'));
  if (!db.providerConfigs || typeof db.providerConfigs !== 'object') db.providerConfigs = {};
  if (!db.providerConfigs.default || typeof db.providerConfigs.default !== 'object') db.providerConfigs.default = {};

  db.providerConfigs.default.alipay = {
    ...(db.providerConfigs.default.alipay || {}),
    ...DEFAULT_PROVIDER_INSTANCES.alipay.config,
    updated_at: new Date().toISOString(),
  };
  db.providerConfigs.default.wxpay = {
    ...(db.providerConfigs.default.wxpay || {}),
    ...DEFAULT_PROVIDER_INSTANCES.wxpay.config,
    updated_at: new Date().toISOString(),
  };
  db.providerConfigs.default.stripe = {
    ...(db.providerConfigs.default.stripe || {}),
    ...DEFAULT_PROVIDER_INSTANCES.stripe.config,
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(MOCK_DB_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  return 'synced mock-sub2api default provider configs';
}

async function main() {
  loadEnv();
  assertEnv('DATABASE_URL');
  assertEnv('ADMIN_TOKEN');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const appId = await ensureDefaultApp(client);
    await ensureSystemConfigs(client);
    await ensureChannels(client, appId);
    await ensurePlans(client, appId);

    const providerResults = [];
    for (const [providerKey, spec] of Object.entries(DEFAULT_PROVIDER_INSTANCES)) {
      providerResults.push(await ensureProviderInstance(client, appId, providerKey, spec));
    }

    const fileResult = ensureMockProviderConfigsFile();

    console.log('Bootstrap local demo completed.');
    for (const item of providerResults) {
      console.log(`- ${item}`);
    }
    console.log(`- ${fileResult}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
