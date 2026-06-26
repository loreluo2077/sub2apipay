'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import PayPageLayout from '@/components/PayPageLayout';
import { resolveLocale, type Locale } from '@/lib/locale';

// ── i18n ──

function getTexts(locale: Locale) {
  return locale === 'en'
    ? {
        missingToken: 'Missing admin token',
        missingTokenHint: 'Please access the admin page from the Sub2API platform.',
        title: 'Payment Config',
        subtitle: 'Configure payment providers and settings',
        basicConfig: 'Basic Settings',
        basicConfigHint: 'Recharge rules, order behavior, and upstream connection settings',
        productNamePrefix: 'Product Name Prefix',
        productNameSuffix: 'Product Name Suffix',
        preview: 'Preview',
        enableBalanceRecharge: 'Enable Balance Recharge',
        saveConfig: 'Save Settings',
        savingConfig: 'Saving...',
        configSaveFailed: 'Failed to save configuration',
        cancelRateLimit: 'Limit Cancel Rate',
        cancelRateLimitWindow: 'Window',
        cancelRateLimitUnit: 'Unit',
        cancelRateLimitMax: 'Max',
        cancelRateLimitUnitMinute: 'Minutes',
        cancelRateLimitUnitHour: 'Hours',
        cancelRateLimitUnitDay: 'Days',
        maxPendingOrders: 'Max Pending Orders',
        cancelRateLimitWindowMode: 'Window Mode',
        cancelRateLimitWindowModeRolling: 'Rolling',
        cancelRateLimitWindowModeFixed: 'Fixed',
        cancelRateLimitHint: (w: string, u: string, m: string, mode: string) =>
          `Within ${w} ${u === 'minute' ? 'min' : u === 'day' ? 'day' : 'hr'}, max ${m} cancel(s) (${mode === 'fixed' ? 'fixed' : 'rolling'})`,
        enabledProviders: 'Enabled Provider Types',
        minRechargeAmount: 'Min Recharge Amount',
        maxRechargeAmount: 'Max Recharge Amount',
        dailyRechargeLimit: 'Daily Limit (0=unlimited)',
        orderTimeoutMinutes: 'Order Timeout (min)',
        providerManagement: 'Provider Management',
        providerManagementHint: 'Enable provider types first, then maintain concrete payment instances below.',
        rechargeRules: 'Recharge & Order Rules',
        rechargeRulesHint: 'Control amount ranges, pending orders, and upstream admin access.',
        productDisplay: 'Product Display',
        behaviorSettings: 'Behavior Settings',
        behaviorSettingsHint: 'Control balance recharge, default refund behavior, and order cancel rate limits.',
        providerTypesHint: 'Select which provider categories this app can use.',
        instancesEmptyHint: 'No instances under this provider yet. Click Add Instance to continue.',
        addInstance: 'Add Instance',
        editInstance: 'Edit Instance',
        instanceName: 'Instance Name',
        instanceProvider: 'Provider Type',
        instanceEnabled: 'Enabled',
        instanceRefundEnabled: 'Allow Refund',
        instanceConfig: 'Credentials',
        supportedChannels: 'Supported Channels',
        supportedChannelsHint: 'Select which payment channels this instance supports',
        loadBalanceStrategy: 'Load Balance',
        strategyRoundRobin: 'Round Robin',
        strategyLeastAmount: 'Least Daily Amount',
        noInstances: 'No instances configured yet.',
        deleteInstanceConfirm: 'Are you sure you want to delete this instance?',
        todayAmount: 'Today',
        instanceSortOrder: 'Sort Order',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving...',
        instanceSaveFailed: 'Failed to save instance',
        instanceDeleteFailed: 'Failed to delete instance',
        allChannels: 'All Channels',
        sub2apiAdminApiKey: 'Sub2API Admin API Key',
        sub2apiAdminApiKeyHint: 'Used for upstream admin API calls. Leave empty only if you intentionally want to rely on server env.',
        defaultDeductBalance: 'Default Deduct Balance',
        defaultDeductBalanceHint: 'When enabled, refund approval defaults to deducting balance/subscription',
      }
    : {
        missingToken: '缺少管理员凭证',
        missingTokenHint: '请从 Sub2API 平台正确访问管理页面',
        title: '支付配置',
        subtitle: '管理支付服务商与相关设置',
        basicConfig: '基础配置',
        basicConfigHint: '充值规则、订单行为与上游连接配置',
        productNamePrefix: '商品名前缀',
        productNameSuffix: '商品名后缀',
        preview: '预览',
        enableBalanceRecharge: '启用余额充值',
        saveConfig: '保存设置',
        savingConfig: '保存中...',
        configSaveFailed: '保存配置失败',
        cancelRateLimit: '限制取消频率',
        cancelRateLimitWindow: '窗口',
        cancelRateLimitUnit: '周期',
        cancelRateLimitMax: '次数',
        cancelRateLimitUnitMinute: '分钟',
        cancelRateLimitUnitHour: '小时',
        cancelRateLimitUnitDay: '天',
        maxPendingOrders: '最多支付中订单',
        cancelRateLimitWindowMode: '窗口模式',
        cancelRateLimitWindowModeRolling: '滚动',
        cancelRateLimitWindowModeFixed: '固定',
        cancelRateLimitHint: (w: string, u: string, m: string, mode: string) =>
          `${w} ${u === 'minute' ? '分钟' : u === 'day' ? '天' : '小时'}内最多可取消 ${m} 次（${mode === 'fixed' ? '固定窗口' : '滚动窗口'}）`,
        enabledProviders: '启用的服务商类型',
        minRechargeAmount: '最小充值金额',
        maxRechargeAmount: '最大充值金额',
        dailyRechargeLimit: '每日限额（0=不限）',
        orderTimeoutMinutes: '订单超时（分钟）',
        providerManagement: '服务商管理',
        providerManagementHint: '先启用服务商类型，再在下方维护具体的支付实例。',
        rechargeRules: '充值与订单规则',
        rechargeRulesHint: '统一控制金额区间、支付中订单数量和上游管理密钥。',
        productDisplay: '商品展示',
        behaviorSettings: '行为设置',
        behaviorSettingsHint: '控制余额充值、默认退款行为以及取消频率限制。',
        providerTypesHint: '选择当前业务应用允许使用的支付服务商类别。',
        instancesEmptyHint: '该服务商下还没有实例，可以点击“添加实例”继续配置。',
        addInstance: '添加实例',
        editInstance: '编辑实例',
        instanceName: '实例名称',
        instanceProvider: '服务商类型',
        instanceEnabled: '启用',
        instanceRefundEnabled: '允许退款',
        instanceConfig: '凭证配置',
        supportedChannels: '支持渠道',
        supportedChannelsHint: '选择此实例支持的支付渠道',
        loadBalanceStrategy: '负载策略',
        strategyRoundRobin: '轮询',
        strategyLeastAmount: '基于已支付金额',
        noInstances: '暂无实例，点击上方「添加实例」配置服务商。',
        deleteInstanceConfirm: '确定删除该实例？',
        todayAmount: '今日',
        instanceSortOrder: '排序',
        cancel: '取消',
        save: '保存',
        saving: '保存中...',
        instanceSaveFailed: '保存实例失败',
        instanceDeleteFailed: '删除实例失败',
        allChannels: '全部渠道',
        sub2apiAdminApiKey: 'Sub2API Admin API Key',
        sub2apiAdminApiKeyHint: '用于请求上游管理接口。只有明确要依赖服务端环境变量时才留空。',
        defaultDeductBalance: '默认扣除余额/订阅',
        defaultDeductBalanceHint: '开启后，退款通过时默认扣除余额/订阅；关闭时默认不扣除',
      };
}

// ── Constants ──

const ALL_PROVIDER_KEYS = ['easypay', 'alipay', 'wxpay', 'stripe'] as const;

const PAYMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  alipay: { zh: '支付宝', en: 'Alipay' },
  alipay_direct: { zh: '支付宝官方', en: 'Alipay Official' },
  wxpay: { zh: '微信支付', en: 'WeChat Pay' },
  wxpay_direct: { zh: '微信官方', en: 'WeChat Official' },
  stripe: { zh: 'Stripe', en: 'Stripe' },
};

