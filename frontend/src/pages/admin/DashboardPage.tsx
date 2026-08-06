import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import type { DashboardStats } from '../../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

function StatCard({ title, value, color, icon }: { title: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-body flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value.toLocaleString('tr-TR')}</div>
          <div className="text-sm text-gray-500">{title}</div>
        </div>
      </div>
    </div>
  );
}

const actionLabels: Record<string, string> = {
  CREATE: 'Oluşturuldu',
  UPDATE: 'Güncellendi',
  DELETE: 'Silindi',
  APPROVE: 'Onaylandı',
  REJECT: 'Reddedildi',
  LOGIN: 'Giriş',
  LOGOUT: 'Çıkış',
  UPLOAD: 'Yüklendi',
};

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
        />
        <StatCard
          title="Onay Bekleyen"
          value={stats?.pendingChanges ?? 0}
          color="bg-status-pending-bg text-status-pending"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          title="Aktif Dönem"
          value={stats?.activePeriods ?? 0}
          color="bg-status-approved-bg text-status-approved"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          title="Bu Ay Yükleme"
          value={stats?.thisMonthDocs ?? 0}
          color="bg-purple-50 text-purple-600"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>İşlem</th>
                  <th>Modül</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((log) => (
                  <tr key={log.id}>
                    <td className="font-medium">
                      {log.user?.username || log.user?.email || log.user?.tcKimlikNo || log.userId}
                      <span className="ml-1 badge-gray text-xs">{log.user?.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        log.action === 'APPROVE' ? 'badge-approved' :
                        log.action === 'REJECT' ? 'badge-rejected' :
                        log.action === 'LOGIN' || log.action === 'LOGOUT' ? 'badge-gray' :
                        'badge-pending'
                      }`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="text-gray-600">{log.module}</td>
                    <td className="text-gray-500 text-xs">
                      {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
