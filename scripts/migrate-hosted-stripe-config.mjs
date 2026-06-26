import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';

function loadEnv(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return;
  const text = fs.readFileSync(abs, 'utf8');
  for (const line of text.split('\n')) {
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

loadEnv('.env');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (!process.env.ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN is required');
  process.exit(1);
}

function deriveKey() {
  return crypto.createHash('sha256').update(process.env.ADMIN_TOKEN).digest();
}

function decrypt(ciphertext) {
  const [ivB64, tagB64, dataB64] = String(ciphertext || '').split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  const { rows } = await client.query(`
    select id, name, config
    from payment_provider_instances
    where provider_key = 'stripe'
  `);

  let updated = 0;
  for (const row of rows) {
    const config = JSON.parse(decrypt(row.config));
    const looksHosted = typeof config.apiBase === 'string' && config.apiBase.trim() && !config.checkoutMode;
    if (!looksHosted) continue;
    config.checkoutMode = 'hosted';
    await client.query(
      `update payment_provider_instances set config = $2, updated_at = now() where id = $1`,
      [row.id, encrypt(JSON.stringify(config))],
    );
    updated += 1;
    console.log(`updated stripe instance ${row.name} (${row.id})`);
  }

  console.log(`done, updated ${updated} stripe instance(s)`);
  await client.end();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