const PROVIDER_LABELS: Record<string, { zh: string; en: string }> = {
  easypay: { zh: '易支付', en: 'EasyPay' },
  alipay: { zh: '支付宝官方', en: 'Alipay Official' },
  wxpay: { zh: '微信官方', en: 'WeChat Official' },
  stripe: { zh: 'Stripe', en: 'Stripe' },
};

const PROVIDER_SUPPORTED_TYPES: Record<string, string[]> = {
  easypay: ['alipay', 'wxpay'],
  alipay: ['alipay_direct'],
  wxpay: ['wxpay_direct'],
  stripe: ['stripe'],
};

interface ConfigFieldDef {
  key: string;
  label: { en: string; zh: string };
  sensitive: boolean;
  optional?: boolean;
  multiline?: boolean;
  options?: Array<{ value: string; label: { en: string; zh: string } }>;
  placeholder?: { en: string; zh: string };
  hint?: { en: string; zh: string };
}

const PROVIDER_CONFIG_FIELDS: Record<string, ConfigFieldDef[]> = {
  easypay: [
    { key: 'pid', label: { en: 'PID', zh: 'PID' }, sensitive: false, placeholder: { en: 'Your merchant PID', zh: '商户 PID' } },
    {
      key: 'pkey',
      label: { en: 'PKey (Secret)', zh: 'PKey（密钥）' },
      sensitive: true,
      placeholder: { en: 'Merchant signing secret', zh: '商户签名密钥' },
    },
    {
      key: 'apiBase',
      label: { en: 'API Base URL', zh: 'API 基础地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://gateway.example.com', zh: 'https://gateway.example.com' },
      hint: { en: 'Do not include /mapi.php or /api.php', zh: '不要带 /mapi.php 或 /api.php 后缀' },
    },
    {
      key: 'gatewayBase',
      label: { en: 'Gateway Base URL', zh: '网关基础地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://openapi.alipay.com/gateway.do', zh: 'https://openapi.alipay.com/gateway.do' },
      hint: { en: 'Only set this when routing Alipay requests to a proxy or custom gateway', zh: '只有在接入代理或自定义网关时才需要填写' },
    },
    {
      key: 'notifyUrl',
      label: { en: 'Notify URL', zh: '异步通知地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://pay.example.com/api/easypay/notify', zh: 'https://pay.example.com/api/easypay/notify' },
    },
    {
      key: 'returnUrl',
      label: { en: 'Return URL', zh: '同步跳转地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://pay.example.com/pay/result', zh: 'https://pay.example.com/pay/result' },
    },
  ],
  alipay: [
    { key: 'appId', label: { en: 'App ID', zh: 'App ID' }, sensitive: false, placeholder: { en: '2021xxxxxxxxxxxx', zh: '2021xxxxxxxxxxxx' } },
    {
      key: 'privateKey',
      label: { en: 'Private Key', zh: '应用私钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: '-----BEGIN PRIVATE KEY-----', zh: '-----BEGIN PRIVATE KEY-----' },
      hint: { en: 'Paste the application private key in PEM format', zh: '粘贴应用私钥，建议使用完整 PEM 格式' },
    },
    {
      key: 'publicKey',
      label: { en: 'Alipay Public Key', zh: '支付宝公钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: '-----BEGIN PUBLIC KEY-----', zh: '-----BEGIN PUBLIC KEY-----' },
      hint: { en: 'Use Alipay public key, not your app public key', zh: '这里必须是支付宝公钥，不是应用公钥' },
    },
    {
      key: 'apiBase',
      label: { en: 'API Base URL', zh: 'API 基础地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://api.mch.weixin.qq.com', zh: 'https://api.mch.weixin.qq.com' },
      hint: { en: 'Only set this when routing WeChat Pay requests to a proxy or custom gateway', zh: '只有在接入代理或自定义网关时才需要填写' },
    },
    {
      key: 'notifyUrl',
      label: { en: 'Notify URL', zh: '异步通知地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://pay.example.com/api/alipay/notify', zh: 'https://pay.example.com/api/alipay/notify' },
    },
    {
      key: 'returnUrl',
      label: { en: 'Return URL', zh: '同步跳转地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://pay.example.com/pay/result', zh: 'https://pay.example.com/pay/result' },
    },
  ],
  wxpay: [
    { key: 'appId', label: { en: 'App ID', zh: 'App ID' }, sensitive: false, placeholder: { en: 'wx1234567890abcdef', zh: 'wx1234567890abcdef' } },
    { key: 'mchId', label: { en: 'Merchant ID', zh: '商户号' }, sensitive: false, placeholder: { en: 'Merchant ID', zh: '微信商户号' } },
    {
      key: 'privateKey',
      label: { en: 'Merchant Private Key', zh: '商户私钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: '-----BEGIN PRIVATE KEY-----', zh: '-----BEGIN PRIVATE KEY-----' },
    },
    {
      key: 'apiV3Key',
      label: { en: 'API v3 Key', zh: 'API v3 密钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: '32-byte API v3 key', zh: '32 位 API v3 密钥' },
      hint: { en: 'Must be exactly 32 bytes', zh: '必须是 32 位长度' },
    },
    {
      key: 'publicKey',
      label: { en: 'Platform Public Key', zh: '平台公钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: '-----BEGIN PUBLIC KEY-----', zh: '-----BEGIN PUBLIC KEY-----' },
    },
    {
      key: 'publicKeyId',
      label: { en: 'Public Key ID', zh: '公钥 ID' },
      sensitive: false,
      placeholder: { en: 'PUB_KEY_ID_xxx', zh: '微信支付平台公钥 ID' },
    },
    {
      key: 'certSerial',
      label: { en: 'Certificate Serial', zh: '证书序列号' },
      sensitive: false,
      placeholder: { en: 'Certificate serial number', zh: '商户证书序列号' },
    },
    {
      key: 'notifyUrl',
      label: { en: 'Notify URL', zh: '异步通知地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://pay.example.com/api/wxpay/notify', zh: 'https://pay.example.com/api/wxpay/notify' },
    },
  ],
  stripe: [
    {
      key: 'checkoutMode',
      label: { en: 'Checkout Mode', zh: '收银台模式' },
      sensitive: false,
      options: [
        { value: 'sdk', label: { en: 'Stripe SDK', zh: 'Stripe SDK' } },
        { value: 'hosted', label: { en: 'Hosted Page', zh: '托管支付页' } },
      ],
      hint: {
        en: 'Use hosted page only when the upstream creates its own checkout page and you only need a redirect link',
        zh: '仅当上游自己创建支付页且当前实例只需要返回跳转链接时，才使用托管支付页模式',
      },
    },
    {
      key: 'secretKey',
      label: { en: 'Secret Key', zh: '服务端密钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: 'sk_live_xxx / sk_test_xxx', zh: 'sk_live_xxx / sk_test_xxx' },
      hint: { en: 'Used for PaymentIntent create/query/refund', zh: '用于创建、查询、退款 PaymentIntent' },
    },
    {
      key: 'publishableKey',
      label: { en: 'Publishable Key', zh: '前端公开密钥' },
      sensitive: false,
      placeholder: { en: 'pk_live_xxx / pk_test_xxx', zh: 'pk_live_xxx / pk_test_xxx' },
    },
    {
      key: 'apiBase',
      label: { en: 'API Base URL', zh: 'API 基础地址' },
      sensitive: false,
      optional: true,
      placeholder: { en: 'https://api.stripe.com', zh: 'https://api.stripe.com' },
      hint: { en: 'Only set this when routing Stripe API calls to a proxy or custom gateway', zh: '只有在接入代理或自定义网关时才需要填写' },
    },
    {
      key: 'webhookSecret',
      label: { en: 'Webhook Secret', zh: 'Webhook 密钥' },
      sensitive: true,
      multiline: true,
      placeholder: { en: 'whsec_xxx', zh: 'whsec_xxx' },
      hint: { en: 'Used to verify Stripe webhook signatures for this instance', zh: '用于识别并校验该实例的 Stripe webhook 回调' },
    },
  ],
};

interface ChannelLimits {
  dailyLimit?: number;
  singleMin?: number;
  singleMax?: number;
}

interface ProviderInstanceData {
  id: string;
  providerKey: string;
  name: string;
  config: Record<string, string>;
  supportedTypes: string;
  enabled: boolean;
  sortOrder: number;
  limits: Record<string, ChannelLimits> | null;
  refundEnabled: boolean;
  todayAmount?: number;
  createdAt: string;
  updatedAt: string;
}

interface InstanceFormData {
  providerKey: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, string>;
  supportedTypes: string[];
  limits: Record<string, ChannelLimits>;
  refundEnabled: boolean;
}

interface AdminApp {
  id: string;
  code: string;
  name: string;
  status: string;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function instanceSupportsPaymentType(instance: ProviderInstanceData, paymentType: string): boolean {
  const supportedTypes = splitCsv(instance.supportedTypes);
  if (supportedTypes.length > 0) {
    return supportedTypes.includes(paymentType);
  }
  return (PROVIDER_SUPPORTED_TYPES[instance.providerKey] ?? []).includes(paymentType);
}

function pickInstanceEndpoint(instance: ProviderInstanceData): { key: string; value: string } | null {
  const keys = ['gatewayBase', 'apiBase', 'notifyUrl', 'returnUrl'];
  for (const key of keys) {
    const value = instance.config?.[key]?.trim();
    if (value) {
      return { key, value };
    }
  }
  return null;
}

// ── Main Content ──

function PaymentConfigContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const appCode = searchParams.get('app_code') || '';
  const locale = resolveLocale(searchParams.get('lang'));
  const isDark = theme === 'dark';
  const isEmbedded = uiMode === 'embedded';
  const t = getTexts(locale);

  const [error, setError] = useState('');
  const [apps, setApps] = useState<AdminApp[]>([]);
  const [currentApp, setCurrentApp] = useState<AdminApp | null>(null);
  const [loading, setLoading] = useState(true);

  // Basic config
  const [rcPrefix, setRcPrefix] = useState('');
  const [rcSuffix, setRcSuffix] = useState('');
  const [rcBalanceEnabled, setRcBalanceEnabled] = useState(true);
  const [rcCancelRateLimitEnabled, setRcCancelRateLimitEnabled] = useState(false);
  const [rcCancelRateLimitWindow, setRcCancelRateLimitWindow] = useState('1');
  const [rcCancelRateLimitUnit, setRcCancelRateLimitUnit] = useState('day');
  const [rcCancelRateLimitMax, setRcCancelRateLimitMax] = useState('10');
  const [rcCancelRateLimitWindowMode, setRcCancelRateLimitWindowMode] = useState('rolling');
  const [rcMaxPendingOrders, setRcMaxPendingOrders] = useState('3');
  const [rcSaving, setRcSaving] = useState(false);
  const [rcLoadBalanceStrategy, setRcLoadBalanceStrategy] = useState('round-robin');
  const [rcSub2apiKey, setRcSub2apiKey] = useState('');
  const [rcSub2apiKeyMasked, setRcSub2apiKeyMasked] = useState(false);
  const [rcAutoRefundEnabled, setRcAutoRefundEnabled] = useState(true);
  const [rcEnabledProviders, setRcEnabledProviders] = useState('');
  const [rcEnabledPaymentTypes, setRcEnabledPaymentTypes] = useState('');
  const [rcMinAmount, setRcMinAmount] = useState('');
  const [rcMaxAmount, setRcMaxAmount] = useState('');
  const [rcDailyLimit, setRcDailyLimit] = useState('');
  const [rcOrderTimeout, setRcOrderTimeout] = useState('');

  // Instances
  const [instances, setInstances] = useState<ProviderInstanceData[]>([]);
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ProviderInstanceData | null>(null);
  const [instanceForm, setInstanceForm] = useState<InstanceFormData>({
    providerKey: 'easypay',
    name: '',
    enabled: true,
    sortOrder: 0,
    config: {},
    supportedTypes: [],
    limits: {},
    refundEnabled: false,
  });
  const [instanceSaving, setInstanceSaving] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);

  const enabledProviderKeys = useMemo(
    () =>
      splitCsv(rcEnabledProviders).filter((k) => k in PROVIDER_LABELS),
    [rcEnabledProviders],
  );

  const enabledPaymentTypes = useMemo(() => splitCsv(rcEnabledPaymentTypes), [rcEnabledPaymentTypes]);
  const instancesByProvider = useMemo(
    () =>
      enabledProviderKeys.map((providerKey) => ({
        providerKey,
        instances: instances.filter((instance) => instance.providerKey === providerKey),
      })),
    [enabledProviderKeys, instances],
  );
  const totalEnabledInstances = useMemo(() => instances.filter((instance) => instance.enabled).length, [instances]);
  const mappedPaymentTypes = useMemo(
    () =>
      enabledPaymentTypes.map((paymentType) => ({
        paymentType,
        instances: instances
          .filter((instance) => instance.enabled && instanceSupportsPaymentType(instance, paymentType))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    [enabledPaymentTypes, instances],
  );

  // ── Data fetching ──

  const fetchApps = useCallback(async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams({ token, include_inactive: '1' });
      if (appCode) query.set('app_code', appCode);
      const res = await fetch(`/api/admin/apps?${query.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setApps(data.apps ?? []);
      setCurrentApp(data.currentApp ?? null);
    } catch {
      /* ignore */
    }
  }, [token, appCode]);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams({ token });
      if (appCode) query.set('app_code', appCode);
      const res = await fetch(`/api/admin/config?${query.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const configs: { key: string; value: string }[] = data.configs ?? [];
      for (const c of configs) {
        if (c.key === 'PRODUCT_NAME_PREFIX') setRcPrefix(c.value);
        if (c.key === 'PRODUCT_NAME_SUFFIX') setRcSuffix(c.value);
        if (c.key === 'BALANCE_PAYMENT_DISABLED') setRcBalanceEnabled(c.value !== 'true');
        if (c.key === 'CANCEL_RATE_LIMIT_ENABLED') setRcCancelRateLimitEnabled(c.value === 'true');
        if (c.key === 'CANCEL_RATE_LIMIT_WINDOW') setRcCancelRateLimitWindow(c.value || '1');
        if (c.key === 'CANCEL_RATE_LIMIT_UNIT') setRcCancelRateLimitUnit(c.value || 'day');
        if (c.key === 'CANCEL_RATE_LIMIT_MAX') setRcCancelRateLimitMax(c.value || '10');
        if (c.key === 'CANCEL_RATE_LIMIT_WINDOW_MODE') setRcCancelRateLimitWindowMode(c.value || 'rolling');
        if (c.key === 'MAX_PENDING_ORDERS') setRcMaxPendingOrders(c.value || '3');
        if (c.key === 'ENABLED_PAYMENT_TYPES') setRcEnabledPaymentTypes(c.value);
        if (c.key === 'ENABLED_PROVIDERS') setRcEnabledProviders(c.value);
        if (c.key === 'RECHARGE_MIN_AMOUNT') setRcMinAmount(c.value);
        if (c.key === 'RECHARGE_MAX_AMOUNT') setRcMaxAmount(c.value);
        if (c.key === 'DAILY_RECHARGE_LIMIT') setRcDailyLimit(c.value);
        if (c.key === 'ORDER_TIMEOUT_MINUTES') setRcOrderTimeout(c.value);
        if (c.key === 'LOAD_BALANCE_STRATEGY') setRcLoadBalanceStrategy(c.value || 'round-robin');
        if (c.key === 'SUB2API_ADMIN_API_KEY') {
          const masked = /\*{4,}/.test(c.value);
          setRcSub2apiKey(masked ? c.value : c.value);
          setRcSub2apiKeyMasked(masked);
        }
        if (c.key === 'DEFAULT_DEDUCT_BALANCE') setRcAutoRefundEnabled(c.value === 'true');
      }
    } catch {
      /* ignore */
    }
  }, [token, appCode]);

  const fetchInstances = useCallback(async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams({ token });
      if (appCode) query.set('app_code', appCode);
      const res = await fetch(`/api/admin/provider-instances?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [token, appCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchApps(), fetchConfig(), fetchInstances()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchApps, fetchConfig, fetchInstances]);

  const toggleProvider = (key: string) => {
    const current = rcEnabledProviders
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Prevent disabling if instances exist
    if (current.includes(key) && instances.some((inst) => inst.providerKey === key)) {
      setError(
        locale === 'en'
          ? `Cannot disable "${PROVIDER_LABELS[key]?.en || key}": instances exist. Delete all instances first.`
          : `无法关闭「${PROVIDER_LABELS[key]?.zh || key}」：存在关联实例，请先删除所有实例。`,
      );
      return;
    }
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setRcEnabledProviders(next.join(','));
    // Auto-derive enabled payment types
    const derivedTypes = new Set<string>();
    for (const pk of next) {
      for (const pt of PROVIDER_SUPPORTED_TYPES[pk] || []) derivedTypes.add(pt);
    }
    setRcEnabledPaymentTypes(Array.from(derivedTypes).join(','));
  };

  // ── Instance CRUD ──

  const saveInstance = async () => {
    setInstanceSaving(true);
    setError('');
    try {
      const url = editingInstance
        ? `/api/admin/provider-instances/${editingInstance.id}${appCode ? `?app_code=${encodeURIComponent(appCode)}` : ''}`
        : `/api/admin/provider-instances${appCode ? `?app_code=${encodeURIComponent(appCode)}` : ''}`;
      const res = await fetch(url, {
        method: editingInstance ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          providerKey: instanceForm.providerKey,
          name: instanceForm.name.trim(),
          enabled: instanceForm.enabled,
          sortOrder: instanceForm.sortOrder,
          config: instanceForm.config,
          supportedTypes: instanceForm.supportedTypes.join(','),
          limits: Object.keys(instanceForm.limits).length > 0 ? instanceForm.limits : null,
          refundEnabled: instanceForm.refundEnabled,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t.instanceSaveFailed);
        return;
      }
      setInstanceModalOpen(false);
      setEditingInstance(null);
      fetchInstances();
    } catch {
      setError(t.instanceSaveFailed);
    } finally {
      setInstanceSaving(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm(t.deleteInstanceConfirm)) return;
    try {
      const appQuery = appCode ? `?app_code=${encodeURIComponent(appCode)}` : '';
      const res = await fetch(`/api/admin/provider-instances/${id}${appQuery}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t.instanceDeleteFailed);
        return;
      }
      fetchInstances();
    } catch {
      setError(t.instanceDeleteFailed);
    }
  };

  const openEditInstance = (inst: ProviderInstanceData) => {
    setEditingInstance(inst);
    setInstanceForm({
      providerKey: inst.providerKey,
      name: inst.name,
      enabled: inst.enabled,
      sortOrder: inst.sortOrder,
      config: { ...inst.config },
      supportedTypes: inst.supportedTypes ? inst.supportedTypes.split(',').filter(Boolean) : [],
      limits: inst.limits ?? {},
      refundEnabled: inst.refundEnabled ?? false,
    });
    setError('');
    setInstanceModalOpen(true);
  };

  const openCreateInstance = () => {
    const key = enabledProviderKeys[0] || 'easypay';
    setEditingInstance(null);
    setInstanceForm({
      providerKey: key,
      name: '',
      enabled: true,
      sortOrder: 0,
      config: {},
      supportedTypes: PROVIDER_SUPPORTED_TYPES[key] || [],
      limits: {},
      refundEnabled: false,
    });
    setError('');
    setInstanceModalOpen(true);
  };

  const toggleInstanceEnabled = async (inst: ProviderInstanceData) => {
    try {
      const appQuery = appCode ? `?app_code=${encodeURIComponent(appCode)}` : '';
      const res = await fetch(`/api/admin/provider-instances/${inst.id}${appQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !inst.enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (locale === 'en' ? 'Failed to update instance' : '更新实例失败'));
        return;
      }
      setInstances((prev) => prev.map((i) => (i.id === inst.id ? { ...i, enabled: !inst.enabled } : i)));
    } catch {
      setError(locale === 'en' ? 'Failed to update instance' : '更新实例失败');
    }
  };

  const toggleInstanceRefundEnabled = async (inst: ProviderInstanceData) => {
    try {
      const appQuery = appCode ? `?app_code=${encodeURIComponent(appCode)}` : '';
      const res = await fetch(`/api/admin/provider-instances/${inst.id}${appQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refundEnabled: !inst.refundEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (locale === 'en' ? 'Failed to update instance' : '更新实例失败'));
        return;
      }
      setInstances((prev) => prev.map((i) => (i.id === inst.id ? { ...i, refundEnabled: !inst.refundEnabled } : i)));
    } catch {
      setError(locale === 'en' ? 'Failed to update instance' : '更新实例失败');
    }
  };

  // ── Save config ──

  const saveConfig = async () => {
    setRcSaving(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (appCode) query.set('app_code', appCode);
      const res = await fetch(`/api/admin/config${query.toString() ? `?${query.toString()}` : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          configs: [
            { key: 'PRODUCT_NAME_PREFIX', value: rcPrefix.trim(), group: 'payment', label: '商品名前缀' },
            { key: 'PRODUCT_NAME_SUFFIX', value: rcSuffix.trim(), group: 'payment', label: '商品名后缀' },
            {
              key: 'BALANCE_PAYMENT_DISABLED',
              value: rcBalanceEnabled ? 'false' : 'true',
              group: 'payment',
              label: '余额充值禁用',
            },
            {
              key: 'DEFAULT_DEDUCT_BALANCE',
              value: rcAutoRefundEnabled ? 'true' : 'false',
              group: 'payment',
              label: '自动退款开关',
            },
            {
              key: 'CANCEL_RATE_LIMIT_ENABLED',
              value: rcCancelRateLimitEnabled ? 'true' : 'false',
              group: 'payment',
              label: '订单取消频率限制',
            },
            {
              key: 'CANCEL_RATE_LIMIT_WINDOW',
              value: rcCancelRateLimitWindow,
              group: 'payment',
              label: '频率限制窗口',
            },
            {
              key: 'CANCEL_RATE_LIMIT_UNIT',
              value: rcCancelRateLimitUnit,
              group: 'payment',
              label: '频率限制周期单位',
            },
            { key: 'CANCEL_RATE_LIMIT_MAX', value: rcCancelRateLimitMax, group: 'payment', label: '频率限制最大次数' },
            {
              key: 'CANCEL_RATE_LIMIT_WINDOW_MODE',
              value: rcCancelRateLimitWindowMode,
              group: 'payment',
              label: '频率限制窗口模式',
            },
            {
              key: 'MAX_PENDING_ORDERS',
              value: rcMaxPendingOrders,
              group: 'payment',
              label: '最多可存在支付中订单',
            },
            {
              key: 'SUB2API_ADMIN_API_KEY',
              value: rcSub2apiKeyMasked && /\*{4,}/.test(rcSub2apiKey) ? rcSub2apiKey : rcSub2apiKey.trim(),
              group: 'connection',
              label: 'Sub2API Admin API Key',
            },
            { key: 'RECHARGE_MIN_AMOUNT', value: rcMinAmount, group: 'payment', label: '最小充值金额' },
            { key: 'RECHARGE_MAX_AMOUNT', value: rcMaxAmount, group: 'payment', label: '最大充值金额' },
            { key: 'DAILY_RECHARGE_LIMIT', value: rcDailyLimit, group: 'payment', label: '每日充值限额' },
            { key: 'ORDER_TIMEOUT_MINUTES', value: rcOrderTimeout, group: 'payment', label: '订单超时时间' },
            { key: 'ENABLED_PROVIDERS', value: rcEnabledProviders, group: 'payment', label: '启用的服务商' },
            {
              key: 'ENABLED_PAYMENT_TYPES',
              value: rcEnabledPaymentTypes,
              group: 'payment',
              label: '启用的支付方式',
            },
          ],
        }),
      });
      if (!res.ok) setError(t.configSaveFailed);
    } catch {
      setError(t.configSaveFailed);
    } finally {
      setRcSaving(false);
    }
  };

  // ── Missing token ──
  if (!token) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{t.missingToken}</p>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.missingTokenHint}</p>
        </div>
      </div>
    );
  }

  // ── Shared classes ──
  const inputCls = [
    'w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
    isDark
      ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400'
      : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400',
  ].join(' ');
  const labelCls = ['mb-1 block text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700'].join(' ');
  const cardCls = [
    'rounded-2xl border p-5',
    isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white shadow-sm',
  ].join(' ');
  const subCardCls = [
    'rounded-2xl border p-4',
    isDark ? 'border-slate-600 bg-slate-700/30' : 'border-slate-200 bg-slate-50/80',
  ].join(' ');
  const sectionTitleCls = `text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`;
  const sectionHintCls = `mt-1 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const badgeCls = (tone: 'default' | 'good' | 'warn' | 'danger' = 'default') =>
    [
      'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
      tone === 'good'
        ? isDark
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'bg-emerald-50 text-emerald-700'
        : tone === 'warn'
          ? isDark
            ? 'bg-amber-500/15 text-amber-300'
            : 'bg-amber-50 text-amber-700'
          : tone === 'danger'
            ? isDark
              ? 'bg-red-500/15 text-red-300'
              : 'bg-red-50 text-red-700'
            : isDark
              ? 'bg-slate-700 text-slate-300'
              : 'bg-slate-100 text-slate-600',
    ].join(' ');

  const Toggle = ({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        value ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
          value ? 'translate-x-4.5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );

  const appQuery = new URLSearchParams();
  if (token) appQuery.set('token', token);
  appQuery.set('theme', theme);
  appQuery.set('ui_mode', uiMode);
  if (appCode) appQuery.set('app_code', appCode);
  if (locale !== 'zh') appQuery.set('lang', locale);

  const mainAdminUrl = `/admin?${appQuery.toString()}`;
  const appsAdminUrl = `/admin/apps?${appQuery.toString()}`;
  const appScopedNote =
    locale === 'en'
      ? 'Payment instances and basic rules on this page are now scoped to the current app.'
      : '这个页面里的支付实例和基础规则现在都按当前 App 独立生效。';
  const activeAppLabel = currentApp?.name || appCode || (locale === 'en' ? 'Unknown App' : '未识别应用');

  if (loading) {
    return (
      <PayPageLayout
        isDark={isDark}
        isEmbedded={isEmbedded}
        maxWidth="full"
        title={t.title}
        subtitle={t.subtitle}
        locale={locale}
      >
        <div className={cardCls}>
          <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {locale === 'en' ? 'Loading payment configuration...' : '正在加载支付配置...'}
          </div>
        </div>
      </PayPageLayout>
    );
  }

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={isEmbedded}
      maxWidth="full"
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      actions={
        <>
          <button
            type="button"
            onClick={saveConfig}
            disabled={rcSaving}
            className="inline-flex items-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            {rcSaving ? t.savingConfig : t.saveConfig}
          </button>
        </>
      }
    >
      {error && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${isDark ? 'border-red-800 bg-red-950/50 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}
        >
          {error}
          <button onClick={() => setError('')} className="ml-2 opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="space-y-4">
        <section className={cardCls}>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className={subCardCls}>
              {apps.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {locale === 'en' ? 'Switch App' : '切换业务应用'}
                  </span>
                  <select
                    value={appCode || currentApp?.code || ''}
                    onChange={(e) => {
                      const params = new URLSearchParams();
                      if (token) params.set('token', token);
                      params.set('theme', theme);
                      params.set('ui_mode', uiMode);
                      params.set('app_code', e.target.value);
                      if (locale !== 'zh') params.set('lang', locale);
                      window.location.href = `/admin/payment-config?${params.toString()}`;
                    }}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-sm',
                      isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900',
                    ].join(' ')}
                  >
                    {apps.map((app) => (
                      <option key={app.id} value={app.code}>
                        {app.name} ({app.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className={badgeCls('good')}>{locale === 'en' ? 'Current App' : '当前 App'}</span>
                <span className={badgeCls(currentApp?.status === 'active' ? 'good' : 'warn')}>
                  {currentApp?.status === 'active'
                    ? locale === 'en'
                      ? 'Active'
                      : '启用中'
                    : locale === 'en'
                      ? 'Inactive'
                      : '未启用'}
                </span>
              </div>
              <div className={`mt-3 text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {activeAppLabel}
              </div>
              <div className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                code: <code>{appCode || currentApp?.code || '-'}</code>
              </div>
              <p className={sectionHintCls}>{appScopedNote}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={mainAdminUrl}
                  className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-medium ${isDark ? 'bg-slate-900 text-slate-200 hover:bg-slate-950' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                >
                  {locale === 'en' ? 'Refresh Current Admin' : '刷新当前后台'}
                </a>
                <a
                  href={appsAdminUrl}
                  className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-medium ${isDark ? 'bg-slate-900 text-slate-200 hover:bg-slate-950' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                >
                  {locale === 'en' ? 'Manage Apps' : '管理业务应用'}
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={subCardCls}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {locale === 'en' ? 'Enabled Providers' : '启用服务商'}
                </div>
                <div className={`mt-2 text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {enabledProviderKeys.length}
                </div>
                <div className={sectionHintCls}>
                  {enabledProviderKeys.length > 0
                    ? enabledProviderKeys.map((key) => PROVIDER_LABELS[key]?.[locale] || key).join(' / ')
                    : locale === 'en'
                      ? 'No provider type enabled yet.'
                      : '还没有启用任何服务商类型。'}
                </div>
              </div>
              <div className={subCardCls}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {locale === 'en' ? 'Enabled Instances' : '启用实例'}
                </div>
                <div className={`mt-2 text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {totalEnabledInstances}/{instances.length}
                </div>
                <div className={sectionHintCls}>
                  {locale === 'en'
                    ? `${apps.length} apps in system, ${instances.length} instances under current app.`
                    : `系统内共 ${apps.length} 个 App，当前 App 下 ${instances.length} 个支付实例。`}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cardCls}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {locale === 'en' ? 'Payment Access Overview' : '支付接入总览'}
              </h2>
              <p className={sectionHintCls}>
                {locale === 'en'
                  ? 'This helps confirm which payment type will resolve to which enabled provider instance right now.'
                  : '这里用来快速确认当前每种支付方式最终会落到哪个可用实例。'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {mappedPaymentTypes.length > 0 ? (
              mappedPaymentTypes.map(({ paymentType, instances: resolvedInstances }) => (
                <div key={paymentType} className={subCardCls}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {PAYMENT_TYPE_LABELS[paymentType]?.[locale] || paymentType}
                    </div>
                    <span className={badgeCls(resolvedInstances.length > 0 ? 'good' : 'warn')}>
                      {resolvedInstances.length > 0
                        ? locale === 'en'
                          ? `${resolvedInstances.length} ready`
                          : `${resolvedInstances.length} 个可用`
                        : locale === 'en'
                          ? 'Not ready'
                          : '未就绪'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {resolvedInstances.length > 0 ? (
                      resolvedInstances.map((instance, index) => {
                        const endpoint = pickInstanceEndpoint(instance);
                        return (
                          <div
                            key={instance.id}
                            className={`rounded-xl border px-3 py-2 ${isDark ? 'border-slate-600 bg-slate-800/50' : 'border-slate-200 bg-white'}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={badgeCls(index === 0 ? 'good' : 'default')}>
                                {index === 0
                                  ? locale === 'en'
                                    ? 'Priority'
                                    : '当前优先'
                                  : locale === 'en'
                                    ? `Fallback ${index}`
                                    : `候补 ${index}`}
                              </span>
                              <span className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {instance.name}
                              </span>
                            </div>
                            <div className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {PROVIDER_LABELS[instance.providerKey]?.[locale] || instance.providerKey}
                              {' · '}
                              {locale === 'en' ? 'sort' : '排序'} {instance.sortOrder}
                              {' · '}
                              {instance.refundEnabled
                                ? locale === 'en'
                                  ? 'refund on'
                                  : '支持退款'
                                : locale === 'en'
                                  ? 'refund off'
                                  : '未开启退款'}
                            </div>
                            {endpoint && (
                              <div className="mt-2">
                                <span className={badgeCls('default')}>
                                  {endpoint.key}: {endpoint.value}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className={`rounded-xl border border-dashed px-3 py-4 text-sm ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                        {locale === 'en'
                          ? 'No enabled instance can serve this payment type.'
                          : '当前没有可服务此支付方式的已启用实例。'}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className={`rounded-xl border border-dashed px-4 py-5 text-sm lg:col-span-3 ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                {locale === 'en'
                  ? 'No payment type is enabled yet. Start by enabling provider types below.'
                  : '当前还没有启用任何支付方式，请先在下方开启服务商类型。'}
              </div>
            )}
          </div>
        </section>

        <section className={cardCls}>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className={subCardCls}>
                <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {t.basicConfig}
                </h2>
                <p className={sectionHintCls}>{t.basicConfigHint}</p>

                <div className="mt-4 space-y-4">
                  <div>
                    <h3 className={sectionTitleCls}>{t.productDisplay}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className={labelCls}>{t.productNamePrefix}</label>
                        <input type="text" value={rcPrefix} onChange={(e) => setRcPrefix(e.target.value)} className={inputCls} placeholder="Sub2API" />
                      </div>
                      <div>
                        <label className={labelCls}>{t.productNameSuffix}</label>
                        <input type="text" value={rcSuffix} onChange={(e) => setRcSuffix(e.target.value)} className={inputCls} placeholder="CNY" />
                      </div>
                      <div>
                        <label className={labelCls}>{t.preview}</label>
                        <div className={`rounded-xl border px-3 py-2.5 text-sm ${isDark ? 'border-slate-600 bg-slate-800 text-slate-300' : 'border-slate-300 bg-white text-slate-600'}`}>
                          {`${rcPrefix.trim() || 'Sub2API'} 100 ${rcSuffix.trim() || 'CNY'}`.trim()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className={sectionTitleCls}>{t.behaviorSettings}</h3>
                        <p className={sectionHintCls}>{t.behaviorSettingsHint}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-600 bg-slate-800/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.enableBalanceRecharge}</div>
                          <Toggle value={rcBalanceEnabled} onChange={() => setRcBalanceEnabled(!rcBalanceEnabled)} />
                        </div>
                      </div>
                      <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-600 bg-slate-800/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.defaultDeductBalance}</div>
                            <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.defaultDeductBalanceHint}</p>
                          </div>
                          <Toggle value={rcAutoRefundEnabled} onChange={() => setRcAutoRefundEnabled(!rcAutoRefundEnabled)} />
                        </div>
                      </div>
                    </div>

                    <div className={`mt-3 rounded-xl border p-4 ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex items-center gap-2 pt-1">
                          <Toggle value={rcCancelRateLimitEnabled} onChange={() => setRcCancelRateLimitEnabled(!rcCancelRateLimitEnabled)} />
                          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.cancelRateLimit}</span>
                        </div>
                        {rcCancelRateLimitEnabled && (
                          <div className="grid flex-1 gap-3 sm:grid-cols-4">
                            <div>
                              <label className={labelCls}>{t.cancelRateLimitWindow}</label>
                              <input type="number" min="1" max="999" value={rcCancelRateLimitWindow} onChange={(e) => setRcCancelRateLimitWindow(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>{t.cancelRateLimitUnit}</label>
                              <select value={rcCancelRateLimitUnit} onChange={(e) => setRcCancelRateLimitUnit(e.target.value)} className={inputCls}>
                                <option value="minute">{t.cancelRateLimitUnitMinute}</option>
                                <option value="hour">{t.cancelRateLimitUnitHour}</option>
                                <option value="day">{t.cancelRateLimitUnitDay}</option>
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>{t.cancelRateLimitMax}</label>
                              <input type="number" min="1" max="999" value={rcCancelRateLimitMax} onChange={(e) => setRcCancelRateLimitMax(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>{t.cancelRateLimitWindowMode}</label>
                              <select value={rcCancelRateLimitWindowMode} onChange={(e) => setRcCancelRateLimitWindowMode(e.target.value)} className={inputCls}>
                                <option value="rolling">{t.cancelRateLimitWindowModeRolling}</option>
                                <option value="fixed">{t.cancelRateLimitWindowModeFixed}</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                      {rcCancelRateLimitEnabled && (
                        <p className={`mt-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t.cancelRateLimitHint(rcCancelRateLimitWindow, rcCancelRateLimitUnit, rcCancelRateLimitMax, rcCancelRateLimitWindowMode)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={subCardCls}>
                <h3 className={sectionTitleCls}>{t.rechargeRules}</h3>
                <p className={sectionHintCls}>
                  {locale === 'en'
                    ? 'These recharge and order constraints are saved for the current app and take effect immediately.'
                    : '这些充值与订单约束会保存到当前 App，并且立即生效。'}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className={labelCls}>{t.minRechargeAmount}</label>
                    <input type="number" min="0" value={rcMinAmount} onChange={(e) => setRcMinAmount(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.maxRechargeAmount}</label>
                    <input type="number" min="0" value={rcMaxAmount} onChange={(e) => setRcMaxAmount(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.dailyRechargeLimit}</label>
                    <input type="number" min="0" value={rcDailyLimit} onChange={(e) => setRcDailyLimit(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.orderTimeoutMinutes}</label>
                    <input type="number" min="1" value={rcOrderTimeout} onChange={(e) => setRcOrderTimeout(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.maxPendingOrders}</label>
                    <input type="number" min="1" max="99" value={rcMaxPendingOrders} onChange={(e) => setRcMaxPendingOrders(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.loadBalanceStrategy}</label>
                    <select value={rcLoadBalanceStrategy} onChange={(e) => setRcLoadBalanceStrategy(e.target.value)} className={inputCls}>
                      <option value="round-robin">{t.strategyRoundRobin}</option>
                      <option value="least-amount">{t.strategyLeastAmount}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className={labelCls}>{t.sub2apiAdminApiKey}</label>
                  <input
                    type="password"
                    value={rcSub2apiKey}
                    onChange={(e) => {
                      setRcSub2apiKey(e.target.value);
                      setRcSub2apiKeyMasked(false);
                    }}
                    className={inputCls}
                    placeholder={t.sub2apiAdminApiKeyHint}
                    autoComplete="off"
                  />
                  <p className={sectionHintCls}>
                    {locale === 'en'
                      ? 'Stored in database only. Leaving the masked value unchanged keeps the existing secret.'
                      : '仅保存到数据库。保持当前掩码不变时，会继续沿用已保存的密钥。'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={subCardCls}>
                <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {locale === 'en' ? 'Provider Types' : '支付方式入口'}
                </h2>
                <p className={sectionHintCls}>
                  {locale === 'en'
                    ? 'This controls which provider families the system can select from. The concrete credentials are maintained in the instance list below.'
                    : '这里控制系统允许使用哪些服务商族；真正的凭证和回调信息在下方实例列表里维护。'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ALL_PROVIDER_KEYS.map((key) => {
                    const isActive = enabledProviderKeys.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleProvider(key)}
                        className={[
                          'rounded-xl border px-4 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                            : isDark
                              ? 'border-slate-500 bg-slate-800 text-slate-300 hover:border-slate-400'
                              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {PROVIDER_LABELS[key]?.[locale] || key}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {enabledPaymentTypes.length > 0 ? (
                    enabledPaymentTypes.map((type) => (
                      <span key={type} className={badgeCls('good')}>
                        {PAYMENT_TYPE_LABELS[type]?.[locale] || type}
                      </span>
                    ))
                  ) : (
                    <span className={badgeCls('warn')}>
                      {locale === 'en' ? 'No payment type exposed yet' : '当前还没有对外开放支付方式'}
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className={cardCls}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {locale === 'en' ? 'App Payment Instances' : '当前 App 的支付实例'}
              </h2>
              <p className={sectionHintCls}>
                {locale === 'en'
                  ? 'Create one or more concrete provider instances per app. This is where production-like credentials live.'
                  : '为当前 App 维护具体的支付实例。这里保存的是更接近生产的真实接入配置。'}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateInstance}
              className="inline-flex items-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600"
            >
              + {t.addInstance}
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {instancesByProvider.length === 0 && (
              <div className={`rounded-xl border border-dashed px-4 py-6 text-sm ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                {locale === 'en'
                  ? 'No provider type enabled. Enable a provider family first, then create instances.'
                  : '还没有启用任何服务商类型。请先开启服务商，再创建实例。'}
              </div>
            )}

            {instancesByProvider.map(({ providerKey, instances: providerInstances }) => (
              <div key={providerKey} className={subCardCls}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {PROVIDER_LABELS[providerKey]?.[locale] || providerKey}
                      </h3>
                      <span className={badgeCls(providerInstances.length > 0 ? 'good' : 'warn')}>
                        {providerInstances.length} {locale === 'en' ? 'instance(s)' : '个实例'}
                      </span>
                    </div>
                    <p className={sectionHintCls}>
                      {(PROVIDER_SUPPORTED_TYPES[providerKey] ?? [])
                        .map((type) => PAYMENT_TYPE_LABELS[type]?.[locale] || type)
                        .join(' / ') || t.instancesEmptyHint}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {providerInstances.length === 0 ? (
                    <div className={`rounded-xl border border-dashed px-4 py-5 text-sm ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                      {t.instancesEmptyHint}
                    </div>
                  ) : (
                    providerInstances.map((inst) => {
                      const instTypes = splitCsv(inst.supportedTypes);
                      const endpoint = pickInstanceEndpoint(inst);
                      const previewFields = (PROVIDER_CONFIG_FIELDS[inst.providerKey] ?? []).slice(0, 4);
                      return (
                        <div
                          key={inst.id}
                          className={`rounded-2xl border p-4 ${isDark ? 'border-slate-600 bg-slate-800/50' : 'border-slate-200 bg-white'}`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Toggle value={inst.enabled} onChange={() => toggleInstanceEnabled(inst)} />
                                <span className={`text-base font-semibold ${inst.enabled ? (isDark ? 'text-slate-100' : 'text-slate-900') : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {inst.name}
                                </span>
                                <span className={badgeCls(inst.enabled ? 'good' : 'warn')}>
                                  {inst.enabled ? (locale === 'en' ? 'Enabled' : '已启用') : locale === 'en' ? 'Disabled' : '已停用'}
                                </span>
                                <span className={badgeCls(inst.refundEnabled ? 'good' : 'default')}>
                                  {inst.refundEnabled ? t.instanceRefundEnabled : locale === 'en' ? 'Refund Off' : '未开启退款'}
                                </span>
                                <span className={badgeCls('default')}>
                                  {locale === 'en' ? 'sort' : '排序'} {inst.sortOrder}
                                </span>
                                {inst.todayAmount !== undefined && inst.todayAmount > 0 && (
                                  <span className={badgeCls('warn')}>
                                    {t.todayAmount}: ¥{inst.todayAmount}
                                  </span>
                                )}
                              </div>

                              <div className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                providerKey: <code>{inst.providerKey}</code>
                                {' · '}
                                id: <code>{inst.id}</code>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {instTypes.length > 0 ? (
                                  instTypes.map((type) => (
                                    <span key={type} className={badgeCls('good')}>
                                      {PAYMENT_TYPE_LABELS[type]?.[locale] || type}
                                    </span>
                                  ))
                                ) : (
                                  <span className={badgeCls('default')}>{t.allChannels}</span>
                                )}
                                {endpoint && (
                                  <span className={badgeCls('default')}>
                                    {endpoint.key}: {endpoint.value}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 grid gap-2 md:grid-cols-2">
                                {previewFields.map((field) => {
                                  const value = inst.config?.[field.key];
                                  if (!value) return null;
                                  return (
                                    <div key={field.key} className={`rounded-xl px-3 py-2 text-xs ${isDark ? 'bg-slate-700/70 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                                      <div className="font-medium">{field.label[locale]}</div>
                                      <div className="mt-1 break-all">{value}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2 xl:w-[220px] xl:flex-col">
                              <button
                                type="button"
                                onClick={() => openEditInstance(inst)}
                                className={`rounded-xl px-3 py-2 text-xs font-medium ${isDark ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                              >
                                {locale === 'en' ? 'Edit Instance' : '编辑实例'}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleInstanceRefundEnabled(inst)}
                                className={`rounded-xl px-3 py-2 text-xs font-medium ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                              >
                                {inst.refundEnabled
                                  ? locale === 'en'
                                    ? 'Turn Refund Off'
                                    : '关闭退款'
                                  : locale === 'en'
                                    ? 'Turn Refund On'
                                    : '开启退款'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInstance(inst.id)}
                                className={`rounded-xl px-3 py-2 text-xs font-medium ${isDark ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                              >
                                {locale === 'en' ? 'Delete' : '删除'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {instanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className={[
              'relative w-full max-w-5xl overflow-y-auto rounded-3xl border p-6 shadow-2xl',
              isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white',
            ].join(' ')}
            style={{ maxHeight: '92vh' }}
          >
            <div className="flex flex-col gap-2 border-b pb-4" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={badgeCls('good')}>{editingInstance ? t.editInstance : t.addInstance}</span>
                <span className={badgeCls('default')}>
                  {locale === 'en' ? 'Current App' : '当前 App'}: {activeAppLabel}
                </span>
              </div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {editingInstance ? t.editInstance : t.addInstance}
              </h2>
              <p className={sectionHintCls}>
                {locale === 'en'
                  ? 'Use production-like values here. Sensitive fields keep the masked value unless you overwrite them.'
                  : '这里尽量填写接近生产的真实配置。敏感字段如果保持掩码不变，就会继续沿用原值。'}
              </p>
            </div>

            {error && (
              <div className={`mt-4 rounded-xl border p-3 text-sm ${isDark ? 'border-red-800 bg-red-950/50 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
                {error}
              </div>
            )}

            <div className="mt-5 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className={subCardCls}>
                  <h3 className={sectionTitleCls}>{locale === 'en' ? 'Basic Info' : '基本信息'}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>
                        {t.instanceProvider}
                        <span className="ml-0.5 text-red-500">*</span>
                      </label>
                      <select
                        value={instanceForm.providerKey}
                        onChange={(e) =>
                          setInstanceForm({
                            ...instanceForm,
                            providerKey: e.target.value,
                            config: {},
                            supportedTypes: PROVIDER_SUPPORTED_TYPES[e.target.value] || [],
                            limits: {},
                          })
                        }
                        className={inputCls}
                        disabled={!!editingInstance}
                      >
                        {enabledProviderKeys.map((key) => (
                          <option key={key} value={key}>
                            {PROVIDER_LABELS[key]?.[locale] || key}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>
                        {t.instanceName}
                        <span className="ml-0.5 text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={instanceForm.name}
                        onChange={(e) => setInstanceForm({ ...instanceForm, name: e.target.value })}
                        className={inputCls}
                        placeholder={PROVIDER_LABELS[instanceForm.providerKey]?.[locale] + ' A'}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{t.instanceSortOrder}</label>
                      <input
                        type="number"
                        min="0"
                        value={instanceForm.sortOrder}
                        onChange={(e) => setInstanceForm({ ...instanceForm, sortOrder: parseInt(e.target.value, 10) || 0 })}
                        className={inputCls}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex flex-wrap items-center gap-4 pb-1">
                        <div className="flex items-center gap-2">
                          <Toggle value={instanceForm.enabled} onChange={() => setInstanceForm({ ...instanceForm, enabled: !instanceForm.enabled })} />
                          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.instanceEnabled}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Toggle value={instanceForm.refundEnabled} onChange={() => setInstanceForm({ ...instanceForm, refundEnabled: !instanceForm.refundEnabled })} />
                          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.instanceRefundEnabled}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={subCardCls}>
                  <h3 className={sectionTitleCls}>{t.supportedChannels}</h3>
                  <p className={sectionHintCls}>{t.supportedChannelsHint}</p>
                  <div className="mt-3 space-y-3">
                    {(PROVIDER_SUPPORTED_TYPES[instanceForm.providerKey] || []).map((type) => {
                      const isActive = instanceForm.supportedTypes.includes(type);
                      const cidKey = type === 'alipay' ? 'cidAlipay' : type === 'wxpay' ? 'cidWxpay' : '';
                      const cidLabel =
                        type === 'alipay'
                          ? locale === 'en'
                            ? 'Alipay Channel ID'
                            : '支付宝渠道 ID'
                          : locale === 'en'
                            ? 'WeChat Channel ID'
                            : '微信渠道 ID';
                      return (
                        <div key={type} className={`rounded-xl border p-3 ${isDark ? 'border-slate-600 bg-slate-800/40' : 'border-slate-200 bg-white'}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <button
                              type="button"
                              onClick={() =>
                                setInstanceForm((prev) => ({
                                  ...prev,
                                  supportedTypes: isActive
                                    ? prev.supportedTypes.filter((item) => item !== type)
                                    : [...prev.supportedTypes, type],
                                }))
                              }
                              className={[
                                'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                                isActive
                                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600'
                                  : isDark
                                    ? 'border-slate-500 text-slate-400 hover:border-slate-400'
                                    : 'border-slate-300 text-slate-500 hover:border-slate-400',
                              ].join(' ')}
                            >
                              {isActive ? '✓ ' : ''}
                              {PAYMENT_TYPE_LABELS[type]?.[locale] || type}
                            </button>
                            {isActive && cidKey && instanceForm.providerKey === 'easypay' && (
                              <input
                                type="text"
                                value={instanceForm.config[cidKey] ?? ''}
                                onChange={(e) =>
                                  setInstanceForm({
                                    ...instanceForm,
                                    config: { ...instanceForm.config, [cidKey]: e.target.value },
                                  })
                                }
                                className={[inputCls, 'flex-1'].join(' ')}
                                placeholder={cidLabel}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={subCardCls}>
                  <button
                    type="button"
                    onClick={() => setLimitsOpen(!limitsOpen)}
                    className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-slate-200 hover:text-slate-100' : 'text-slate-700 hover:text-slate-900'}`}
                  >
                    <span className="text-[10px]" style={{ transform: limitsOpen ? 'rotate(90deg)' : 'none' }}>
                      ▶
                    </span>
                    {locale === 'en' ? 'Per-Channel Limits' : '分渠道限额'}
                    {Object.values(instanceForm.limits).some((item) => item.dailyLimit || item.singleMin || item.singleMax) && (
                      <span className={badgeCls('warn')}>{locale === 'en' ? 'configured' : '已配置'}</span>
                    )}
                  </button>

                  {limitsOpen && (
                    <div className="mt-3 space-y-3">
                      <p className={sectionHintCls}>
                        {locale === 'en'
                          ? 'Optional limits for each payment type under this provider instance.'
                          : '可选配置，按支付方式限制单笔和每日额度。'}
                      </p>
                      {(PROVIDER_SUPPORTED_TYPES[instanceForm.providerKey] || []).map((type) => (
                        <div key={type} className={`rounded-xl border p-3 ${isDark ? 'border-slate-600 bg-slate-800/40' : 'border-slate-200 bg-white'}`}>
                          <div className={`mb-2 text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {PAYMENT_TYPE_LABELS[type]?.[locale] || type}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className={`mb-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {locale === 'en' ? 'Single Min' : '单笔最小'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={instanceForm.limits[type]?.singleMin ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  setInstanceForm((prev) => ({
                                    ...prev,
                                    limits: { ...prev.limits, [type]: { ...prev.limits[type], singleMin: value } },
                                  }));
                                }}
                                className={inputCls}
                                placeholder={locale === 'en' ? 'Unlimited' : '不限'}
                              />
                            </div>
                            <div>
                              <label className={`mb-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {locale === 'en' ? 'Single Max' : '单笔最大'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={instanceForm.limits[type]?.singleMax ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  setInstanceForm((prev) => ({
                                    ...prev,
                                    limits: { ...prev.limits, [type]: { ...prev.limits[type], singleMax: value } },
                                  }));
                                }}
                                className={inputCls}
                                placeholder={locale === 'en' ? 'Unlimited' : '不限'}
                              />
                            </div>
                            <div>
                              <label className={`mb-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {locale === 'en' ? 'Daily Limit' : '每日总限额'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={instanceForm.limits[type]?.dailyLimit ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  setInstanceForm((prev) => ({
                                    ...prev,
                                    limits: { ...prev.limits, [type]: { ...prev.limits[type], dailyLimit: value } },
                                  }));
                                }}
                                className={inputCls}
                                placeholder={locale === 'en' ? 'Unlimited' : '不限'}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={subCardCls}>
                <h3 className={sectionTitleCls}>{t.instanceConfig}</h3>
                <p className={sectionHintCls}>
                  {locale === 'en'
                    ? 'Keep one provider instance focused on one real upstream account when possible.'
                    : '建议一个实例尽量对应一个真实上游商户，避免多套凭证混在一起。'}
                </p>
                <div className="mt-4 space-y-3">
                  {(PROVIDER_CONFIG_FIELDS[instanceForm.providerKey] ?? []).map((field) => (
                    <div key={field.key}>
                      <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {field.label[locale]}
                        {field.optional ? (
                          <span className="ml-1 opacity-60">({locale === 'en' ? 'optional' : '可选'})</span>
                        ) : (
                          <span className="ml-0.5 text-red-500">*</span>
                        )}
                      </label>
                      {field.options ? (
                        <select
                          value={instanceForm.config[field.key] ?? field.options[0]?.value ?? ''}
                          onChange={(e) =>
                            setInstanceForm({
                              ...instanceForm,
                              config: { ...instanceForm.config, [field.key]: e.target.value },
                            })
                          }
                          className={inputCls}
                        >
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label[locale]}
                            </option>
                          ))}
                        </select>
                      ) : field.multiline ? (
                        <textarea
                          value={instanceForm.config[field.key] ?? ''}
                          onChange={(e) =>
                            setInstanceForm({
                              ...instanceForm,
                              config: { ...instanceForm.config, [field.key]: e.target.value },
                            })
                          }
                          className={[inputCls, 'min-h-[120px] resize-y font-mono text-xs leading-5'].join(' ')}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={field.placeholder?.[locale]}
                        />
                      ) : (
                        <input
                          type="text"
                          value={instanceForm.config[field.key] ?? ''}
                          onChange={(e) =>
                            setInstanceForm({
                              ...instanceForm,
                              config: { ...instanceForm.config, [field.key]: e.target.value },
                            })
                          }
                          className={inputCls}
                          autoComplete="off"
                          placeholder={field.placeholder?.[locale]}
                        />
                      )}
                      {field.hint && <p className={sectionHintCls}>{field.hint[locale]}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setInstanceModalOpen(false);
                  setEditingInstance(null);
                  setError('');
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={saveInstance}
                disabled={instanceSaving || !instanceForm.name.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {instanceSaving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </PayPageLayout>
  );
}

function PaymentConfigPageFallback() {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams.get('lang'));
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-slate-500">{locale === 'en' ? 'Loading...' : '加载中...'}</div>
    </div>
  );
}

export default function PaymentConfigPage() {
  return (
    <Suspense fallback={<PaymentConfigPageFallback />}>
      <PaymentConfigContent />
    </Suspense>
  );
}
