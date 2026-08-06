import { useEffect, useState, useCallback } from 'react';
import { auditApi } from '../../api';
import type { AuditLog, PaginatedResponse } from '../../types';
import { format } from 'date-fns';


const actionLabels: Record<string, string> = {
  CREATE: 'Oluşturuldu',
  UPDATE: 'Güncellendi',
  DELETE: 'Silindi',
  APPROVE: 'Onaylandı',
  REJECT: 'Reddedildi',
  LOGIN: 'Giriş',
  LOGOUT: 'Çıkış',
  UPLOAD: 'Belge Yüklendi',
};

const actionColors: Record<string, string> = {
  APPROVE: 'badge-approved',
  REJECT: 'badge-rejected',
  LOGIN: 'badge-gray',
  LOGOUT: 'badge-gray',
  UPLOAD: 'badge-primary',
  CREATE: 'badge-primary',
  UPDATE: 'badge-pending',
  DELETE: 'badge-rejected',
};

export default function AuditLogPage() {
  const [result, setResult] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '50' };
    if (module) params.module = module;
    if (action) params.action = action;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    try {
      setResult(await auditApi.getLogs(params));
    } finally {
      setLoading(false);
    }
  }, [module, action, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Değişiklik Geçmişi</h1>
        <p className="page-subtitle">Append-only audit log — hiçbir kayıt silinemez veya değiştirilemez</p>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            className="form-input text-sm w-40"
            placeholder="Modül ara..."
            value={module}
            onChange={e => { setModule(e.target.value); setPage(1); }}
          />
          <select className="form-select text-sm w-44" value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
            <option value="">Tüm İşlemler</option>
            {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" className="form-input text-sm w-36" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" className="form-input text-sm w-36" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
          </div>
          {(module || action || startDate || endDate) && (
            <button
              onClick={() => { setModule(''); setAction(''); setStartDate(''); setEndDate(''); setPage(1); }}
              className="btn-ghost btn-sm text-gray-500"
            >
              ✕ Temizle
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="spinner border-gray-300 border-t-primary-500 w-7 h-7" />
          </div>
        ) : !result?.data.length ? (
          <div className="empty-state py-12">
            <p className="empty-state-title">Kayıt bulunamadı</p>
            <p className="empty-state-desc">Filtrelerinizi değiştirin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih-Saat</th>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>İşlem</th>
                  <th>Modül</th>
                  <th>Eski Değer</th>
                  <th>Yeni Değer</th>
                  <th>Onaylayan</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap font-mono">
                      {format(new Date(log.createdAt), 'dd.MM.yy HH:mm:ss')}
                    </td>
                    <td className="text-sm font-medium">
                      {log.user?.username || log.user?.email || log.user?.tcKimlikNo || log.userId}
                    </td>
                    <td>
                      <span className="badge-gray text-xs">{log.user?.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${actionColors[log.action] || 'badge-gray'} text-xs`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">{log.module}</td>
                    <td className="text-xs text-gray-500 max-w-36 truncate" title={log.oldValue || undefined}>
                      {log.oldValue || '—'}
                    </td>
                    <td className="text-xs text-gray-700 max-w-36 truncate" title={log.newValue || undefined}>
                      {log.newValue || '—'}
                    </td>
                    <td className="text-xs text-gray-500">
                      {log.approver?.username || log.approver?.email || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && result.pagination.totalPages > 1 && (
          <div className="card-footer flex items-center justify-between">
            <span className="text-sm text-gray-500">Toplam: {result.pagination.total.toLocaleString('tr-TR')} kayıt</span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Önceki</button>
              <span className="text-sm">{page} / {result.pagination.totalPages}</span>
              <button className="btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page === result.pagination.totalPages}>Sonraki →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
