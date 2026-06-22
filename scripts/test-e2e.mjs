import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const LOG_DIR = path.join(ROOT_DIR, '.codex', 'logs');
const MOCK_LOG = path.join(LOG_DIR, 'e2e-mock-sub2api.log');
const APP_LOG = path.join(LOG_DIR, 'e2e-app.log');

const MAIN_APP_URL = 'http://localhost:3000';
const MOCK_APP_URL = 'http://localhost:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token-2026';
const USER_TOKEN = process.env.E2E_USER_TOKEN || 'mock-user-token';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnvFile(filePath) {
  const abs = path.resolve(ROOT_DIR, filePath);
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

loadEnvFile('.env');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(message) {
  console.log(`\n[${new Date().toISOString()}] ${message}`);
}

function createJsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function killPorts() {
  await execFileAsync('pnpm', ['kill:ports', '--', '3000', '3001'], {
    cwd: ROOT_DIR,
  }).catch(() => {});
}

async function runCommand(command, args, label) {
  logStep(label);
  await execFileAsync(command, args, {
    cwd: ROOT_DIR,
    env: process.env,
  });
}

function startService(command, args, logFile) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stream = fs.createWriteStream(logFile, { flags: 'w' });
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    stream.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stream.write(chunk);
  });

  return { child, stream };
}

async function stopService(service) {
  if (!service?.child || service.child.exitCode !== null) {
    service?.stream?.end();
    return;
  }

  service.child.kill('SIGTERM');

  const exited = await Promise.race([
    new Promise((resolve) => service.child.once('exit', () => resolve(true))),
    sleep(5000).then(() => false),
  ]);

  if (!exited) {
    service.child.kill('SIGKILL');
  }

  service.stream.end();
}

async function waitFor(checkFn, { timeoutMs = 120000, intervalMs = 1500, label = 'service' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await checkFn();
      if (result) return result;
    } catch {
      /* keep waiting */
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out while waiting for ${label}`);
}

async function waitForServices() {
  await waitFor(async () => {
    const res = await fetch(`${MOCK_APP_URL}/health`);
    return res.ok;
  }, { label: 'mock-sub2api health' });

  await waitFor(async () => {
    const res = await fetch(`${MAIN_APP_URL}/api/channels?token=${encodeURIComponent(USER_TOKEN)}`);
    return res.ok;
  }, { label: 'main app readiness' });
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function adminJson(pathname, options = {}) {
  const headers = {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    ...(options.headers || {}),
  };
  return httpJson(`${MAIN_APP_URL}${pathname}`, { ...options, headers });
}

function extractTradeNo(payUrl) {
  const url = new URL(payUrl);
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function pollOrder(orderId, accessToken, expectedStatus = 'COMPLETED') {
  return waitFor(async () => {
    const { response, data } = await httpJson(
      `${MAIN_APP_URL}/api/orders/${orderId}?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!response.ok) return null;
    if (data?.status === expectedStatus && data?.rechargeSuccess === true) {
      return data;
    }
    return null;
  }, { timeoutMs: 30000, intervalMs: 1000, label: `order ${orderId} completion` });
}

async function createApp(appCode, appName) {
  const { response, data } = await adminJson('/api/admin/apps', {
    method: 'POST',
    headers: createJsonHeaders(),
    body: JSON.stringify({
      code: appCode,
      name: appName,
    }),
  });

  assert(response.status === 201, `Create app failed: ${JSON.stringify(data)}`);
  return data.app;
}

async function createProviderInstance(appCode) {
  const { response, data } = await adminJson(`/api/admin/provider-instances?app_code=${encodeURIComponent(appCode)}`, {
    method: 'POST',
    headers: createJsonHeaders(),
    body: JSON.stringify({
      providerKey: 'easypay',
      name: `E2E EasyPay ${appCode}`,
      config: {
        pid: 'mock-pid',
        pkey: 'mock-pkey',
        apiBase: MOCK_APP_URL,
        notifyUrl: `${MAIN_APP_URL}/api/easy-pay/notify`,
        returnUrl: `${MAIN_APP_URL}/pay/result`,
      },
      supportedTypes: 'alipay,wxpay',
      enabled: true,
      sortOrder: 0,
      refundEnabled: true,
    }),
  });

  assert(response.status === 201, `Create provider instance failed: ${JSON.stringify(data)}`);
  return data;
}

