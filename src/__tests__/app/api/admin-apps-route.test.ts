import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockVerifyAdminToken = vi.fn();
const mockListActiveApps = vi.fn();
const mockGetDefaultApp = vi.fn();
const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();

vi.mock('@/lib/admin-auth', () => ({
  verifyAdminToken: (...args: unknown[]) => mockVerifyAdminToken(...args),
  unauthorizedResponse: () => NextResponse.json({ error: '未授权' }, { status: 401 }),
}));

vi.mock('@/lib/app-context', () => ({
  listActiveApps: (...args: unknown[]) => mockListActiveApps(...args),
  getDefaultApp: (...args: unknown[]) => mockGetDefaultApp(...args),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    app: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { GET, POST } from '@/app/api/admin/apps/route';
import { PUT } from '@/app/api/admin/apps/[id]/route';

function createRequest(url: string, method = 'GET', body?: object) {
  const headers: Record<string, string> = { Authorization: 'Bearer admin-token' };
  if (body) headers['Content-Type'] = 'application/json';
  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function appParams(id = 'app_1') {
  return Promise.resolve({ id });
}

describe('GET /api/admin/apps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminToken.mockResolvedValue(true);
    mockListActiveApps.mockResolvedValue([
      { id: 'app_default', code: 'default', name: 'Default App', status: 'active' },
      { id: 'app_2', code: 'shop', name: 'Shop App', status: 'active' },
    ]);
    mockGetDefaultApp.mockResolvedValue({ id: 'app_default', code: 'default', name: 'Default App', status: 'active' });
  });

  it('returns 401 when unauthorized', async () => {
    mockVerifyAdminToken.mockResolvedValue(false);
    const res = await GET(createRequest('https://pay.example.com/api/admin/apps'));
    expect(res.status).toBe(401);
  });

  it('returns active apps and current app', async () => {
    const res = await GET(createRequest('https://pay.example.com/api/admin/apps?app_code=shop'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.apps).toHaveLength(2);
    expect(data.currentApp.code).toBe('shop');
  });

  it('can include inactive apps', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'app_default', code: 'default', name: 'Default App', status: 'active' },
      { id: 'app_old', code: 'legacy', name: 'Legacy App', status: 'inactive' },
    ]);

    const res = await GET(createRequest('https://pay.example.com/api/admin/apps?include_inactive=1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.apps).toHaveLength(2);
    expect(data.apps[1].status).toBe('inactive');
  });
});

describe('POST /api/admin/apps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminToken.mockResolvedValue(true);
  });

  it('creates a new app', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 'app_new',
      code: 'my_app',
      name: 'My App',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      createRequest('https://pay.example.com/api/admin/apps', 'POST', {
        code: 'My_App',
        name: 'My App',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'my_app', name: 'My App', status: 'active' }),
      }),
    );
    expect(data.app.code).toBe('my_app');
  });

  it('rejects duplicate code', async () => {
    mockFindUnique.mockResolvedValue({ id: 'app_existing', code: 'my_app' });

    const res = await POST(
      createRequest('https://pay.example.com/api/admin/apps', 'POST', {
        code: 'my_app',
        name: 'My App',
      }),
    );

    expect(res.status).toBe(409);
  });
});

describe('PUT /api/admin/apps/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminToken.mockResolvedValue(true);
  });

  it('updates app name', async () => {
    mockFindUnique.mockResolvedValue({ id: 'app_1', code: 'shop', name: 'Old', status: 'active' });
    mockUpdate.mockResolvedValue({ id: 'app_1', code: 'shop', name: 'New', status: 'active' });

    const res = await PUT(
      createRequest('https://pay.example.com/api/admin/apps/app_1', 'PUT', { name: 'New' }),
      { params: appParams() },
    );

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'New' } }));
  });

  it('prevents disabling default app', async () => {
    mockFindUnique.mockResolvedValue({ id: 'app_default', code: 'default', name: 'Default App', status: 'active' });

    const res = await PUT(
      createRequest('https://pay.example.com/api/admin/apps/app_default', 'PUT', { status: 'inactive' }),
      { params: appParams('app_default') },
    );

    expect(res.status).toBe(409);
  });

  it('prevents disabling last active app', async () => {
    mockFindUnique.mockResolvedValue({ id: 'app_1', code: 'shop', name: 'Shop', status: 'active' });
    mockCount.mockResolvedValue(1);

    const res = await PUT(
      createRequest('https://pay.example.com/api/admin/apps/app_1', 'PUT', { status: 'inactive' }),
      { params: appParams('app_1') },
    );

    expect(res.status).toBe(409);
  });
});
