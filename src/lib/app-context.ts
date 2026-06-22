import { prisma } from '@/lib/db';

const DEFAULT_APP_CODE = 'default';

export interface ResolvedApp {
  id: string;
  code: string;
  name: string;
  status: string;
}

export async function getDefaultApp(): Promise<ResolvedApp> {
  const app = await prisma.app.findUnique({
    where: { code: DEFAULT_APP_CODE },
    select: { id: true, code: true, name: true, status: true },
  });

  if (!app) {
    throw new Error('DEFAULT_APP_NOT_FOUND');
  }

  return app;
}

export async function listActiveApps(): Promise<ResolvedApp[]> {
  return prisma.app.findMany({
    where: { status: 'active' },
    select: { id: true, code: true, name: true, status: true },
    orderBy: [{ createdAt: 'asc' }],
  });
}

export async function resolveAppByCode(appCode?: string | null): Promise<ResolvedApp> {
  const normalized = appCode?.trim();
  if (!normalized) return getDefaultApp();

  const app = await prisma.app.findUnique({
    where: { code: normalized },
    select: { id: true, code: true, name: true, status: true },
  });

  if (!app || app.status !== 'active') {
    throw new Error('APP_NOT_FOUND');
  }

  return app;
}
