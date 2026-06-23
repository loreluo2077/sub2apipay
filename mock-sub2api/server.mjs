import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const PORT = Number(process.env.MOCK_SUB2API_PORT || 3001);
const API_KEY = process.env.MOCK_SUB2API_ADMIN_API_KEY || 'mock-sub2api-admin-key';
const APP_URL = process.env.MOCK_SUB2API_APP_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.resolve(process.cwd(), 'mock-sub2api', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const MAIN_APP_URL = process.env.MOCK_SUB2API_MAIN_APP_URL || 'http://localhost:3000';
const DEFAULT_APP_CODE = 'default';
const DEFAULT_APP_NAME = 'Default App';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formValue(body, key, fallback = '') {
  const value = body[key];
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function nextUserId(db) {
  const maxId = db.users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 1000);
  return maxId + 1;
}

function makeToken(username) {
  const slug = String(username || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `mock-${slug || 'user'}-${crypto.randomBytes(3).toString('hex')}`;
}

function paymentStatusLabel(status) {
  if (status === 1) return 'paid';
  if (status === -1) return 'refunded';
  if (status === -2) return 'failed';
  if (status === -3) return 'cancelled';
  if (status === -4) return 'expired';
  return 'pending';
}

function makeAppCode(name, fallback = 'app') {
  const base = String(name || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return base || fallback;
}

function ensureAppShape(db) {
  if (!Array.isArray(db.apps)) {
    db.apps = [
      {
        code: DEFAULT_APP_CODE,
        name: DEFAULT_APP_NAME,
        status: 'active',
        notes: 'Default business app',
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ];
  }

  if (!db.apps.some((app) => app.code === DEFAULT_APP_CODE)) {
    db.apps.unshift({
      code: DEFAULT_APP_CODE,
      name: DEFAULT_APP_NAME,
      status: 'active',
      notes: 'Default business app',
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  for (const session of db.paymentSessions || []) {
    if (!session.app_code) {
      const returnUrl = String(session.return_url || '');
      try {
        const url = new URL(returnUrl);
        session.app_code = url.searchParams.get('app_code') || DEFAULT_APP_CODE;
      } catch {
        session.app_code = DEFAULT_APP_CODE;
      }
    }
  }

  if (!db.nextIds) db.nextIds = {};
  if (!db.nextIds.app) db.nextIds.app = db.apps.length + 1;
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const now = new Date().toISOString();
    const initial = {
      users: [
        {
          id: 1001,
          username: 'demo-user',
          email: 'demo-user@example.com',
          status: 'active',
          balance: 128.5,
          notes: 'Primary demo account',
          role: 'user',
          token: 'mock-user-token',
        },
        {
          id: 9001,
          username: 'mock-admin',
          email: 'admin@example.com',
          status: 'active',
          balance: 0,
          notes: 'Mock admin account',
          role: 'admin',
          token: 'mock-admin-token',
        },
      ],
      apps: [
        {
          code: DEFAULT_APP_CODE,
          name: DEFAULT_APP_NAME,
          status: 'active',
          notes: 'Default business app',
          created_at: now,
          updated_at: now,
        },
      ],
      groups: [
        {
          id: 101,
          name: 'Claude Shared Pool',
          description: 'Claude models via shared pool',
          platform: 'claude',
          status: 'active',
          rate_multiplier: 0.15,
          subscription_type: 'standard',
          daily_limit_usd: null,
          weekly_limit_usd: null,
          monthly_limit_usd: null,
          default_validity_days: 30,
          sort_order: 1,
          supported_model_scopes: ['claude-sonnet-4', 'claude-opus-4'],
          allow_messages_dispatch: true,
          default_mapped_model: 'claude-sonnet-4',
        },
        {
          id: 102,
          name: 'OpenAI Fast Pool',
          description: 'OpenAI shared route for top-up',
          platform: 'openai',
          status: 'active',
          rate_multiplier: 0.2,
          subscription_type: 'standard',
          daily_limit_usd: null,
          weekly_limit_usd: null,
          monthly_limit_usd: null,
          default_validity_days: 30,
          sort_order: 2,
          supported_model_scopes: ['gpt-4.1', 'gpt-4o-mini'],
          allow_messages_dispatch: true,
          default_mapped_model: 'gpt-4.1',
        },
        {
          id: 201,
          name: 'Claude Monthly Pro',
          description: 'Claude subscription plan group',
          platform: 'claude',
          status: 'active',
          rate_multiplier: 0.12,
          subscription_type: 'subscription',
          daily_limit_usd: 20,
          weekly_limit_usd: null,
          monthly_limit_usd: 300,
          default_validity_days: 30,
          sort_order: 3,
          supported_model_scopes: ['claude-sonnet-4'],
          allow_messages_dispatch: false,
          default_mapped_model: 'claude-sonnet-4',
        },
        {
          id: 202,
          name: 'OpenAI Quarterly Pro',
          description: 'OpenAI subscription plan group',
          platform: 'openai',
          status: 'active',
          rate_multiplier: 0.08,
          subscription_type: 'subscription',
          daily_limit_usd: 50,
          weekly_limit_usd: 200,
          monthly_limit_usd: 1200,
          default_validity_days: 90,
          sort_order: 4,
          supported_model_scopes: ['gpt-4.1'],
          allow_messages_dispatch: true,
          default_mapped_model: 'gpt-4.1',
        },
      ],
      subscriptions: [
        {
          id: 1,
          user_id: 1001,
          group_id: 201,
          starts_at: now,
          expires_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          daily_usage_usd: 3.2,
          weekly_usage_usd: 17.6,
          monthly_usage_usd: 58.4,
          daily_window_start: now,
          weekly_window_start: now,
          monthly_window_start: now,
          assigned_by: 9001,
          assigned_at: now,
          notes: 'Seed subscription',
          created_at: now,
          updated_at: now,
        },
      ],
      redeemCodes: [],
      balanceLogs: [],
      paymentSessions: [],
      nextIds: {
        app: 2,
        redeemCode: 1,
        subscription: 2,
        paymentSession: 1,
      },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}

function readDb() {
  ensureDataFile();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  ensureAppShape(db);
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
  });
  res.end(html);
}

function notFound(res) {
  sendJson(res, 404, { code: 404, message: 'Not found' });
}

function unauthorized(res) {
  sendJson(res, 401, { code: 401, message: 'Unauthorized' });
}

function badRequest(res, message) {
  sendJson(res, 400, { code: 400, message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(raw));
          return;
        }
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(raw);
          resolve(Object.fromEntries(params.entries()));
          return;
        }
        resolve({ raw });
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function getCurrentUser(req, db) {
  const token = getBearerToken(req);
  if (!token) return null;
  return db.users.find((user) => user.token === token) || null;
}

function requireAdminApiKey(req) {
  return req.headers['x-api-key'] === API_KEY;
}

function pickUserPublic(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    balance: user.balance,
    notes: user.notes,
    role: user.role,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function createPaymentSession(db, body) {
  const id = db.nextIds.paymentSession++;
  const tradeNo = `MOCKPAY${String(id).padStart(6, '0')}`;
  const outTradeNo = body.out_trade_no;
  const amount = body.money;
  const type = body.type;
  let appCode = body.app_code || DEFAULT_APP_CODE;
  const returnUrl = String(body.return_url || '');
  if (!body.app_code && returnUrl) {
    try {
      const parsed = new URL(returnUrl);
      appCode = parsed.searchParams.get('app_code') || appCode;
    } catch {
      /* ignore */
    }
  }
  const session = {
    id,
    trade_no: tradeNo,
    out_trade_no: outTradeNo,
    money: String(amount),
    type,
    provider: body.provider || 'easypay',
    pid: body.pid || 'mock-pid',
    notify_url: body.notify_url || '',
    return_url: body.return_url || '',
    name: body.name || 'Mock Payment',
    app_code: appCode,
    status: 0,
    created_at: nowIso(),
  };
  db.paymentSessions.push(session);
  return session;
}

function getActiveAppCode(url, db) {
  const code = (url.searchParams.get('app_code') || '').trim();
  if (code && db.apps.some((app) => app.code === code)) {
    return code;
  }
  return DEFAULT_APP_CODE;
}

function getAppByCode(db, appCode) {
  return db.apps.find((app) => app.code === appCode) || db.apps[0];
}

function withAppCode(pathname, appCode) {
  const url = new URL(pathname, APP_URL);
  if (appCode) url.searchParams.set('app_code', appCode);
  return `${url.pathname}${url.search}`;
}

function buildMainPayUrl(token, appCode) {
  const url = new URL('/pay', MAIN_APP_URL);
  url.searchParams.set('token', token);
  if (appCode) url.searchParams.set('app_code', appCode);
  return url.toString();
}

function buildMainOrdersUrl(token, appCode) {
  const url = new URL('/pay/orders', MAIN_APP_URL);
  url.searchParams.set('token', token);
  if (appCode) url.searchParams.set('app_code', appCode);
  return url.toString();
}

function buildMainAdminUrl(appCode) {
  const url = new URL('/admin', MAIN_APP_URL);
  url.searchParams.set('token', 'dev-admin-token-2026');
  if (appCode) url.searchParams.set('app_code', appCode);
  return url.toString();
}

function generateSign(params, pkey) {
  const queryString = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '' && value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return crypto.createHash('md5').update(queryString + pkey).digest('hex');
}

async function sendEasyPayNotify(session) {
  if (!session.notify_url) return;

  const url = new URL(session.notify_url);
  const params = {
    pid: session.pid,
    trade_no: session.trade_no,
    out_trade_no: session.out_trade_no,
    type: session.type,
    name: session.name,
    money: session.money,
    trade_status: session.status === 1 ? 'TRADE_SUCCESS' : 'TRADE_CLOSED',
    endtime: session.updated_at || nowIso(),
  };
  const sign = generateSign(params, process.env.EASY_PAY_PKEY || 'mock-pkey');

  for (const [key, value] of Object.entries({ ...params, sign, sign_type: 'MD5' })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Notify failed with status ${response.status}`);
  }
}

async function trySendEasyPayNotify(session) {
  try {
    await sendEasyPayNotify(session);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('mock-sub2api notify failed:', message);
    return `Notify failed: ${message}`;
  }
}

async function applyPaymentAction(db, tradeNo, action, options = {}) {
  const session = db.paymentSessions.find((item) => item.trade_no === tradeNo);
  if (!session) return { ok: false, status: 404, message: 'Payment session not found' };

  const shouldNotify = options.notify !== false;
  session.updated_at = nowIso();

  if (action === 'success') {
    session.status = 1;
    writeDb(db);
    const notifyError = shouldNotify ? await trySendEasyPayNotify(session) : null;
    return { ok: true, message: notifyError || 'Payment marked as successful' };
  }

  if (action === 'fail') {
    session.status = -2;
    writeDb(db);
    const notifyError = shouldNotify ? await trySendEasyPayNotify(session) : null;
    return { ok: true, message: notifyError || 'Payment marked as failed' };
  }

  if (action === 'cancel') {
    session.status = -3;
    writeDb(db);
    return { ok: true, message: 'Payment marked as cancelled' };
  }

  if (action === 'expire') {
    session.status = -4;
    writeDb(db);
    return { ok: true, message: 'Payment marked as expired' };
  }

  if (action === 'refund') {
    session.status = -1;
    writeDb(db);
    return { ok: true, message: 'Payment marked as refunded' };
  }

  if (action === 'notify') {
    writeDb(db);
    const notifyError = await trySendEasyPayNotify(session);
    return { ok: true, message: notifyError || 'Notification sent' };
  }

  return { ok: false, status: 400, message: `Unknown payment action: ${action}` };
}

function renderLayout(title, body, options = {}) {
  const appCode = options.appCode || DEFAULT_APP_CODE;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --bg:#f4f7fb; --panel:#ffffff; --line:#d8dde5; --text:#19202a; --muted:#687386; --brand:#155eef; --good:#138a45; --bad:#c2410c; --warn:#a16207; --sidebar:#0f172a; --sidebar-text:#cbd5e1; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color:var(--brand); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .app-shell { display:grid; grid-template-columns:260px minmax(0, 1fr); min-height:100vh; }
    .sidebar { background:var(--sidebar); color:var(--sidebar-text); padding:24px 18px; }
    .sidebar h1 { margin:0; font-size:18px; color:#fff; }
    .sidebar .sub { color:#94a3b8; margin-top:6px; font-size:13px; }
    .sidebar .stack { display:grid; gap:12px; margin-top:24px; }
    .sidebar .navlink { display:flex; align-items:center; gap:10px; border:1px solid rgba(148,163,184,.16); border-radius:10px; padding:10px 12px; color:#e2e8f0; background:rgba(148,163,184,.05); text-decoration:none; }
    .sidebar .navlink:hover { background:rgba(148,163,184,.1); text-decoration:none; }
    .sidebar .meta { margin-top:18px; padding:12px; border-radius:12px; background:rgba(15,23,42,.55); border:1px solid rgba(148,163,184,.14); }
    .content { padding:24px; }
    .shell { max-width:1280px; margin:0 auto; }
    header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; }
    h1 { margin:0; font-size:24px; letter-spacing:0; }
    h2 { margin:0 0 12px; font-size:16px; letter-spacing:0; }
    .sub { color:var(--muted); margin-top:4px; }
    .nav { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:16px; }
    .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); }
    .metrics { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:16px; }
    .metric { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:16px; }
    .metric .label { color:var(--muted); font-size:12px; }
    .metric .value { margin-top:10px; font-size:28px; font-weight:700; color:#0f172a; }
    .metric .hint { margin-top:4px; color:var(--muted); font-size:12px; }
    table { width:100%; border-collapse:collapse; }
    th, td { border-bottom:1px solid var(--line); padding:10px 8px; text-align:left; vertical-align:top; }
    th { color:var(--muted); font-weight:600; font-size:12px; }
    code { background:#edf1f7; padding:2px 5px; border-radius:5px; }
    input, select { width:100%; min-height:36px; border:1px solid var(--line); border-radius:6px; padding:7px 9px; background:#fff; color:var(--text); }
    label { display:block; margin-bottom:10px; color:var(--muted); font-size:12px; font-weight:600; }
    label span { display:block; margin-bottom:4px; }
    button, .button { display:inline-flex; align-items:center; justify-content:center; min-height:34px; border:1px solid var(--line); border-radius:6px; padding:7px 10px; background:#fff; color:var(--text); cursor:pointer; font-weight:600; text-decoration:none; }
    button:hover, .button:hover { background:#f1f4f8; text-decoration:none; }
    .primary { background:var(--brand); border-color:var(--brand); color:#fff; }
    .primary:hover { background:#0f49c8; }
    .danger { color:var(--bad); border-color:#f4c7b0; }
    .success { color:var(--good); border-color:#b7e4c8; }
    .warn { color:var(--warn); border-color:#ead99d; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; }
    .tag { display:inline-flex; border:1px solid var(--line); border-radius:999px; padding:2px 8px; font-size:12px; background:#fff; color:var(--muted); }
    .tag.good { color:var(--good); border-color:#b7e4c8; }
    .tag.bad { color:var(--bad); border-color:#f4c7b0; }
    .tag.warn { color:var(--warn); border-color:#ead99d; }
    .muted { color:var(--muted); }
    .row { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .app-switch { width:100%; min-height:40px; border-radius:10px; border:1px solid rgba(148,163,184,.22); background:#0b1220; color:#fff; padding:8px 10px; }
    @media (max-width:960px) { .app-shell { grid-template-columns:1fr; } .sidebar { padding:18px; } .content { padding:18px; } }
    @media (max-width:720px) { .shell { padding:0; } header { display:block; } .nav { margin-top:12px; } .row { grid-template-columns:1fr; } table { font-size:12px; } th, td { padding:8px 6px; } }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <h1>Mock Dashboard</h1>
      <div class="sub">Sub2API + payment gateway lab</div>
      <div class="stack">
        <a class="navlink" href="${escapeHtml(withAppCode('/mock-console', appCode))}">控制台总览</a>
        <a class="navlink" href="${escapeHtml(withAppCode('/mock-console#payments', appCode))}">支付会话</a>
        <a class="navlink" href="${escapeHtml(withAppCode('/mock-console#users', appCode))}">用户与订阅</a>
        <a class="navlink" href="${escapeHtml(withAppCode('/health', appCode))}" target="_blank">健康检查</a>
      </div>
      <div class="meta">
        <div><strong>当前 App</strong></div>
        <div class="sub">${escapeHtml(appCode)}</div>
      </div>
    </aside>
    <main class="content">
      <div class="shell">
        <header>
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="sub">Local Sub2API and payment gateway console</div>
          </div>
          <nav class="nav">
            <a class="button" href="${escapeHtml(buildMainPayUrl('mock-user-token', appCode))}" target="_blank">Open Pay</a>
            <a class="button" href="${escapeHtml(buildMainAdminUrl(appCode))}" target="_blank">Open Admin</a>
          </nav>
        </header>
        ${body}
      </div>
    </main>
  </div>
</body>
</html>`;
}

function renderUserRows(db, appCode) {
  return db.users
    .map((user) => {
      const payUrl = buildMainPayUrl(user.token, appCode);
      return `<tr>
        <td><strong>${escapeHtml(user.username)}</strong><div class="muted">#${escapeHtml(user.id)} · ${escapeHtml(user.role)}</div></td>
        <td>${escapeHtml(user.email)}<div class="muted">${escapeHtml(user.notes || '')}</div></td>
        <td>¥${Number(user.balance || 0).toFixed(2)}</td>
        <td><code>${escapeHtml(user.token)}</code></td>
        <td class="actions">
          <a class="button" href="${payUrl}" target="_blank">Pay Page</a>
          <a class="button" href="${escapeHtml(buildMainOrdersUrl(user.token, appCode))}" target="_blank">Orders</a>
        </td>
      </tr>`;
    })
    .join('');
}

function renderGroupRows(db) {
  return db.groups
    .map((group) => `<tr>
      <td><strong>${escapeHtml(group.name)}</strong><div class="muted">#${escapeHtml(group.id)} · ${escapeHtml(group.platform)}</div></td>
      <td><span class="tag">${escapeHtml(group.subscription_type)}</span></td>
      <td>${escapeHtml(group.status)}</td>
      <td>${escapeHtml(group.rate_multiplier)}</td>
      <td>${escapeHtml(group.daily_limit_usd ?? '-')} / ${escapeHtml(group.weekly_limit_usd ?? '-')} / ${escapeHtml(group.monthly_limit_usd ?? '-')}</td>
    </tr>`)
    .join('');
}

function renderSubscriptionRows(db, appCode) {
  return db.subscriptions
    .map((sub) => {
      const user = db.users.find((item) => item.id === sub.user_id);
      const group = db.groups.find((item) => item.id === sub.group_id);
      return `<tr>
        <td>${escapeHtml(user?.username || sub.user_id)}</td>
        <td>${escapeHtml(group?.name || sub.group_id)}</td>
        <td><span class="tag good">${escapeHtml(sub.status)}</span></td>
        <td>${escapeHtml(sub.expires_at)}</td>
        <td class="actions">
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/subscriptions/${escapeHtml(sub.id)}/extend`, appCode))}">
            <input type="hidden" name="days" value="30" />
            <button type="submit">+30 days</button>
          </form>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/subscriptions/${escapeHtml(sub.id)}/extend`, appCode))}">
            <input type="hidden" name="days" value="-30" />
            <button type="submit">-30 days</button>
          </form>
        </td>
      </tr>`;
    })
    .join('');
}

function renderPaymentRows(db, appCode) {
  return db.paymentSessions
    .slice()
    .reverse()
    .filter((session) => (session.app_code || DEFAULT_APP_CODE) === appCode)
    .map((session) => {
      const status = paymentStatusLabel(session.status);
      const statusClass = status === 'paid' ? 'good' : status === 'pending' ? 'warn' : 'bad';
      return `<tr>
        <td><strong>${escapeHtml(session.trade_no)}</strong><div class="muted">${escapeHtml(session.out_trade_no)}</div></td>
        <td>${escapeHtml(session.provider || 'easypay')} / ${escapeHtml(session.type)}<div class="muted">${escapeHtml(session.app_code || DEFAULT_APP_CODE)}</div></td>
        <td>¥${escapeHtml(session.money)}</td>
        <td><span class="tag ${statusClass}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(session.created_at)}<div class="muted">${escapeHtml(session.updated_at || '')}</div></td>
        <td class="actions">
          <a class="button" href="/mock-pay/${encodeURIComponent(session.trade_no)}" target="_blank">Pay Page</a>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/payments/${encodeURIComponent(session.trade_no)}/success`, appCode))}"><button class="success" type="submit">Success</button></form>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/payments/${encodeURIComponent(session.trade_no)}/fail`, appCode))}"><button class="danger" type="submit">Fail</button></form>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/payments/${encodeURIComponent(session.trade_no)}/cancel`, appCode))}"><button type="submit">Cancel</button></form>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/payments/${encodeURIComponent(session.trade_no)}/expire`, appCode))}"><button type="submit">Expire</button></form>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/payments/${encodeURIComponent(session.trade_no)}/refund`, appCode))}"><button type="submit">Refund</button></form>
          <form method="post" action="${escapeHtml(withAppCode(`/mock-console/payments/${encodeURIComponent(session.trade_no)}/notify`, appCode))}"><button class="warn" type="submit">Notify</button></form>
        </td>
      </tr>`;
    })
    .join('');
}

function renderConsolePage(db, appCode, notice = '') {
  const currentApp = getAppByCode(db, appCode);
  const userOptions = db.users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.username)} (#${escapeHtml(user.id)})</option>`).join('');
  const groupOptions = db.groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} (#${escapeHtml(group.id)})</option>`).join('');
  const appOptions = db.apps
    .map((app) => `<option value="${escapeHtml(app.code)}" ${app.code === appCode ? 'selected' : ''}>${escapeHtml(app.name)} (${escapeHtml(app.code)})</option>`)
    .join('');
  const scopedPayments = db.paymentSessions.filter((session) => (session.app_code || DEFAULT_APP_CODE) === appCode);
  const pendingCount = scopedPayments.filter((session) => paymentStatusLabel(session.status) === 'pending').length;
  const paidCount = scopedPayments.filter((session) => paymentStatusLabel(session.status) === 'paid').length;
  const body = `
    ${notice ? `<div class="panel"><strong>${escapeHtml(notice)}</strong></div>` : ''}
    <section class="panel">
      <div class="row">
        <label>
          <span>Current App</span>
          <select class="app-switch" onchange="if(this.value){ window.location.href='${escapeHtml('/mock-console?app_code=')}' + encodeURIComponent(this.value); }">
            ${appOptions}
          </select>
        </label>
        <label>
          <span>Open Main App</span>
          <div class="actions">
            <a class="button primary" href="${escapeHtml(buildMainPayUrl('mock-user-token', appCode))}" target="_blank">Open Pay Page</a>
            <a class="button" href="${escapeHtml(buildMainAdminUrl(appCode))}" target="_blank">Open Admin</a>
          </div>
        </label>
      </div>
      <div class="muted">Current app: <strong>${escapeHtml(currentApp?.name || DEFAULT_APP_NAME)}</strong> · code: <code>${escapeHtml(appCode)}</code></div>
    </section>
    <section class="metrics">
      <div class="metric"><div class="label">Users</div><div class="value">${db.users.length}</div><div class="hint">Shared test users</div></div>
      <div class="metric"><div class="label">Payments (${escapeHtml(appCode)})</div><div class="value">${scopedPayments.length}</div><div class="hint">${paidCount} paid / ${pendingCount} pending</div></div>
      <div class="metric"><div class="label">Subscriptions</div><div class="value">${db.subscriptions.length}</div><div class="hint">Cross-app mock subscriptions</div></div>
      <div class="metric"><div class="label">Groups</div><div class="value">${db.groups.length}</div><div class="hint">Shared product groups</div></div>
    </section>
    <div class="grid">
      <section class="panel">
        <h2>Create User</h2>
        <form method="post" action="${escapeHtml(withAppCode('/mock-console/users', appCode))}">
          <div class="row">
            <label><span>Username</span><input name="username" value="test-user" required /></label>
            <label><span>Email</span><input name="email" value="test-user@example.com" required /></label>
          </div>
          <div class="row">
            <label><span>Balance</span><input name="balance" type="number" step="0.01" value="100" /></label>
            <label><span>Role</span><select name="role"><option value="user">user</option><option value="admin">admin</option></select></label>
          </div>
          <label><span>Notes</span><input name="notes" value="Created from mock console" /></label>
          <button class="primary" type="submit">Create User</button>
        </form>
      </section>
      <section class="panel">
        <h2>Create App</h2>
        <form method="post" action="/mock-console/apps">
          <div class="row">
            <label><span>App Name</span><input name="name" value="Demo Shop" required /></label>
            <label><span>App Code</span><input name="code" value="${escapeHtml(makeAppCode('demo-shop'))}" /></label>
          </div>
          <label><span>Notes</span><input name="notes" value="Created from dashboard" /></label>
          <button class="primary" type="submit">Create App</button>
        </form>
      </section>
      <section class="panel">
        <h2>Assign Subscription</h2>
        <form method="post" action="${escapeHtml(withAppCode('/mock-console/subscriptions', appCode))}">
          <div class="row">
            <label><span>User</span><select name="user_id">${userOptions}</select></label>
            <label><span>Group</span><select name="group_id">${groupOptions}</select></label>
          </div>
          <div class="row">
            <label><span>Days</span><input name="validity_days" type="number" value="30" /></label>
            <label><span>Notes</span><input name="notes" value="Manual assignment" /></label>
          </div>
          <button class="primary" type="submit">Assign</button>
        </form>
      </section>
    </div>
    <section class="panel" id="users">
      <h2>Users</h2>
      <table><thead><tr><th>User</th><th>Email</th><th>Balance</th><th>Token</th><th>Actions</th></tr></thead><tbody>${renderUserRows(db, appCode)}</tbody></table>
    </section>
    <section class="panel" id="payments">
      <h2>Payment Sessions</h2>
      <table><thead><tr><th>Trade</th><th>Provider</th><th>Amount</th><th>Status</th><th>Time</th><th>Actions</th></tr></thead><tbody>${renderPaymentRows(db, appCode) || '<tr><td colspan="6" class="muted">No payment sessions yet for this app.</td></tr>'}</tbody></table>
    </section>
    <section class="panel">
      <h2>Apps</h2>
      <table><thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Created</th></tr></thead><tbody>${db.apps.map((app) => `<tr><td><strong>${escapeHtml(app.name)}</strong><div class="muted">${escapeHtml(app.notes || '')}</div></td><td><code>${escapeHtml(app.code)}</code></td><td><span class="tag ${app.code === appCode ? 'good' : ''}">${escapeHtml(app.status)}</span></td><td>${escapeHtml(app.created_at || '')}</td></tr>`).join('')}</tbody></table>
    </section>
    <section class="panel">
      <h2>Subscriptions</h2>
      <table><thead><tr><th>User</th><th>Group</th><th>Status</th><th>Expires At</th><th>Actions</th></tr></thead><tbody>${renderSubscriptionRows(db, appCode)}</tbody></table>
    </section>
    <section class="panel">
      <h2>Groups</h2>
      <table><thead><tr><th>Group</th><th>Type</th><th>Status</th><th>Rate</th><th>Limits D/W/M</th></tr></thead><tbody>${renderGroupRows(db)}</tbody></table>
    </section>
  `;
  return renderLayout('Mock Console', body, { appCode });
}

