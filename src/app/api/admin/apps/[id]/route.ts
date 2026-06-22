import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

const DEFAULT_APP_CODE = 'default';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const status = body.status;

    const existing = await prisma.app.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '业务应用不存在' }, { status: 404 });
    }

    const data: Record<string, string> = {};
    if (name !== undefined) {
      if (!name || name.length > 100) {
        return NextResponse.json({ error: 'App 名称不能为空且不能超过 100 个字符' }, { status: 400 });
      }
      data.name = name;
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return NextResponse.json({ error: 'status 仅支持 active 或 inactive' }, { status: 400 });
      }
      if (existing.code === DEFAULT_APP_CODE && status !== 'active') {
        return NextResponse.json({ error: '默认业务应用不能被停用' }, { status: 409 });
      }
      if (status === 'inactive') {
        const activeCount = await prisma.app.count({ where: { status: 'active' } });
        if (existing.status === 'active' && activeCount <= 1) {
          return NextResponse.json({ error: '至少需要保留一个启用中的业务应用' }, { status: 409 });
        }
      }
      data.status = status;
    }

    const app = await prisma.app.update({
      where: { id },
      data,
      select: { id: true, code: true, name: true, status: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ app });
  } catch (error) {
    console.error('Failed to update app:', error);
    return NextResponse.json({ error: '更新业务应用失败' }, { status: 500 });
  }
}
