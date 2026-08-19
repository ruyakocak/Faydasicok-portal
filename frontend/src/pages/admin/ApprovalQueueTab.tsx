import { useEffect, useState, useCallback, useMemo } from 'react';
import { approvalApi, adminApi } from '../../api';
import type { ApprovableChange, PaginatedResponse, DocumentPeriod, DocumentTypeConfig } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import DocumentPreviewDrawer from '../../components/DocumentPreviewDrawer';

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

function formatIbanDisplay(iban?: string | null): string {
  if (!iban) return '—';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  const parts = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join(' ');
}

function renderBankInfo(val?: string | null) {
  if (!val) return <span className="text-gray-400">—</span>;
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object') {
      return (
        <div className="space-y-0.5 text-xs">
          <div>
            <span className="text-gray-500 font-medium">Banka:</span>{' '}
            <span className="font-semibold text-gray-900">{parsed.bankName || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">IBAN:</span>{' '}
            <span className="font-mono font-medium text-gray-900 tracking-wider">{formatIbanDisplay(parsed.iban)}</span>
          </div>
        </div>
      );
    }
  } catch {
    // Fallback for legacy strings
  }
  return <span className="text-gray-700 text-xs font-medium">{val}</span>;
}

export default function ApprovalQueueTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<PaginatedResponse<ApprovableChange> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [entityFilter, setEntityFilter] = useState(searchParams.get('entity') || '');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('periodLabel') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeConfig[]>([]);
  const [categories, setCategories] = useState<import('../../types').ScholarshipCategory[]>([]);

  useEffect(() => {
    adminApi.listPeriods().then(setPeriods).catch(console.error);
    adminApi.listDocumentTypes().then(setDocTypes).catch(console.error);
    adminApi.listScholarshipCategories().then(setCategories).catch(console.error);
  }, []);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<ApprovableChange | null>(null);

  const dynamicFilterOptions = useMemo(() => {
    const options: Record<string, { label: string; type: 'entity' | 'document' }> = {};
    
    docTypes.forEach(t => {
      options[t.code] = { label: t.name, type: 'document' };
    });
    
    return options;
  }, [docTypes]);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { status: statusFilter, page: String(page), limit: '20' };
    if (periodFilter) params.periodLabel = periodFilter;
    if (categoryFilter) params.categoryId = categoryFilter;
    const filter = dynamicFilterOptions[entityFilter];
    if (filter) {
      if (filter.type === 'document') {
        params.documentType = entityFilter;
      } else {
        params.entityType = entityFilter;
      }
    } else if (entityFilter) {
      // If docTypes hasn't loaded yet, we can blindly pass it to documentType or entityType
      // depending on if it's a known entity type
      if (['DOCUMENT', 'BANK_INFO', 'PERSONAL_INFO', 'FAMILY_INFO', 'EDUCATION_INFO'].includes(entityFilter)) {
        params.entityType = entityFilter;
      } else {
        params.documentType = entityFilter;
      }
    }

    try {
      const data = await approvalApi.getQueue(params);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, entityFilter, periodFilter, categoryFilter, page, dynamicFilterOptions]);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (statusFilter !== 'ALL') newParams.set('status', statusFilter);
    if (entityFilter) newParams.set('entity', entityFilter);
    if (periodFilter) newParams.set('periodLabel', periodFilter);
    if (categoryFilter) newParams.set('category', categoryFilter);
    setSearchParams(newParams, { replace: true });
  }, [statusFilter, entityFilter, periodFilter, categoryFilter, setSearchParams]);

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

  async function handleReject(id: string, note: string) {
    await approvalApi.reject(id, note);
    toast.success('Reddedildi.');
    load();
  }

  return (
    <div className="animate-fade-in">

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-4 flex flex-wrap items-center gap-3">
          <select
            className="form-select text-sm w-40"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">Tümü</option>
            <option value="PENDING">Onay Bekliyor</option>
            <option value="APPROVED">Onaylananlar</option>
            <option value="REJECTED">Reddedilenler</option>
          </select>
          <select
            className="form-select text-sm w-44"
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
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
            {Object.entries(dynamicFilterOptions).map(([k, v]) => (
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
          <EmptyState 
            title="Bekleyen öğe yok" 
            description="Tüm değişiklikler işlendi." 
          />
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
                  <th>İşlem / Belge</th>
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
                      {change.entityType !== 'DOCUMENT' && (
                        <span className="badge-gray text-[10px] mb-1 block w-max uppercase tracking-wider">
                          {entityTypeLabels[change.entityType] || change.entityType}
                        </span>
                      )}
                      <span className="text-sm text-gray-800 font-medium">
                        {change.entityType === 'DOCUMENT' 
                          ? (docTypes.find(d => d.code === change.document?.type)?.name || documentTypeLabels[change.document?.type || ''] || change.document?.type || '—') 
                          : (change.fieldName === 'bankInfo' ? 'Banka & IBAN' : change.fieldName || '—')}
                      </span>
                    </td>
                    <td className="text-sm">
                      {change.entityType === 'BANK_INFO' ? (
                        renderBankInfo(change.oldValue)
                      ) : (
                        <span className="text-sm text-gray-500 max-w-32 truncate">{change.oldValue || '—'}</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {change.entityType === 'DOCUMENT' && change.document?.filePath ? (
                        <button 
                          onClick={() => { setPreviewDocument(change); setDrawerOpen(true); }} 
                          className="text-primary-500 hover:underline text-xs"
                        >
                          {change.document.originalFileName}
                        </button>
                      ) : change.entityType === 'BANK_INFO' ? (
                        renderBankInfo(change.newValue)
                      ) : (
                        <span className="font-medium">{change.newValue || '—'}</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(change.createdAt), 'dd MMM HH:mm', { locale: tr })}
                    </td>
                    {statusFilter === 'PENDING' && (
                      <td>
                        <div className="flex items-center gap-1.5">
                          {change.entityType === 'DOCUMENT' && change.document?.filePath && (
                            <button
                              onClick={() => { setPreviewDocument(change); setDrawerOpen(true); }}
                              className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              İncele
                            </button>
                          )}
                          <button
                            onClick={() => handleApprove(change.id)}
                            className="px-2.5 py-1 text-xs font-medium bg-status-approved-bg text-status-approved-text rounded hover:bg-green-100 transition-colors"
                          >
                            ✓ Onayla
                          </button>
                        </div>
                      </td>
                    )}
                    {statusFilter !== 'PENDING' && (
                      <td className="w-32 pr-6">
                        {change.status === 'PENDING' ? (
                          <span className="badge badge-gray text-yellow-700 bg-yellow-50">Onay Bekliyor</span>
                        ) : (
                          <span className={`badge ${change.status === 'APPROVED' ? 'badge-approved' : 'badge-gray text-red-700 bg-red-50'}`}>
                            {change.status === 'APPROVED' ? 'Onaylandı' : 'Reddedildi'}
                          </span>
                        )}
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

      <DocumentPreviewDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        document={previewDocument}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