function redirect(res, location = '/mock-console') {
  res.writeHead(303, { Location: location });
  res.end();
}

function renderMockPayPage(session) {
  const status = paymentStatusLabel(session.status);
  const statusText = {
    paid: '已支付成功',
    failed: '已失败',
    cancelled: '已取消',
    expired: '已过期',
    refunded: '已退款',
    pending: '待支付',
  }[status];
  const confirmUrl = `${APP_URL}/mock-pay/confirm?trade_no=${encodeURIComponent(session.trade_no)}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mock Pay</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#0f172a; color:#e2e8f0; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; }
    .card { width:min(92vw, 520px); background:#111827; border:1px solid #334155; border-radius:24px; padding:28px; box-shadow:0 20px 40px rgba(0,0,0,.35); }
    .badge { display:inline-block; padding:6px 10px; border-radius:999px; background:#1e293b; color:#93c5fd; font-size:12px; }
    h1 { margin:16px 0 8px; font-size:28px; }
    p { color:#94a3b8; line-height:1.6; }
    .meta { margin:18px 0; padding:16px; background:#0b1220; border-radius:16px; }
    .meta div { margin:8px 0; }
    .actions { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; margin-top:20px; }
    form { margin:0; }
    button, a { width:100%; display:block; border:0; text-align:center; text-decoration:none; border-radius:14px; padding:14px 16px; font-weight:600; cursor:pointer; font-size:14px; }
    .primary { background:#22c55e; color:#052e16; }
    .danger { background:#f97316; color:#431407; }
    .warn { background:#facc15; color:#422006; }
    .secondary { background:#1e293b; color:#e2e8f0; }
    .ghost { background:#334155; color:#e2e8f0; }
    @media (max-width:520px) { .actions { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Mock Payment Gateway · ${escapeHtml(statusText)}</span>
    <h1>模拟支付页面</h1>
    <p>这个页面用于本地联调。你可以模拟支付成功、失败、取消、过期，成功/失败会尝试向主应用发送 EasyPay notify。</p>
    <div class="meta">
      <div>订单号: ${session.out_trade_no}</div>
      <div>网关流水: ${session.trade_no}</div>
      <div>金额: ¥${session.money}</div>
      <div>支付方式: ${session.type}</div>
      <div>支付渠道: ${session.provider || 'easypay'}</div>
    </div>
    <div class="actions">
      <a class="primary" href="${confirmUrl}">确认支付成功</a>
      <form method="post" action="/mock-pay/${encodeURIComponent(session.trade_no)}/fail"><button class="danger" type="submit">模拟失败</button></form>
      <form method="post" action="/mock-pay/${encodeURIComponent(session.trade_no)}/cancel"><button class="secondary" type="submit">模拟取消</button></form>
      <form method="post" action="/mock-pay/${encodeURIComponent(session.trade_no)}/expire"><button class="warn" type="submit">模拟过期</button></form>
      <form method="post" action="/mock-pay/${encodeURIComponent(session.trade_no)}/refund"><button class="secondary" type="submit">模拟退款</button></form>
      <form method="post" action="/mock-pay/${encodeURIComponent(session.trade_no)}/notify"><button class="ghost" type="submit">重发通知</button></form>
      <a class="secondary" href="${escapeHtml(withAppCode('/mock-console', session.app_code || DEFAULT_APP_CODE))}">返回控制台</a>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', APP_URL);
  const pathname = url.pathname;
  const db = readDb();
  const appCode = getActiveAppCode(url, db);

  if (req.method === 'GET' && pathname === '/') {
    return redirect(res, withAppCode('/mock-console', appCode));
  }

  if (req.method === 'GET' && pathname === '/mock-console') {
    const notice = url.searchParams.get('notice') || '';
    return sendHtml(res, 200, renderConsolePage(db, appCode, notice));
  }

  if (req.method === 'GET' && pathname === '/mock-console/api/state') {
    return sendJson(res, 200, { code: 0, app_code: appCode, data: db });
  }

  if (req.method === 'POST' && pathname === '/mock-console/users') {
    const body = await parseBody(req);
    const username = formValue(body, 'username', `test-user-${Date.now()}`);
    const email = formValue(body, 'email', `${username}@example.com`);
    const balance = Number(formValue(body, 'balance', '0'));
    const user = {
      id: nextUserId(db),
      username,
      email,
      status: 'active',
      balance: Number((Number.isFinite(balance) ? balance : 0).toFixed(2)),
      notes: formValue(body, 'notes', 'Created from mock console'),
      role: formValue(body, 'role', 'user'),
      token: makeToken(username),
    };
    db.users.push(user);
    writeDb(db);
    return redirect(res, withAppCode(`/mock-console?notice=${encodeURIComponent(`Created user ${user.username}`)}`, appCode));
  }

  if (req.method === 'POST' && pathname === '/mock-console/apps') {
    const body = await parseBody(req);
    const name = formValue(body, 'name', `App ${db.nextIds.app}`);
    const inputCode = formValue(body, 'code', '');
    const code = inputCode ? makeAppCode(inputCode, `app-${db.nextIds.app}`) : makeAppCode(name, `app-${db.nextIds.app}`);
    if (db.apps.some((app) => app.code === code)) {
      return redirect(res, withAppCode(`/mock-console?notice=${encodeURIComponent(`App code already exists: ${code}`)}`, appCode));
    }
    const now = nowIso();
    db.apps.push({
      code,
      name,
      status: 'active',
      notes: formValue(body, 'notes', 'Created from dashboard'),
      created_at: now,
      updated_at: now,
    });
    db.nextIds.app += 1;
    writeDb(db);
    return redirect(res, withAppCode(`/mock-console?notice=${encodeURIComponent(`Created app ${name}`)}`, code));
  }

  if (req.method === 'POST' && pathname === '/mock-console/subscriptions') {
    const body = await parseBody(req);
    const userId = Number(formValue(body, 'user_id', '0'));
    const groupId = Number(formValue(body, 'group_id', '0'));
    const validityDays = Number(formValue(body, 'validity_days', '30'));
    const user = db.users.find((item) => item.id === userId);
    const group = db.groups.find((item) => item.id === groupId);
    if (!user || !group) return badRequest(res, 'User or group not found');

    const start = nowIso();
    const subscription = {
      id: db.nextIds.subscription++,
      user_id: user.id,
      group_id: group.id,
      starts_at: start,
      expires_at: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      daily_usage_usd: 0,
      weekly_usage_usd: 0,
      monthly_usage_usd: 0,
      daily_window_start: start,
      weekly_window_start: start,
      monthly_window_start: start,
      assigned_by: 9001,
      assigned_at: start,
      notes: formValue(body, 'notes', 'Manual assignment'),
      created_at: start,
      updated_at: start,
    };
    db.subscriptions.push(subscription);
    writeDb(db);
    return redirect(res, withAppCode(`/mock-console?notice=${encodeURIComponent(`Assigned ${group.name} to ${user.username}`)}`, appCode));
  }

  if (req.method === 'POST' && pathname.match(/^\/mock-console\/subscriptions\/\d+\/extend$/)) {
    const body = await parseBody(req);
    const subscriptionId = Number(pathname.split('/')[3]);
    const subscription = db.subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return badRequest(res, 'Subscription not found');
    const days = Number(formValue(body, 'days', '0'));
    const baseTime = new Date(subscription.expires_at).getTime();
    subscription.expires_at = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
    subscription.updated_at = nowIso();
    writeDb(db);
    return redirect(res, withAppCode(`/mock-console?notice=${encodeURIComponent(`Subscription ${subscription.id} changed by ${days} days`)}`, appCode));
  }

  if (req.method === 'POST' && pathname.match(/^\/mock-console\/payments\/[^/]+\/[^/]+$/)) {
    const [, , , tradeNo, action] = pathname.split('/');
    const result = await applyPaymentAction(db, decodeURIComponent(tradeNo), decodeURIComponent(action));
    if (!result.ok) return sendJson(res, result.status || 400, { code: result.status || 400, message: result.message });
    return redirect(res, withAppCode(`/mock-console?notice=${encodeURIComponent(result.message)}`, appCode));
  }

  if (req.method === 'POST' && pathname.match(/^\/mock-pay\/[^/]+\/[^/]+$/)) {
    const [, , tradeNo, action] = pathname.split('/');
    const result = await applyPaymentAction(db, decodeURIComponent(tradeNo), decodeURIComponent(action));
    if (!result.ok) return sendJson(res, result.status || 400, { code: result.status || 400, message: result.message });
    return redirect(res, `/mock-pay/${encodeURIComponent(decodeURIComponent(tradeNo))}`);
  }

  if (req.method === 'GET' && pathname === '/api/v1/auth/me') {
    const user = getCurrentUser(req, db);
    if (!user) return unauthorized(res);
    return sendJson(res, 200, { code: 0, data: pickUserPublic(user) });
  }

  if (req.method === 'GET' && pathname === '/api/v1/admin/groups/all') {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    return sendJson(res, 200, { code: 0, data: db.groups });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/v1/admin/groups/')) {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const groupId = Number(pathname.split('/').pop());
    const group = db.groups.find((item) => item.id === groupId) || null;
    if (!group) return sendJson(res, 404, { code: 404, message: 'Group not found' });
    return sendJson(res, 200, { code: 0, data: group });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/v1/admin/users/')) {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const parts = pathname.split('/').filter(Boolean);
    const userId = Number(parts[4]);
    const user = db.users.find((item) => item.id === userId);
    if (!user) return sendJson(res, 404, { code: 404, message: 'User not found' });

    if (parts.length === 6 && parts[5] === 'subscriptions') {
      const subscriptions = db.subscriptions.filter((item) => item.user_id === userId);
      return sendJson(res, 200, { code: 0, data: subscriptions });
    }

    if (parts.length === 5) {
      return sendJson(res, 200, { code: 0, data: pickUserPublic(user) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/v1/admin/users') {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const keyword = (url.searchParams.get('search') || '').toLowerCase();
    const items = db.users
      .filter((user) =>
        !keyword ||
        user.username.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        String(user.id).includes(keyword),
      )
      .map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        notes: user.notes,
      }));
    return sendJson(res, 200, { code: 0, data: { items, total: items.length, page: 1, page_size: 30 } });
  }

  if (req.method === 'POST' && pathname === '/api/v1/admin/redeem-codes/create-and-redeem') {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const body = await parseBody(req);
    const user = db.users.find((item) => item.id === Number(body.user_id));
    if (!user) return sendJson(res, 404, { code: 404, message: 'User not found' });

    const redeemCode = {
      id: db.nextIds.redeemCode++,
      code: body.code,
      type: body.type || 'balance',
      value: Number(body.value || 0),
      status: 'used',
      used_by: user.id,
      used_at: nowIso(),
      notes: body.notes || null,
    };
    db.redeemCodes.push(redeemCode);

    if (redeemCode.type === 'subscription') {
      const groupId = Number(body.group_id);
      const validityDays = Number(body.validity_days || 30);
      const existing = db.subscriptions.find(
        (item) => item.user_id === user.id && item.group_id === groupId && item.status === 'active',
      );
      if (existing) {
        const baseTime = Math.max(Date.now(), new Date(existing.expires_at).getTime());
        existing.expires_at = new Date(baseTime + validityDays * 24 * 60 * 60 * 1000).toISOString();
        existing.updated_at = nowIso();
      } else {
        const start = nowIso();
        db.subscriptions.push({
          id: db.nextIds.subscription++,
          user_id: user.id,
          group_id: groupId,
          starts_at: start,
          expires_at: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          daily_usage_usd: 0,
          weekly_usage_usd: 0,
          monthly_usage_usd: 0,
          daily_window_start: start,
          weekly_window_start: start,
          monthly_window_start: start,
          assigned_by: 9001,
          assigned_at: start,
          notes: body.notes || null,
          created_at: start,
          updated_at: start,
        });
      }
    } else {
      user.balance = Number((user.balance + redeemCode.value).toFixed(2));
    }

    writeDb(db);
    return sendJson(res, 200, { code: 0, redeem_code: redeemCode });
  }

  if (req.method === 'POST' && pathname === '/api/v1/admin/subscriptions/assign') {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const body = await parseBody(req);
    const start = nowIso();
    const subscription = {
      id: db.nextIds.subscription++,
      user_id: Number(body.user_id),
      group_id: Number(body.group_id),
      starts_at: start,
      expires_at: new Date(Date.now() + Number(body.validity_days || 30) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      daily_usage_usd: 0,
      weekly_usage_usd: 0,
      monthly_usage_usd: 0,
      daily_window_start: start,
      weekly_window_start: start,
      monthly_window_start: start,
      assigned_by: 9001,
      assigned_at: start,
      notes: body.notes || null,
      created_at: start,
      updated_at: start,
    };
    db.subscriptions.push(subscription);
    writeDb(db);
    return sendJson(res, 200, { code: 0, data: subscription });
  }

  if (req.method === 'GET' && pathname === '/api/v1/admin/subscriptions') {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const userId = Number(url.searchParams.get('user_id') || '0');
    const groupId = Number(url.searchParams.get('group_id') || '0');
    const status = url.searchParams.get('status');
    let items = db.subscriptions.slice();
    if (userId) items = items.filter((item) => item.user_id === userId);
    if (groupId) items = items.filter((item) => item.group_id === groupId);
    if (status) items = items.filter((item) => item.status === status);
    return sendJson(res, 200, {
      code: 0,
      data: {
        items,
        total: items.length,
        page: Number(url.searchParams.get('page') || '1'),
        page_size: Number(url.searchParams.get('page_size') || '50'),
      },
    });
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/v1\/admin\/subscriptions\/\d+\/extend$/)) {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const body = await parseBody(req);
    const subscriptionId = Number(pathname.split('/')[5]);
    const subscription = db.subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return sendJson(res, 404, { code: 404, message: 'Subscription not found' });
    const days = Number(body.days || 0);
    const baseTime = new Date(subscription.expires_at).getTime();
    subscription.expires_at = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
    subscription.updated_at = nowIso();
    writeDb(db);
    return sendJson(res, 200, { code: 0, data: subscription });
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/v1\/admin\/users\/\d+\/balance$/)) {
    if (!requireAdminApiKey(req)) return unauthorized(res);
    const body = await parseBody(req);
    const userId = Number(pathname.split('/')[5]);
    const user = db.users.find((item) => item.id === userId);
    if (!user) return sendJson(res, 404, { code: 404, message: 'User not found' });

    const amount = Number(body.balance || 0);
    if (!Number.isFinite(amount) || amount < 0) return badRequest(res, 'Invalid balance amount');
    if (body.operation === 'subtract' && user.balance < amount) {
      return sendJson(res, 422, { code: 422, message: 'Insufficient balance' });
    }

    user.balance = Number((body.operation === 'subtract' ? user.balance - amount : user.balance + amount).toFixed(2));
    db.balanceLogs.push({
      user_id: user.id,
      operation: body.operation,
      balance: amount,
      notes: body.notes || null,
      created_at: nowIso(),
    });
    writeDb(db);
    return sendJson(res, 200, { code: 0, data: pickUserPublic(user) });
  }

  if (req.method === 'POST' && pathname === '/mapi.php') {
    const body = await parseBody(req);
    const session = createPaymentSession(db, body);
    writeDb(db);
    return sendJson(res, 200, {
      code: 1,
      msg: 'success',
      trade_no: session.trade_no,
      out_trade_no: session.out_trade_no,
      payurl: `${APP_URL}/mock-pay/${session.trade_no}`,
      payurl2: `${APP_URL}/mock-pay/${session.trade_no}`,
      qrcode: `${APP_URL}/mock-pay/${session.trade_no}`,
    });
  }

  if (req.method === 'POST' && pathname === '/api.php') {
    const act = url.searchParams.get('act') || '';
    const body = await parseBody(req);
    if (act === 'refund') {
      const session = db.paymentSessions.find((item) => item.trade_no === body.trade_no || item.out_trade_no === body.out_trade_no);
      if (!session) return sendJson(res, 404, { code: 0, msg: 'order not found' });
      session.status = -1;
      session.updated_at = nowIso();
      writeDb(db);
      return sendJson(res, 200, { code: 1, msg: 'refund success' });
    }
    if (body.act === 'order') {
      const session = db.paymentSessions.find((item) => item.out_trade_no === body.out_trade_no);
      if (!session) return sendJson(res, 404, { code: 0, msg: 'order not found' });
      return sendJson(res, 200, {
        code: 1,
        msg: 'success',
        trade_no: session.trade_no,
        out_trade_no: session.out_trade_no,
        money: session.money,
        status: session.status === 1 ? 1 : 0,
        endtime: session.status === 1 ? session.updated_at || session.created_at : null,
      });
    }
  }

  if (req.method === 'GET' && pathname === '/mock-pay/confirm') {
    const tradeNo = url.searchParams.get('trade_no');
    const session = db.paymentSessions.find((item) => item.trade_no === tradeNo);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Session not found');
      return;
    }
    session.status = 1;
    session.updated_at = nowIso();
    writeDb(db);
    try {
      await sendEasyPayNotify(session);
    } catch (error) {
      console.error('mock-sub2api notify failed:', error);
    }
    res.writeHead(302, {
      Location: `${APP_URL}/mock-pay/${encodeURIComponent(tradeNo)}`,
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/mock-pay/')) {
    const tradeNo = pathname.split('/').pop();
    const session = db.paymentSessions.find((item) => item.trade_no === tradeNo);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Session not found');
      return;
    }
    const html = renderMockPayPage(session);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { ok: true, app: 'mock-sub2api', port: PORT });
  }

  notFound(res);
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`mock-sub2api listening on ${APP_URL}`);
  console.log(`admin api key: ${API_KEY}`);
});
