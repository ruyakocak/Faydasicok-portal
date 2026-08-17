import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import type { DashboardStats } from '../../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { generateActionSummary, moduleLabels } from '../../utils/audit';

function StatCard({ title, value, color, icon, to }: { title: string; value: number; color: string; icon: React.ReactNode; to?: string }) {
  const content = (
    <div className="card-body flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value.toLocaleString('tr-TR')}</div>
        <div className="text-sm text-gray-500">{title}</div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="card hover:shadow-card-hover transition-shadow block group">
        {content}
      </Link>
    );
  }

  return (
    <div className="card">
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
          color="bg-blue-50 text-blue-600"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          to="/admin/students"
        />
        <StatCard
          title="Onay Bekleyen"
          value={stats?.pendingChanges ?? 0}
          color="bg-status-pending-bg text-status-pending"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          to="/admin/approvals"
        />
        <StatCard
          title="Aktif Dönem"
          value={stats?.activePeriods ?? 0}
          color="bg-status-approved-bg text-status-approved"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          to="/admin/periods"
        />
        <StatCard
          title="Bu Ay Yükleme"
          value={stats?.thisMonthDocs ?? 0}
          color="bg-purple-50 text-purple-600"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          to="/admin/approvals"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/admin/approvals" className="card hover:shadow-card-hover transition-shadow block group">
          <div className="card-body flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Onay Kuyruğu</div>
              <div className="text-sm text-gray-500">
                {stats?.pendingChanges ? `${stats.pendingChanges} öğe onay bekliyor` : 'Bekleyen onay yok'}
              </div>
            </div>
          </div>
        </Link>

        <Link to="/admin/students" className="card hover:shadow-card-hover transition-shadow block group">
          <div className="card-body flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Bursiyer Listesi</div>
              <div className="text-sm text-gray-500">Tüm bursiyerleri görüntüle ve yönet</div>
            </div>
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
