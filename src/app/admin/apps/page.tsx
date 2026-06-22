'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PayPageLayout from '@/components/PayPageLayout';
import { resolveLocale } from '@/lib/locale';

interface AppItem {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

function AppManagementContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const currentAppCode = searchParams.get('app_code') || '';
  const locale = resolveLocale(searchParams.get('lang'));
  const isDark = theme === 'dark';
  const isEmbedded = uiMode === 'embedded';

  const text =
    locale === 'en'
      ? {
          missingToken: 'Missing admin token',
          missingTokenHint: 'Please access the admin page from the Sub2API platform.',
          title: 'App Management',
          subtitle: 'Create and manage business apps',
          refresh: 'Refresh',
          loading: 'Loading...',
          createApp: 'New App',
          editApp: 'Edit App',
          code: 'App Code',
          name: 'App Name',
          status: 'Status',
          actions: 'Actions',
          current: 'Current',
          active: 'Active',
          inactive: 'Inactive',
          save: 'Save',
          cancel: 'Cancel',
          saving: 'Saving...',
          noApps: 'No apps found',
          loadFailed: 'Failed to load apps',
          saveFailed: 'Failed to save app',
          deactivate: 'Deactivate',
          activate: 'Activate',
          rename: 'Rename',
        }
      : {
          missingToken: '缺少管理员凭证',
          missingTokenHint: '请从 Sub2API 平台正确访问管理页面',
          title: '业务应用管理',
          subtitle: '创建和管理业务应用',
          refresh: '刷新',
          loading: '加载中...',
          createApp: '新建业务应用',
          editApp: '编辑业务应用',
          code: 'App Code',
          name: '应用名称',
          status: '状态',
          actions: '操作',
          current: '当前',
          active: '启用中',
          inactive: '已停用',
          save: '保存',
          cancel: '取消',
          saving: '保存中...',
          noApps: '暂无业务应用',
          loadFailed: '加载业务应用失败',
          saveFailed: '保存业务应用失败',
          deactivate: '停用',
          activate: '启用',
          rename: '编辑',
        };

  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchApps = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ token, include_inactive: '1' });
      if (currentAppCode) query.set('app_code', currentAppCode);
      const res = await fetch(`/api/admin/apps?${query.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApps(data.apps ?? []);
    } catch {
      setError(text.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [token, currentAppCode, text.loadFailed]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const openCreate = () => {
    setEditingApp(null);
    setFormCode('');
    setFormName('');
    setModalOpen(true);
  };

  const openEdit = (app: AppItem) => {
    setEditingApp(app);
    setFormCode(app.code);
    setFormName(app.name);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingApp(null);
  };

  const saveApp = async () => {
    if (!formName.trim() || (!editingApp && !formCode.trim())) return;
    setSaving(true);
    setError('');
    try {
      const url = editingApp ? `/api/admin/apps/${editingApp.id}` : '/api/admin/apps';
      const method = editingApp ? 'PUT' : 'POST';
      const body = editingApp
        ? { name: formName.trim() }
        : { code: formCode.trim(), name: formName.trim() };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || text.saveFailed);
        return;
      }

      closeModal();
      fetchApps();
    } catch {
      setError(text.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (app: AppItem, status: 'active' | 'inactive') => {
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || text.saveFailed);
        return;
      }
      fetchApps();
    } catch {
      setError(text.saveFailed);
    }
  };

  if (!token) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{text.missingToken}</p>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{text.missingTokenHint}</p>
        </div>
      </div>
    );
  }

  const btnBase = [
    'inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
    isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
  ].join(' ');

  const inputCls = [
    'w-full rounded-lg border px-3 py-2 text-sm',
    isDark ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-300 bg-white text-slate-900',
  ].join(' ');

  const labelCls = ['mb-1 block text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700'].join(' ');

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={isEmbedded}
      maxWidth="full"
      title={text.title}
      subtitle={text.subtitle}
      locale={locale}
      actions={
        <>
          <button type="button" onClick={fetchApps} className={btnBase}>
            {text.refresh}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center rounded-lg border border-emerald-500 bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600"
          >
            {text.createApp}
          </button>
        </>
      }
    >
      {error && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${isDark ? 'border-red-800 bg-red-950/50 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
          {error}
          <button onClick={() => setError('')} className="ml-2 opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className={['overflow-x-auto rounded-xl border', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white shadow-sm'].join(' ')}>
        {loading ? (
          <div className={`py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{text.loading}</div>
        ) : apps.length === 0 ? (
          <div className={`py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{text.noApps}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'border-b border-slate-700 text-slate-400' : 'border-b border-slate-200 text-slate-500'}>
                <th className="px-4 py-3 text-left font-medium">{text.code}</th>
                <th className="px-4 py-3 text-left font-medium">{text.name}</th>
                <th className="px-4 py-3 text-left font-medium">{text.status}</th>
                <th className="px-4 py-3 text-right font-medium">{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className={['border-b', isDark ? 'border-slate-700/50' : 'border-slate-100'].join(' ')}>
                  <td className={`px-4 py-3 font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <div className="flex items-center gap-2">
                      <span>{app.code}</span>
                      {app.code === currentAppCode && (
                        <span className={['rounded-full px-2 py-0.5 text-[10px] font-medium', isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'].join(' ')}>
                          {text.current}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={['px-4 py-3', isDark ? 'text-slate-300' : 'text-slate-700'].join(' ')}>{app.name}</td>
                  <td className="px-4 py-3">
                    <span className={['rounded-full px-2 py-0.5 text-xs font-medium', app.status === 'active' ? (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')].join(' ')}>
                      {app.status === 'active' ? text.active : text.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(app)}
                        className={['rounded-md px-2 py-1 text-xs font-medium transition-colors', isDark ? 'text-indigo-400 hover:bg-indigo-500/20' : 'text-indigo-600 hover:bg-indigo-50'].join(' ')}
                      >
                        {text.rename}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(app, app.status === 'active' ? 'inactive' : 'active')}
                        className={['rounded-md px-2 py-1 text-xs font-medium transition-colors', app.status === 'active' ? (isDark ? 'text-amber-400 hover:bg-amber-500/20' : 'text-amber-700 hover:bg-amber-50') : (isDark ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-emerald-700 hover:bg-emerald-50')].join(' ')}
                      >
                        {app.status === 'active' ? text.deactivate : text.activate}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={['w-full max-w-md rounded-2xl border p-6 shadow-2xl', isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'].join(' ')}>
            <h2 className={`mb-5 text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {editingApp ? text.editApp : text.createApp}
            </h2>

            {!editingApp && (
              <div className="mb-4">
                <label className={labelCls}>{text.code}</label>
                <input value={formCode} onChange={(e) => setFormCode(e.target.value)} className={inputCls} placeholder="my_app" />
              </div>
            )}

            <div className="mb-5">
              <label className={labelCls}>{text.name}</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className={inputCls} placeholder={locale === 'en' ? 'My App' : '我的业务应用'} />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className={btnBase}>
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={saveApp}
                disabled={saving}
                className="inline-flex items-center rounded-lg border border-emerald-500 bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </PayPageLayout>
  );
}

function AppManagementFallback() {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>;
}

export default function AdminAppsPage() {
  return (
    <Suspense fallback={<AppManagementFallback />}>
      <AppManagementContent />
    </Suspense>
  );
}
