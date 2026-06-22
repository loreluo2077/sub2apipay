import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserByToken, getUserSubscriptions, getAllGroups } from '@/lib/sub2api/client';
import { prisma } from '@/lib/db';
import { resolveAppByCode } from '@/lib/app-context';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();
  const appCode = request.nextUrl.searchParams.get('app_code');
  if (!token) {
    return NextResponse.json({ error: '缺少 token' }, { status: 401 });
  }

  let userId: number;
  try {
    const user = await getCurrentUserByToken(token);
    userId = user.id;
  } catch {
    return NextResponse.json({ error: '无效的 token' }, { status: 401 });
  }

  try {
    const app = await resolveAppByCode(appCode);
    const [subscriptions, groups] = await Promise.all([getUserSubscriptions(userId), getAllGroups().catch(() => [])]);
    const appPlanGroups = await prisma.subscriptionPlan.findMany({
      where: {
        appId: app.id,
        groupId: { not: null },
      },
      select: { groupId: true },
    });
    const allowedGroupIds = new Set(appPlanGroups.map((plan) => plan.groupId).filter((id): id is number => id !== null));

    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const enriched = subscriptions
      .filter((sub) => allowedGroupIds.has(sub.group_id))
      .map((sub) => {
      const group = groupMap.get(sub.group_id);
      return {
        ...sub,
        group_name: group?.name ?? null,
        platform: group?.platform ?? null,
      };
    });

    return NextResponse.json({ subscriptions: enriched });
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_NOT_FOUND') {
      return NextResponse.json({ error: '业务应用不存在' }, { status: 404 });
    }
    console.error('Failed to get user subscriptions:', error);
    return NextResponse.json({ error: '获取订阅信息失败' }, { status: 500 });
  }
}
