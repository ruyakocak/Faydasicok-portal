import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import type { DashboardStats } from '../../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { generateActionSummary, moduleLabels } from '../../utils/audit';

function StatCard({ title, value, icon, to, trend }: { title: string; value: number; icon: React.ReactNode; to?: string; trend?: { value: string; positive: boolean } }) {
  const content = (
    <div className="p-5 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-700 border border-gray-200 shadow-sm">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend.positive ? 'text-green-700 bg-green-50 border border-green-100' : 'text-gray-600 bg-gray-100 border border-gray-200'}`}>
            {trend.positive ? (
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )}
            {trend.value}
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-gray-900 tracking-tight">{value.toLocaleString('tr-TR')}</div>
        <div className="text-sm font-medium text-gray-500 mt-1">{title}</div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-card-hover transition-all block group">
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {content}
    </div>
  );
}


export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Ana Sayfa</h1>
        <p className="page-subtitle">Bursiyer Yönetim Sistemi genel durumu</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Toplam Bursiyer"
          value={stats?.totalStudents ?? 0}
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          to="/admin/students"
        />
        <StatCard
          title="Onay Bekleyen"
          value={stats?.pendingChanges ?? 0}
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          to="/admin/approvals"
        />
        <StatCard
          title="Aktif Dönem"
          value={stats?.activePeriods ?? 0}
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          to="/admin/periods"
        />
        <StatCard
          title="Bu Ay Yükleme"
          value={stats?.thisMonthDocs ?? 0}
          icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          to="/admin/approvals"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/admin/approvals" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 hover:border-primary-300 hover:shadow-card-hover transition-all group">
          <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors border border-gray-200 group-hover:border-primary-200">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 tracking-tight group-hover:text-primary-600 transition-colors">Onay Kuyruğunu İncele</h3>
            <p className="text-sm text-gray-500 mt-0.5">Bekleyen evrak yüklemelerini incele ve onayla.</p>
          </div>
        </Link>
        <Link to="/admin/periods" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 hover:border-primary-300 hover:shadow-card-hover transition-all group">
          <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors border border-gray-200 group-hover:border-primary-200">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 tracking-tight group-hover:text-primary-600 transition-colors">Yeni Dönem Başlat</h3>
            <p className="text-sm text-gray-500 mt-0.5">Bursiyerler için yeni evrak yükleme dönemi aç.</p>
          </div>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-base font-semibold">Son Aktiviteler</h2>
          <Link to="/admin/audit-logs" className="text-sm text-primary-500 hover:text-primary-600">
            Tümünü gör →
          </Link>
        </div>
        <div className="overflow-hidden">
          {!data?.recentActivity?.length ? (
            <div className="empty-state py-8">
              <p className="empty-state-desc">Henüz aktivite yok.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentActivity.slice(0, 5).map((log) => {
                let iconColor = '';
                let IconSvg = null;

                if (log.action === 'UPLOAD') {
                  iconColor = 'bg-blue-100 text-blue-600';
                  IconSvg = (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="12" y1="18" x2="12" y2="12"></line>
                      <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                  );
                } else if (log.action === 'APPROVE') {
                  iconColor = 'bg-green-100 text-green-600';
                  IconSvg = (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  );
                } else if (log.action === 'REJECT') {
                  iconColor = 'bg-red-100 text-red-600';
                  IconSvg = (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  );
                } else {
                  iconColor = 'bg-gray-100 text-gray-600';
                  IconSvg = <div className="w-2 h-2 rounded-full bg-gray-400" />;
                }

                const actionText = generateActionSummary(log);
                const moduleName = moduleLabels[log.module] || log.module;

                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      {IconSvg}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">
                        {actionText}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">{moduleName}</span>
                        <span>•</span>
                        <span>{format(new Date(log.createdAt), 'dd MMMM yyyy, HH:mm', { locale: tr })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