async function createChannel(appCode) {
  const { response, data } = await adminJson(`/api/admin/channels?app_code=${encodeURIComponent(appCode)}`, {
    method: 'POST',
    headers: createJsonHeaders(),
    body: JSON.stringify({
      name: `E2E Channel ${appCode}`,
      platform: 'claude',
      rate_multiplier: 0.15,
      description: 'E2E top-up channel',
      sort_order: 1,
      enabled: true,
    }),
  });

  assert(response.status === 201, `Create channel failed: ${JSON.stringify(data)}`);
  return data;
}

async function createPlan(appCode) {
  const { response, data } = await adminJson(`/api/admin/subscription-plans?app_code=${encodeURIComponent(appCode)}`, {
    method: 'POST',
    headers: createJsonHeaders(),
    body: JSON.stringify({
      group_id: 201,
      name: `E2E Plan ${appCode}`,
      description: 'E2E subscription plan',
      price: 19.9,
      original_price: 29.9,
      validity_days: 30,
      validity_unit: 'day',
      features: ['E2E subscription', 'Auto fulfillment'],
      for_sale: true,
      sort_order: 1,
      product_name: `E2E Product ${appCode}`,
    }),
  });

  assert(response.status === 201, `Create subscription plan failed: ${JSON.stringify(data)}`);
  return data;
}

async function getScopedChannels(appCode) {
  const { response, data } = await httpJson(
    `${MAIN_APP_URL}/api/channels?token=${encodeURIComponent(USER_TOKEN)}&app_code=${encodeURIComponent(appCode)}`,
  );
  assert(response.ok, `Fetch scoped channels failed: ${JSON.stringify(data)}`);
  return data.channels ?? [];
}

async function getScopedPlans(appCode) {
  const { response, data } = await httpJson(
    `${MAIN_APP_URL}/api/subscription-plans?token=${encodeURIComponent(USER_TOKEN)}&app_code=${encodeURIComponent(appCode)}`,
  );
  assert(response.ok, `Fetch scoped plans failed: ${JSON.stringify(data)}`);
  return data.plans ?? [];
}

async function getMyOrders(appCode) {
  const { response, data } = await httpJson(
    `${MAIN_APP_URL}/api/orders/my?token=${encodeURIComponent(USER_TOKEN)}&app_code=${encodeURIComponent(appCode)}`,
  );
  assert(response.ok, `Fetch my orders failed: ${JSON.stringify(data)}`);
  return data;
}

async function getMySubscriptions(appCode) {
  const { response, data } = await httpJson(
    `${MAIN_APP_URL}/api/subscriptions/my?token=${encodeURIComponent(USER_TOKEN)}&app_code=${encodeURIComponent(appCode)}`,
  );
  assert(response.ok, `Fetch my subscriptions failed: ${JSON.stringify(data)}`);
  return data.subscriptions ?? [];
}

async function createOrder(payload) {
  const { response, data } = await httpJson(`${MAIN_APP_URL}/api/orders`, {
    method: 'POST',
    headers: createJsonHeaders(),
    body: JSON.stringify(payload),
  });
  assert(response.ok, `Create order failed: ${JSON.stringify(data)}`);
  return data;
}

async function confirmMockPayment(payUrl) {
  const tradeNo = extractTradeNo(payUrl);
  assert(tradeNo, `Unable to extract tradeNo from payUrl: ${payUrl}`);
  const res = await fetch(`${MOCK_APP_URL}/mock-pay/confirm?trade_no=${encodeURIComponent(tradeNo)}`);
  assert(res.ok, `Mock payment confirm failed with status ${res.status}`);
  return tradeNo;
}

