import fs from 'node:fs';
import path from 'node:path';
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

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function upsertSystemConfig(key, value, group = 'general', label = null) {
  await client.query(
    `
      insert into system_configs (key, value, "group", label, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (key)
      do update set value = excluded.value, "group" = excluded."group", label = excluded.label, updated_at = now()
    `,
    [key, value, group, label],
  );
}

async function run() {
  await client.connect();

  await upsertSystemConfig('SUB2API_ADMIN_API_KEY', 'mock-sub2api-admin-key', 'integration', 'Mock Sub2API API Key');
  await upsertSystemConfig('ENABLED_PAYMENT_TYPES', 'alipay,wxpay', 'payment', 'Enabled payment types');
  await upsertSystemConfig('BALANCE_PAYMENT_DISABLED', 'false', 'payment', 'Disable balance payment');
  await upsertSystemConfig('MAX_PENDING_ORDERS', '3', 'payment', 'Max pending orders');
  await upsertSystemConfig('RECHARGE_MIN_AMOUNT', '1', 'payment', 'Min recharge amount');
  await upsertSystemConfig('RECHARGE_MAX_AMOUNT', '1000', 'payment', 'Max recharge amount');
  await upsertSystemConfig('DAILY_RECHARGE_LIMIT', '0', 'payment', 'Daily recharge limit');

  const channels = [
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

  for (const channel of channels) {
    await client.query(
      `
        insert into channels (id, group_id, name, platform, rate_multiplier, description, models, features, sort_order, enabled, created_at, updated_at)
        values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
        on conflict (group_id)
        do update set
          name = excluded.name,
          platform = excluded.platform,
          rate_multiplier = excluded.rate_multiplier,
          description = excluded.description,
          models = excluded.models,
          features = excluded.features,
          sort_order = excluded.sort_order,
          enabled = excluded.enabled,
          updated_at = now()
      `,
      [
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

  const plans = [
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

  for (const plan of plans) {
    const existing = await client.query(`select id from subscription_plans where group_id = $1 order by created_at asc limit 1`, [
      plan.groupId,
    ]);

    if (existing.rowCount && existing.rows[0]?.id) {
      await client.query(
        `
          update subscription_plans
          set
            name = $2,
            description = $3,
            price = $4,
            original_price = $5,
            validity_days = $6,
            validity_unit = $7,
            features = $8,
            product_name = $9,
            for_sale = $10,
            sort_order = $11,
            updated_at = now()
          where id = $1
        `,
        [
          existing.rows[0].id,
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
    } else {
      await client.query(
        `
          insert into subscription_plans (id, group_id, name, description, price, original_price, validity_days, validity_unit, features, product_name, for_sale, sort_order, created_at, updated_at)
          values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
        `,
        [
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

  console.log('Seeded real demo data into PostgreSQL.');
  await client.end();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
