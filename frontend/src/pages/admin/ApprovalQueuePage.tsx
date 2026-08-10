import { useEffect, useState, useCallback } from 'react';
import { approvalApi, adminApi } from '../../api';
import type { ApprovableChange, PaginatedResponse, DocumentPeriod } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const filterOptions: Record<string, { label: string; type: 'entity' | 'document' }> = {
  TRANSCRIPT: { label: 'Transkript', type: 'document' },
  VOLUNTEER_REPORT: { label: 'STK Raporu', type: 'document' },
  STUDENT_CERTIFICATE: { label: 'Öğrenci Belgesi', type: 'document' },
};

const documentTypeLabels: Record<string, string> = {
  TRANSCRIPT: 'Transkript',
  VOLUNTEER_REPORT: 'STK Raporu',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
};

const entityTypeLabels: Record<string, string> = {
  DOCUMENT: 'Belge',
  BANK_INFO: 'Banka Bilgisi',
  PERSONAL_INFO: 'Kişisel Bilgi',
  FAMILY_INFO: 'Aile Bilgisi',
  EDUCATION_INFO: 'Eğitim Bilgisi',
};

export default function ApprovalQueuePage() {
  const [result, setResult] = useState<PaginatedResponse<ApprovableChange> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [entityFilter, setEntityFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);

  useEffect(() => {
    adminApi.listPeriods().then(setPeriods).catch(console.error);
  }, []);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { status: statusFilter, page: String(page), limit: '20' };
    if (periodFilter) params.periodLabel = periodFilter;
    const filter = filterOptions[entityFilter];
    if (filter) {
      if (filter.type === 'document') {
        params.documentType = entityFilter;
      } else {
        params.entityType = entityFilter;
      }
    }
    try {
      const data = await approvalApi.getQueue(params);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, entityFilter, periodFilter, page]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!result) return;
    const allIds = result.data.map(c => c.id);
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function handleBulkApprove() {
    if (!selected.size) return;
    const ids = [...selected];
    const { approved, failed } = await approvalApi.bulkApprove(ids);
    toast.success(`${approved} onaylandı${failed ? `, ${failed} başarısız` : ''}`);
    setSelected(new Set());
    load();
  }

  async function handleApprove(id: string) {
    await approvalApi.approve(id);
    toast.success('Onaylandı.');
    load();
  }

  async function handleReject() {
    if (!rejectingId || !rejectNote.trim()) { toast.error('Red sebebi yazınız.'); return; }
    await approvalApi.reject(rejectingId, rejectNote);
    toast.success('Reddedildi.');
    setRejectingId(null);
    setRejectNote('');
    load();
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Onay Kuyruğu</h1>
        <p className="page-subtitle">Bursiyerlerden gelen değişiklik ve belge talepleri</p>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-4 flex flex-wrap items-center gap-3">
          <select
            className="form-select text-sm w-40"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="PENDING">Onay Bekliyor</option>
            <option value="APPROVED">Onaylananlar</option>
            <option value="REJECTED">Reddedilenler</option>
          </select>
          <select
            className="form-select text-sm w-48"
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Dönemler</option>
            {Array.from(new Set(periods.map(p => p.label))).map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          <select
            className="form-select text-sm w-44"
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Türler</option>
            {Object.entries(filterOptions).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {selected.size > 0 && statusFilter === 'PENDING' && (
            <button onClick={handleBulkApprove} className="btn-primary btn-sm ml-auto">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/></svg>
              Seçilenleri Onayla ({selected.size})
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
            <p className="empty-state-title">Bekleyen öğe yok</p>
            <p className="empty-state-desc">Tüm değişiklikler işlendi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {statusFilter === 'PENDING' && (
                    <th className="w-8">
                      <input type="checkbox" onChange={toggleAll} checked={selected.size === result.data.length} className="rounded border-gray-300 text-primary-500" />
                    </th>
                  )}
                  <th>Öğrenci</th>
                  <th>Tür</th>
                  <th>Alan / Belge</th>
                  <th>Eski Değer</th>
                  <th>Yeni Değer / Dosya</th>
                  <th>Tarih</th>
                  {statusFilter === 'PENDING' && <th>İşlem</th>}
                  {statusFilter !== 'PENDING' && <th>Durum</th>}
                </tr>
              </thead>
              <tbody>
                {result.data.map(change => (
                  <tr key={change.id}>
                    {statusFilter === 'PENDING' && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(change.id)}
                          onChange={() => toggleSelect(change.id)}
                          className="rounded border-gray-300 text-primary-500"
                        />
                      </td>
                    )}
                    <td>
                      <Link
                        to={`/admin/students/${change.studentProfileId}`}
                        className="text-primary-500 hover:underline font-medium text-sm"
                      >
                        {change.studentProfile?.firstName} {change.studentProfile?.lastName}
                      </Link>
                      <div className="text-xs text-gray-400">{change.studentProfile?.department}</div>
                    </td>
                    <td>
                      <span className="badge-gray text-xs">
                        {change.entityType === 'DOCUMENT' && change.document?.type
                          ? documentTypeLabels[change.document.type] || change.document.type
                          : entityTypeLabels[change.entityType] || change.entityType}
                      </span>
                    </td>
                    <td className="text-sm text-gray-700">
                      {change.entityType === 'DOCUMENT' 
                        ? (documentTypeLabels[change.document?.type || ''] || change.document?.type || '—') 
                        : change.fieldName || '—'}
                    </td>
                    <td className="text-sm text-gray-500 max-w-32 truncate">
                      {change.oldValue || '—'}
                    </td>
                    <td className="text-sm">
                      {change.entityType === 'DOCUMENT' && change.document?.filePath ? (
                        <a href={`/${change.document.filePath}`} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline text-xs">
                          {change.document.originalFileName}
                        </a>
                      ) : (
                        <span className="font-medium">{change.newValue || '—'}</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(change.createdAt), 'dd MMM HH:mm', { locale: tr })}
                    </td>
                    {statusFilter === 'PENDING' && (
                      <td>
                        {rejectingId === change.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              className="form-input text-xs py-1 w-32"
                              placeholder="Red sebebi..."
                              value={rejectNote}
                              onChange={e => setRejectNote(e.target.value)}
                              autoFocus
                            />
                            <button onClick={handleReject} className="btn-danger btn-sm">Reddet</button>
                            <button onClick={() => { setRejectingId(null); setRejectNote(''); }} className="btn-ghost btn-sm">İptal</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleApprove(change.id)}
                              className="px-2.5 py-1 text-xs font-medium bg-status-approved-bg text-status-approved-text rounded hover:bg-green-100 transition-colors"
                            >
                              ✓ Onayla
                            </button>
                            <button
                              onClick={() => { setRejectingId(change.id); setRejectNote(''); }}
                              className="px-2.5 py-1 text-xs font-medium bg-status-rejected-bg text-status-rejected-text rounded hover:bg-red-100 transition-colors"
                            >
                              ✗ Reddet
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                    {statusFilter !== 'PENDING' && (
                      <td>
                        <span className={`badge ${change.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected'}`}>
                          {change.status === 'APPROVED' ? 'Onaylandı' : 'Reddedildi'}
                        </span>
                        {change.reviewNote && <div className="text-xs text-gray-400 mt-0.5">{change.reviewNote}</div>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {result && result.pagination.totalPages > 1 && (
          <div className="card-footer flex items-center justify-between">
            <span className="text-sm text-gray-500">Toplam: {result.pagination.total}</span>
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
