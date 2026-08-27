import { useEffect, useState, useCallback } from 'react';
import { auditApi } from '../../api';
import type { AuditLog, PaginatedResponse } from '../../types';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { generateActionSummary, tryParseJSON, fieldTranslations, formatValue, actionLabels, moduleLabels } from '../../utils/audit';

export default function AuditLogPage() {
  const [result, setResult] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '50' };
    if (moduleFilter) params.module = moduleFilter;
    if (actionFilter) params.action = actionFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    try {
      setResult(await auditApi.getLogs(params));
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, actionFilter, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  const renderFieldValue = (key: string, val: any) => {
    if (val === undefined || val === null || val === '') return '—';
    if (key === 'filePath' && typeof val === 'string') {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const url = val.startsWith('http') ? val : `${baseUrl}/${val.replace(/^\/+/, '')}`;
      return (
        <span 
          className="text-primary-600 font-semibold hover:underline flex items-center gap-1 w-max cursor-pointer"
          onClick={() => setPreviewUrl(url)}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          Belgeyi Gör
        </span>
      );
    }
    if (key === 'rejectNote' && typeof val === 'string') {
       return <div className="bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-100 text-xs font-medium leading-relaxed max-w-sm">{val}</div>;
    }
    return formatValue(key, val);
  };

  // Handle detailed view rendering
  const renderLogDetails = () => {
    if (!selectedLog) return null;
    
    const oldObj = tryParseJSON(selectedLog.oldValue) || {};
    const newObj = tryParseJSON(selectedLog.newValue) || {};
    
    // Auto-infer opposites for boolean flags if old is missing
    if (newObj.isOpen !== undefined && oldObj.isOpen === undefined) {
      oldObj.isOpen = !newObj.isOpen;
    }
    if (newObj.isActive !== undefined && oldObj.isActive === undefined) {
      oldObj.isActive = !newObj.isActive;
    }

    const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

    return (
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">İşlem Detayları</h2>
              <p className="text-sm text-gray-500 mt-0.5">{generateActionSummary(selectedLog, setPreviewUrl)}</p>
            </div>
            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="block text-xs font-medium text-gray-500 mb-1">Tarih - Saat</span>
                <span className="font-semibold text-gray-900">{format(new Date(selectedLog.createdAt), 'dd MMMM yyyy, HH:mm:ss')}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="block text-xs font-medium text-gray-500 mb-1">İşlemi Yapan Kullanıcı</span>
                <span className="font-semibold text-gray-900">{selectedLog.user?.username || selectedLog.user?.email || selectedLog.user?.tcKimlikNo || selectedLog.userId}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="block text-xs font-medium text-gray-500 mb-1">İşlem / Modül</span>
                <span className="font-semibold text-gray-900">{actionLabels[selectedLog.action] || selectedLog.action} / {moduleLabels[selectedLog.module] || selectedLog.module}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="block text-xs font-medium text-gray-500 mb-1">Onaylayan (Varsa)</span>
                <span className="font-semibold text-gray-900">{selectedLog.approver?.username || selectedLog.approver?.email || 'Yok'}</span>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-900 mb-3">Değişen Veriler</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Alan</th>
                    <th className="px-4 py-2 font-medium">Eski Değer</th>
                    <th className="px-4 py-2 font-medium">Yeni Değer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keys.map((k) => (
                    <tr key={k} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{fieldTranslations[k] || k}</td>
                      <td className="px-4 py-2.5 text-gray-500 break-all">{renderFieldValue(k, oldObj[k])}</td>
                      <td className={`px-4 py-2.5 break-all ${newObj[k] !== oldObj[k] ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                        {renderFieldValue(k, newObj[k])}
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && (
                     <tr>
                       <td colSpan={3} className="px-4 py-6 text-center text-gray-500">Değişen yapısal bir veri bulunmuyor.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
            <button onClick={() => setSelectedLog(null)} className="btn-secondary">Kapat</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDocumentViewerModal = () => {
    if (!previewUrl) return null;
    const isPdf = previewUrl.toLowerCase().endsWith('.pdf');
    const isImage = previewUrl.match(/\.(jpeg|jpg|gif|png)$/i);

    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fade-in">
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setPreviewUrl(null)} />
        
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col relative transform animate-scale-in">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                Belge Önizleme
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 ml-7">
                Değişiklik Geçmişi Arşivi
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a href={previewUrl} download="Belge" className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                İndir
              </a>
              <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                Yeni Sekme
              </a>
              <button onClick={() => setPreviewUrl(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-100 flex flex-col relative min-h-0">
            {isPdf ? (
              <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-0" title="PDF Önizleme" />
            ) : isImage ? (
              <div className="flex items-center justify-center p-6 h-full">
                <img src={previewUrl} alt="Belge Önizleme" className="max-w-full max-h-full rounded-lg shadow-md object-contain" />
              </div>
            ) : (
              <div className="text-center mt-20">
                <p className="text-gray-500 mb-4">Bu dosya türü doğrudan önizlenemiyor.</p>
                <div className="flex items-center justify-center gap-3">
                  <a href={previewUrl} download="Belge" className="btn-primary">
                    Belgeyi İndir
                  </a>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                    Yeni Sekmede Aç
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
            value={moduleFilter}
            onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
          />
          <select className="form-select text-sm w-44" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm İşlemler</option>
            {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" className="form-input text-sm w-36" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" className="form-input text-sm w-36" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
          </div>
          {(moduleFilter || actionFilter || startDate || endDate) && (
            <button
              onClick={() => { setModuleFilter(''); setActionFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
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
                  <th>Açıklama (Özet)</th>
                  <th className="!text-right pr-6">Detaylar</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap font-mono">
                      {format(new Date(log.createdAt), 'dd.MM.yy HH:mm:ss')}
                    </td>
                    <td className="text-sm font-medium">
                      {log.user?.role === 'STUDENT' && log.user?.studentProfile?.id ? (
                        <Link to={`/admin/students/${log.user.studentProfile.id}`} className="text-gray-900 hover:underline">
                          {log.user.studentProfile.firstName 
                            ? `${log.user.studentProfile.firstName} ${log.user.studentProfile.lastName}`
                            : log.user.tcKimlikNo || log.userId}
                        </Link>
                      ) : (
                        log.user?.username || log.user?.email || log.user?.tcKimlikNo || log.userId
                      )}
                    </td>
                    <td>
                      <span className="badge-gray text-xs">{log.user?.role}</span>
                    </td>
                    <td className="text-sm text-gray-800 font-medium">
                      {generateActionSummary(log, setPreviewUrl)}
                    </td>
                    <td className="text-right pr-6">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="btn-secondary btn-sm px-3 py-1.5 inline-flex items-center gap-1.5"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        Görüntüle
                      </button>
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

      {renderLogDetails()}
      {renderDocumentViewerModal()}
    </div>
  );
}
