import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';

const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env');
const MOCK_DB_FILE = path.join(ROOT_DIR, 'mock-sub2api', 'data', 'db.json');

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

function encrypt(plaintext) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  const key = crypto.createHash('sha256').update(adminToken).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

async function fixDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const nextConfig = {
    appId: 'wx1234567890abcdef',
    mchId: '1900000109',
    privateKey: DEFAULT_WXPAY_PRIVATE_KEY,
    apiV3Key: '0123456789abcdef0123456789abcdef',
    publicKey: DEFAULT_WXPAY_PUBLIC_KEY,
    publicKeyId: 'PUB_KEY_ID_001',
    certSerial: 'SERIAL001',
    notifyUrl: 'http://localhost:3000/api/wxpay/notify',
    apiBase: 'http://localhost:3001',
  };

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const encrypted = encrypt(JSON.stringify(nextConfig));
    const result = await client.query(
      `
        update payment_provider_instances
        set config = $1, updated_at = now()
        where app_id = 'app_default' and provider_key = 'wxpay' and enabled = true
      `,
      [encrypted],
    );

    if (result.rowCount === 0) {
      throw new Error('No enabled default wxpay instance found in payment_provider_instances');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

function fixMockDbFile() {
  if (!fs.existsSync(MOCK_DB_FILE)) {
    throw new Error(`Mock db file not found: ${MOCK_DB_FILE}`);
  }

  const db = JSON.parse(fs.readFileSync(MOCK_DB_FILE, 'utf8'));
  if (!db.providerConfigs) db.providerConfigs = {};
  if (!db.providerConfigs.default) db.providerConfigs.default = {};

  db.providerConfigs.default.wxpay = {
    ...(db.providerConfigs.default.wxpay || {}),
    appId: 'wx1234567890abcdef',
    mchId: '1900000109',
    privateKey: DEFAULT_WXPAY_PRIVATE_KEY,
    apiV3Key: '0123456789abcdef0123456789abcdef',
    publicKey: DEFAULT_WXPAY_PUBLIC_KEY,
    publicKeyId: 'PUB_KEY_ID_001',
    certSerial: 'SERIAL001',
    notifyUrl: 'http://localhost:3000/api/wxpay/notify',
    apiBase: 'http://localhost:3001',
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(MOCK_DB_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

async function main() {
  loadEnv();
  await fixDatabase();
  fixMockDbFile();
  console.log('Fixed default wxpay mock credentials in database and mock-sub2api db.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
