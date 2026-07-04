import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto';
import { resolveAppByCode } from '@/lib/app-context';

function decryptConfig(encryptedConfig: string): Record<string, string> {
  return JSON.parse(decrypt(encryptedConfig));
}

// GET: List all instances (optionally filter by providerKey)
export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const providerKey = request.nextUrl.searchParams.get('providerKey');
    const appCode = request.nextUrl.searchParams.get('app_code');
    const app = await resolveAppByCode(appCode);

    const instances = await prisma.paymentProviderInstance.findMany({
      where: {
        appId: app.id,
        ...(providerKey ? { providerKey } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });

    const result = instances.map((inst) => ({
      ...inst,
      config: decryptConfig(inst.config),
      limits: inst.limits ? JSON.parse(inst.limits) : null,
    }));

    return NextResponse.json({ instances: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_NOT_FOUND') {
      return NextResponse.json({ error: '业务应用不存在' }, { status: 404 });
    }
    console.error('Failed to list provider instances:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: '获取支付实例列表失败' }, { status: 500 });
  }
}

// POST: Create a new instance
export async function POST(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const body = await request.json();
    const appCode = request.nextUrl.searchParams.get('app_code');
    const { providerKey, name, config, enabled, sortOrder, supportedTypes, limits, refundEnabled } = body;

    // Validate required fields
    if (!providerKey || typeof providerKey !== 'string') {
      return NextResponse.json({ error: '缺少必填字段: providerKey' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: '缺少必填字段: name' }, { status: 400 });
    }
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: '缺少必填字段: config (必须是对象)' }, { status: 400 });
    }

    const validProviders = ['easypay', 'alipay', 'wxpay', 'stripe'];
    if (!validProviders.includes(providerKey)) {
      return NextResponse.json({ error: `无效的 providerKey，可选值: ${validProviders.join(', ')}` }, { status: 400 });
    }

    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
      return NextResponse.json({ error: 'sortOrder 必须是非负整数' }, { status: 400 });
    }

    // Encrypt config before storing
    const encryptedConfig = encrypt(JSON.stringify(config));
    const app = await resolveAppByCode(appCode);

    const instance = await prisma.paymentProviderInstance.create({
      data: {
        appId: app.id,
        providerKey,
        name: name.trim(),
        config: encryptedConfig,
        supportedTypes: supportedTypes ?? '',
        enabled: enabled ?? true,
        sortOrder: sortOrder ?? 0,
        limits: limits ? JSON.stringify(limits) : null,
        refundEnabled: refundEnabled === true,
      },
    });

    return NextResponse.json(
      {
        ...instance,
        config: decryptConfig(instance.config),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_NOT_FOUND') {
      return NextResponse.json({ error: '业务应用不存在' }, { status: 404 });
    }
    console.error('Failed to create provider instance:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: '创建支付实例失败' }, { status: 500 });
  }
}
