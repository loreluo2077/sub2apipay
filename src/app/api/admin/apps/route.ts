import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';
import { getDefaultApp, listActiveApps } from '@/lib/app-context';
import { prisma } from '@/lib/db';

function normalizeAppCode(value: string): string {
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const currentCode = request.nextUrl.searchParams.get('app_code')?.trim();
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === '1';
    const apps = includeInactive
      ? await prisma.app.findMany({
          select: { id: true, code: true, name: true, status: true },
          orderBy: [{ createdAt: 'asc' }],
        })
      : await listActiveApps();
    const fallbackApp = await getDefaultApp();
    const currentApp =
      apps.find((app) => app.code === currentCode) ??
      apps.find((app) => app.code === fallbackApp.code) ??
      fallbackApp;

    return NextResponse.json({
      apps,
      currentApp,
    });
  } catch (error) {
    console.error('Failed to list apps:', error);
    return NextResponse.json({ error: '获取业务应用列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const body = await request.json();
    const rawCode = typeof body.code === 'string' ? body.code : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const code = normalizeAppCode(rawCode);

    if (!code || !/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code)) {
      return NextResponse.json({ error: 'App code 格式不正确，仅支持小写字母、数字、下划线和短横线' }, { status: 400 });
    }
    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'App 名称不能为空且不能超过 100 个字符' }, { status: 400 });
    }

    const existing = await prisma.app.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `App code "${code}" 已存在` }, { status: 409 });
    }

    const app = await prisma.app.create({
      data: {
        code,
        name,
        status: 'active',
      },
      select: { id: true, code: true, name: true, status: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ app }, { status: 201 });
  } catch (error) {
    console.error('Failed to create app:', error);
    return NextResponse.json({ error: '创建业务应用失败' }, { status: 500 });
  }
}