async function runScenario() {
  const appSuffix = Date.now().toString(36);
  const appCode = `e2e_${appSuffix}`;
  const appName = `E2E App ${appSuffix}`;

  logStep('创建业务应用');
  const app = await createApp(appCode, appName);
  assert(app.code === appCode, 'App code mismatch after creation');

  logStep('为业务应用创建支付实例、渠道和订阅套餐');
  await createProviderInstance(appCode);
  const channel = await createChannel(appCode);
  const plan = await createPlan(appCode);

  logStep('校验前台作用域接口只返回当前 App 的配置');
  const scopedChannels = await getScopedChannels(appCode);
  const scopedPlans = await getScopedPlans(appCode);
  assert(scopedChannels.some((item) => item.name === channel.name), 'Scoped channels missing created channel');
  assert(scopedPlans.some((item) => item.id === plan.id), 'Scoped plans missing created plan');

  logStep('记录余额充值前的用户状态');
  const ordersBefore = await getMyOrders(appCode);
  const balanceBefore = Number(ordersBefore.user?.balance ?? 0);

  logStep('创建余额充值订单');
  const balanceOrder = await createOrder({
    app_code: appCode,
    token: USER_TOKEN,
    amount: 12.34,
    payment_type: 'alipay',
    is_mobile: false,
  });
  assert(balanceOrder.orderId, 'Balance order missing orderId');
  assert(balanceOrder.payUrl, 'Balance order missing payUrl');

  logStep('通过 mock 支付网关模拟支付成功');
  await confirmMockPayment(balanceOrder.payUrl);
  const paidBalanceOrder = await pollOrder(balanceOrder.orderId, balanceOrder.statusAccessToken);
  assert(paidBalanceOrder.status === 'COMPLETED', 'Balance order did not complete');

  logStep('验证余额到账和订单归属');
  const ordersAfter = await getMyOrders(appCode);
  const balanceAfter = Number(ordersAfter.user?.balance ?? 0);
  assert(balanceAfter >= balanceBefore + 12.34, `Balance did not increase as expected: before=${balanceBefore}, after=${balanceAfter}`);
  assert((ordersAfter.orders ?? []).some((item) => item.id === balanceOrder.orderId), 'Completed balance order not found in scoped order list');

  logStep('记录订阅购买前的订阅状态');
  const subscriptionsBefore = await getMySubscriptions(appCode);
  const targetBefore = subscriptionsBefore.find((item) => item.group_id === 201);
  const expiryBefore = targetBefore ? new Date(targetBefore.expires_at).getTime() : 0;

  logStep('创建订阅订单');
  const subscriptionOrder = await createOrder({
    app_code: appCode,
    token: USER_TOKEN,
    amount: 19.9,
    payment_type: 'alipay',
    is_mobile: false,
    order_type: 'subscription',
    plan_id: plan.id,
  });
  assert(subscriptionOrder.orderId, 'Subscription order missing orderId');
  assert(subscriptionOrder.payUrl, 'Subscription order missing payUrl');

  logStep('通过 mock 支付网关模拟订阅支付成功');
  await confirmMockPayment(subscriptionOrder.payUrl);
  const paidSubscriptionOrder = await pollOrder(subscriptionOrder.orderId, subscriptionOrder.statusAccessToken);
  assert(paidSubscriptionOrder.status === 'COMPLETED', 'Subscription order did not complete');

  logStep('验证订阅已开通或续期');
  const subscriptionsAfter = await getMySubscriptions(appCode);
  const targetAfter = subscriptionsAfter.find((item) => item.group_id === 201);
  assert(targetAfter, 'Subscription group 201 not found after purchase');
  const expiryAfter = new Date(targetAfter.expires_at).getTime();
  assert(expiryAfter > expiryBefore, `Subscription expiry did not move forward: before=${expiryBefore}, after=${expiryAfter}`);

  console.log('\nE2E summary:');
  console.log(`- app_code: ${appCode}`);
  console.log(`- balance order: ${balanceOrder.orderId}`);
  console.log(`- subscription order: ${subscriptionOrder.orderId}`);
  console.log(`- balance before/after: ${balanceBefore} -> ${balanceAfter}`);
  console.log(`- subscription expiry before/after: ${expiryBefore || 'none'} -> ${expiryAfter}`);
}

async function main() {
  let appService = null;
  let mockService = null;

  try {
    logStep('清理 3000/3001 端口');
    await killPorts();

    await runCommand('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], '执行数据库迁移');
    await runCommand('pnpm', ['seed:real-demo-data'], '初始化演示数据');

    logStep('启动 mock-sub2api');
    mockService = startService('pnpm', ['dev:mock-sub2api'], MOCK_LOG);

    logStep('启动主应用');
    appService = startService('pnpm', ['dev'], APP_LOG);

    logStep('等待服务就绪');
    await waitForServices();

    logStep('开始执行真实链路端到端测试');
    await runScenario();

    console.log('\nE2E test passed.');
  } catch (error) {
    console.error('\nE2E test failed.');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    console.error(`\nLogs:\n- ${MOCK_LOG}\n- ${APP_LOG}`);
    process.exitCode = 1;
  } finally {
    logStep('停止本地服务');
    await stopService(appService);
    await stopService(mockService);
  }
}

await main();
