import { useEffect, useState, useCallback } from 'react';
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
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
};

const entityTypeLabels: Record<string, string> = {
  DOCUMENT: 'Evrak / Belge',
  BANK_INFO: 'Banka Bilgisi',
  PERSONAL_INFO: 'Kişisel Bilgi',
  FAMILY_INFO: 'Aile Bilgisi',
  EDUCATION_INFO: 'Eğitim Bilgisi',
  CONTACT_INFO: 'İletişim Bilgisi',
};

const fieldNameLabels: Record<string, string> = {
  email: 'E-Posta Adresi',
  phone: 'Telefon Numarası',
  tcKimlikNo: 'T.C. Kimlik No',
  bankInfo: 'Banka & IBAN',
  bankName: 'Banka Adı',
  iban: 'IBAN Numarası',
  accountHolder: 'Hesap Sahibi',
  address: 'Adres / İkametgâh',
  birthDate: 'Doğum Tarihi',
  birthPlace: 'Doğum Yeri',
  gender: 'Cinsiyet',
  maritalStatus: 'Medeni Durum',
  universityName: 'Üniversite',
  university: 'Üniversite',
  universityType: 'Üniversite Türü',
  faculty: 'Fakülte',
  department: 'Bölüm',
  grade: 'Sınıf',
  gpa: 'Genel Not Ortalaması (GNO)',
  studentNo: 'Öğrenci Numarası',
  motherAlive: 'Anne Durumu',
  fatherAlive: 'Baba Durumu',
  motherJob: 'Anne Mesleği',
  fatherJob: 'Baba Mesleği',
  familyIncome: 'Aile Aylık Geliri',
  siblingCount: 'Kardeş Sayısı',
  highSchool: 'Mezun Olunan Lise',
  city: 'Şehir',
  district: 'İlçe',
};

function getEntityBadge(entityType: string) {
  switch (entityType) {
    case 'DOCUMENT':
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-1 block w-max uppercase tracking-wider">Evrak / Belge</span>;
    case 'BANK_INFO':
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1 block w-max uppercase tracking-wider">Banka Bilgisi</span>;
    case 'PERSONAL_INFO':
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 mb-1 block w-max uppercase tracking-wider">Kişisel Bilgi</span>;
    case 'FAMILY_INFO':
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-1 block w-max uppercase tracking-wider">Aile Bilgisi</span>;
    case 'EDUCATION_INFO':
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-1 block w-max uppercase tracking-wider">Eğitim Bilgisi</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-700 border border-gray-200 mb-1 block w-max uppercase tracking-wider">{entityTypeLabels[entityType] || entityType}</span>;
  }
}

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
  const [queueMode, setQueueMode] = useState<'DOCUMENT' | 'PROFILE'>(
    searchParams.get('mode') === 'profile' ? 'PROFILE' : 'DOCUMENT'
  );
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
  const [managingChange, setManagingChange] = useState<ApprovableChange | null>(null);
  const [isInlineRejecting, setIsInlineRejecting] = useState(false);
  const [rejectingChange, setRejectingChange] = useState<ApprovableChange | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [bulkRejectionNote, setBulkRejectionNote] = useState('');
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [viewRejectionNote, setViewRejectionNote] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listPeriods().then(setPeriods).catch(console.error);
    adminApi.listDocumentTypes().then(setDocTypes).catch(console.error);
    adminApi.listScholarshipCategories().then(setCategories).catch(console.error);
  }, []);

  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<ApprovableChange | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { status: statusFilter, page: String(page), limit: '20' };

    if (queueMode === 'DOCUMENT') {
      params.entityType = 'DOCUMENT';
      if (periodFilter) params.periodLabel = periodFilter;
      if (entityFilter) params.documentType = entityFilter;
    } else {
      params.entityType = entityFilter || 'PROFILE';
    }

    if (categoryFilter) params.categoryId = categoryFilter;

    try {
      const data = await approvalApi.getQueue(params);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [queueMode, statusFilter, entityFilter, periodFilter, categoryFilter, page]);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    newParams.set('mode', queueMode === 'PROFILE' ? 'profile' : 'documents');
    if (statusFilter !== 'ALL') newParams.set('status', statusFilter);
    if (entityFilter) newParams.set('entity', entityFilter);
    if (periodFilter && queueMode === 'DOCUMENT') newParams.set('periodLabel', periodFilter);
    if (categoryFilter) newParams.set('category', categoryFilter);
    setSearchParams(newParams, { replace: true });
  }, [queueMode, statusFilter, entityFilter, periodFilter, categoryFilter, setSearchParams]);

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
    const pendingIds = result.data.filter(c => c.status === 'PENDING').map(c => c.id);
    if (pendingIds.length === 0) return;
    if (selected.size === pendingIds.length) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  }

  async function handleBulkApprove() {
    if (!selected.size) return;
    const ids = [...selected];
    const { approved, failed } = await approvalApi.bulkApprove(ids);
    toast.success(`${approved} öğe onaylandı${failed ? `, ${failed} başarısız` : ''}`);
    setSelected(new Set());
    load();
  }

  async function handleBulkRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected.size) return;
    if (!bulkRejectionNote.trim()) {
      toast.error('Lütfen bir red gerekçesi belirtiniz.');
      return;
    }
    setBulkRejecting(true);
    try {
      const ids = [...selected];
      const { rejected, failed } = await approvalApi.bulkReject(ids, bulkRejectionNote.trim());
      toast.success(`${rejected} öğe reddedildi${failed ? `, ${failed} başarısız` : ''}`);
      setIsBulkRejectModalOpen(false);
      setBulkRejectionNote('');
      setSelected(new Set());
      load();
    } catch {
      // Handled by axios interceptor
    } finally {
      setBulkRejecting(false);
    }
  }

  async function handleApprove(id: string) {
    await approvalApi.approve(id);
    toast.success('Onaylandı.');
    load();
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingChange) return;
    if (!rejectionNote.trim()) {
      toast.error('Lütfen bir red gerekçesi belirtiniz.');
      return;
    }
    setRejecting(true);
    try {
      await approvalApi.reject(rejectingChange.id, rejectionNote.trim());
      toast.success('Talep reddedildi.');
      setRejectingChange(null);
      setRejectionNote('');
      load();
    } catch {
      // Handled by axios interceptor
    } finally {
      setRejecting(false);
    }
  }

  function handleDeleteDocument(documentId: string) {
    setDocumentToDelete(documentId);
  }

  async function confirmDeleteDocument() {
    if (!documentToDelete) return;
    try {
      setDeletingDocumentId(documentToDelete);
      await adminApi.deleteDocument(documentToDelete);
      toast.success('Belge başarıyla silindi.');
      if (previewDocument?.document?.id === documentToDelete) {
        setDrawerOpen(false);
        setPreviewDocument(null);
      }
      setDocumentToDelete(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Belge silinirken hata oluştu');
    } finally {
      setDeletingDocumentId(null);
    }
  }

  const [downloadingZip, setDownloadingZip] = useState(false);

  async function handleDownloadFilteredZip() {
    setDownloadingZip(true);
    try {
      const blob = await adminApi.downloadDocumentsZip({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        categoryId: categoryFilter || undefined,
        periodLabel: periodFilter || undefined,
        entity: entityFilter || undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safePeriod = periodFilter ? `${periodFilter.replace(/[^a-zA-Z0-9_ğüşöçİĞÜŞÖÇ]/g, '_')}_` : '';
      const safeEntity = entityFilter ? `${entityFilter}_` : '';
      a.download = `${safePeriod}${safeEntity}belgeleri.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Filtrelenen belgeler ZIP arşivi olarak indirildi.');
    } catch (err: any) {
      toast.error('Seçili filtrelere ait indirilecek belge bulunamadı.');
    } finally {
      setDownloadingZip(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── Sub-Tabs (Segmented Control) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setQueueMode('DOCUMENT');
              setEntityFilter('');
              setPage(1);
              setSelected(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${queueMode === 'DOCUMENT'
                ? 'bg-white text-primary-700 shadow-xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            <span>Evrak Onayları</span>
            {result?.counts?.pendingDocuments !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${queueMode === 'DOCUMENT'
                  ? 'bg-primary-100 text-primary-800'
                  : 'bg-gray-200 text-gray-700'
                }`}>
                {result.counts.pendingDocuments}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setQueueMode('PROFILE');
              setEntityFilter('');
              setPeriodFilter('');
              setPage(1);
              setSelected(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${queueMode === 'PROFILE'
                ? 'bg-white text-emerald-800 shadow-xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span>Profil & IBAN Değişiklikleri</span>
            {result?.counts?.pendingProfiles !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${queueMode === 'PROFILE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-200 text-gray-700'
                }`}>
                {result.counts.pendingProfiles}
              </span>
            )}
          </button>
        </div>

        {queueMode === 'DOCUMENT' && (
          <div className="flex items-center gap-2 px-2">
            <button
              type="button"
              onClick={handleDownloadFilteredZip}
              disabled={downloadingZip}
              className="btn-secondary btn-sm flex items-center gap-1.5 text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100 transition-colors shadow-2xs font-semibold text-xs py-1.5"
              title="Seçili filtrelere uyan tüm belgeleri ZIP arşivi olarak indir"
            >
              {downloadingZip ? (
                <>
                  <span className="spinner border-primary-300 border-t-primary-600 w-3.5 h-3.5" />
                  <span>İndiriliyor...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  <span>Filtreli Belgeleri İndir (ZIP)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Filters Bar ── */}
      <div className="card">
        <div className="card-body py-3.5 flex flex-wrap items-center gap-3">
          <select
            className="form-select text-xs w-36"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="PENDING">Onay Bekleyenler</option>
            <option value="APPROVED">Onaylananlar</option>
            <option value="REJECTED">Reddedilenler</option>
          </select>

          <select
            className="form-select text-xs w-44"
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Bursiyer Kategorileri</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {queueMode === 'DOCUMENT' && (
            <>
              <select
                className="form-select text-xs w-44"
                value={periodFilter}
                onChange={e => { setPeriodFilter(e.target.value); setPage(1); }}
              >
                <option value="">Tüm Dönemler</option>
                {Array.from(new Set(periods.map(p => p.label))).map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>

              <select
                className="form-select text-xs w-44"
                value={entityFilter}
                onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
              >
                <option value="">Tüm Belge Türleri</option>
                {docTypes.map(dt => (
                  <option key={dt.code} value={dt.code}>{dt.name}</option>
                ))}
              </select>
            </>
          )}

          {queueMode === 'PROFILE' && (
            <select
              className="form-select text-xs w-44"
              value={entityFilter}
              onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tüm Bilgi Türleri</option>
              <option value="BANK_INFO">Banka & IBAN Bilgileri</option>
              <option value="PERSONAL_INFO">Kişisel Bilgiler</option>
              <option value="EDUCATION_INFO">Eğitim Bilgileri</option>
              <option value="FAMILY_INFO">Aile Bilgileri</option>
            </select>
          )}

        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-200 text-primary-800 flex items-center justify-center text-xs font-bold">{selected.size}</span>
            <span className="text-sm font-semibold text-primary-800">kayıt seçildi</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkApprove} className="btn-primary btn-sm flex items-center gap-1.5 shadow-xs text-xs">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /></svg>
              Seçilenleri Onayla
            </button>
            <button onClick={() => setIsBulkRejectModalOpen(true)} className="btn-secondary btn-sm flex items-center gap-1.5 shadow-xs text-xs border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Seçilenleri Reddet
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="spinner border-gray-300 border-t-primary-500 w-7 h-7" />
          </div>
        ) : !result?.data.length ? (
          <EmptyState
            title={queueMode === 'DOCUMENT' ? 'Bekleyen evrak yok' : 'Bekleyen profil değişikliği yok'}
            description="Seçili filtrelere uygun incelenecek kayıt bulunamadı."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      onChange={toggleAll}
                      checked={result.data.filter(d => d.status === 'PENDING').length > 0 && selected.size === result.data.filter(d => d.status === 'PENDING').length}
                      className="rounded border-gray-300 text-primary-500"
                    />
                  </th>
                  <th>Bursiyer</th>
                  <th className="text-center">Kategori</th>

                  {/* Mode Specific Columns */}
                  {queueMode === 'DOCUMENT' ? (
                    <>
                      <th>Belge Türü</th>
                      <th>Dönem</th>
                      <th>Yüklenen Dosya</th>
                    </>
                  ) : (
                    <>
                      <th>Değişen Alan</th>
                      <th>Eski Değer</th>
                      <th>Yeni Değer</th>
                    </>
                  )}

                  <th>Tarih</th>
                  <th>Durum / İşlem</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map(change => (
                  <tr key={change.id}>
                    <td>
                      {change.status === 'PENDING' && (
                        <input
                          type="checkbox"
                          checked={selected.has(change.id)}
                          onChange={() => toggleSelect(change.id)}
                          className="rounded border-gray-300 text-primary-500"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link
                        to={`/admin/students/${change.studentProfileId}`}
                        className="text-primary-600 hover:underline font-semibold text-sm block"
                      >
                        {change.studentProfile?.firstName} {change.studentProfile?.lastName}
                      </Link>
                      <div className="text-[11px] text-gray-400">
                        {change.studentProfile?.department || change.studentProfile?.universityName}
                      </div>
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {(change.studentProfile as any)?.scholarshipCategory?.name ? (
                        <span className="badge badge-gray text-xs">
                          {(change.studentProfile as any).scholarshipCategory.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Document Mode Cells */}
                    {queueMode === 'DOCUMENT' && (
                      <>
                        <td>
                          {getEntityBadge('DOCUMENT')}
                          <span className="text-sm text-gray-900 font-semibold block">
                            {docTypes.find(d => d.code === change.document?.type)?.name || documentTypeLabels[change.document?.type || ''] || change.document?.type || 'Belge'}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-gray-700 font-medium">
                            {change.document?.period?.label || (change.document?.academicYear ? `${change.document.academicYear} ${change.document.semester || ''}` : 'İlk Kayıt / Genel')}
                          </span>
                        </td>
                        <td>
                          {change.document?.filePath ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setPreviewDocument(change); setDrawerOpen(true); }}
                                className="text-primary-600 hover:underline text-xs font-semibold flex items-center gap-1 truncate max-w-xs"
                                title="Önizle ve İncele"
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                {change.document.originalFileName}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Profile Mode Cells */}
                    {queueMode === 'PROFILE' && (
                      <>
                        <td>
                          {getEntityBadge(change.entityType)}
                          <span className="text-sm text-gray-900 font-semibold block">
                            {fieldNameLabels[change.fieldName || ''] || change.fieldName || 'Bilgi Değişikliği'}
                          </span>
                        </td>
                        <td className="text-sm">
                          {change.entityType === 'BANK_INFO' ? (
                            renderBankInfo(change.oldValue)
                          ) : (
                            <span className="text-xs text-gray-500 max-w-48 truncate block">{change.oldValue || '—'}</span>
                          )}
                        </td>
                        <td className="text-sm">
                          {change.entityType === 'BANK_INFO' ? (
                            renderBankInfo(change.newValue)
                          ) : (
                            <span className="text-xs font-semibold text-gray-900 max-w-48 truncate block">{change.newValue || '—'}</span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(change.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}
                    </td>

                    <td className="pr-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1.5">
                        {change.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-full px-2.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Onay Bekliyor
                          </span>
                        ) : change.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-full px-2.5 py-0.5">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                            Onaylandı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 rounded-full px-2.5 py-0.5">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                            Reddedildi
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setManagingChange(change);
                            setIsInlineRejecting(false);
                            setRejectionNote(change.reviewNote || '');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 border border-gray-300 rounded-lg shadow-2xs hover:border-gray-400 transition-all"
                        >
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                          Durumu Düzenle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {result && result.pagination.totalPages > 1 && (
          <div className="card-footer flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Toplam {result.pagination.total} kayıt</span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Önceki</button>
              <span className="text-xs font-semibold">{page} / {result.pagination.totalPages}</span>
              <button className="btn-secondary btn-sm text-xs" onClick={() => setPage(p => p + 1)} disabled={page === result.pagination.totalPages}>Sonraki →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Preview Drawer ── */}
      <DocumentPreviewDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        document={previewDocument}
        onApprove={handleApprove}
        onReject={async (id, note) => {
          await approvalApi.reject(id, note);
          toast.success('Reddedildi.');
          setDrawerOpen(false);
          load();
        }}
      />

      {/* ── Manage Status Modal ── */}
      {managingChange && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0 font-bold border border-primary-100">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Durumu Düzenle & İşlemler</h3>
                  <p className="text-xs text-gray-500">
                    {managingChange.studentProfile?.firstName} {managingChange.studentProfile?.lastName}
                    {(managingChange.studentProfile?.universityName || (managingChange.studentProfile as any)?.university) && ` • ${managingChange.studentProfile?.universityName || (managingChange.studentProfile as any)?.university}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setManagingChange(null);
                  setIsInlineRejecting(false);
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-xl font-medium"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Summary Card */}
              <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Mevcut Durum:</span>
                  {managingChange.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Onay Bekliyor
                    </span>
                  ) : managingChange.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                      Onaylandı
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-0.5">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      Reddedildi
                    </span>
                  )}
                </div>

                {queueMode === 'DOCUMENT' && managingChange.document ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Belge Türü:</span>
                      <span className="font-semibold text-gray-800">
                        {docTypes.find(d => d.code === managingChange.document?.type)?.name || documentTypeLabels[managingChange.document?.type || ''] || managingChange.document?.type || 'Belge'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Dönem:</span>
                      <span className="font-semibold text-gray-800">
                        {managingChange.document.period?.label || (managingChange.document.academicYear ? `${managingChange.document.academicYear} ${managingChange.document.semester || ''}` : 'İlk Kayıt / Genel')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Dosya:</span>
                      <span className="font-medium text-primary-700 truncate max-w-[240px]" title={managingChange.document.originalFileName}>
                        {managingChange.document.originalFileName}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Değişen Alan:</span>
                      <span className="font-semibold text-gray-800">
                        {fieldNameLabels[managingChange.fieldName || ''] || managingChange.fieldName || 'Bilgi Değişikliği'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium block mb-1">Eski Değer:</span>
                      <div className="bg-white p-2 rounded border border-gray-200 text-gray-600">
                        {managingChange.entityType === 'BANK_INFO' ? renderBankInfo(managingChange.oldValue) : (managingChange.oldValue || '—')}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium block mb-1">Yeni Değer:</span>
                      <div className="bg-white p-2 rounded border border-gray-200 font-semibold text-gray-900">
                        {managingChange.entityType === 'BANK_INFO' ? renderBankInfo(managingChange.newValue) : (managingChange.newValue || '—')}
                      </div>
                    </div>
                  </>
                )}

                {managingChange.reviewNote && (
                  <div className="pt-2 border-t border-gray-200/80">
                    <span className="text-rose-600 font-semibold block mb-1">Kayıtlı Red Gerekçesi:</span>
                    <p className="text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 whitespace-pre-wrap">{managingChange.reviewNote}</p>
                  </div>
                )}
              </div>

              {/* Actions Section / Rejection Input Form */}
              {isInlineRejecting ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!rejectionNote.trim()) {
                    toast.error('Lütfen bir red gerekçesi belirtiniz.');
                    return;
                  }
                  setRejecting(true);
                  try {
                    await approvalApi.reject(managingChange.id, rejectionNote.trim());
                    toast.success('Talep reddedildi.');
                    setManagingChange(null);
                    setIsInlineRejecting(false);
                    setRejectionNote('');
                    load();
                  } finally {
                    setRejecting(false);
                  }
                }} className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="form-label text-xs font-bold text-gray-800">
                      Red Gerekçesi <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      className="form-input text-xs"
                      rows={3}
                      required
                      placeholder="Örn: Yüklenen belgede e-imza/barkod bulunmamaktadır veya okunaksızdır."
                      value={rejectionNote}
                      onChange={e => setRejectionNote(e.target.value)}
                      autoFocus
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Bu gerekçe öğrenciye bildirilecek ve panelinde görüntülenecektir.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsInlineRejecting(false)}
                      className="btn-secondary flex-1 text-xs"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={rejecting}
                      className="btn-sm bg-rose-600 hover:bg-rose-700 text-white font-semibold flex-1 text-xs rounded-lg transition-colors flex items-center justify-center"
                    >
                      {rejecting ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Reddi Onayla'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">İşlemler</h4>

                  {/* Document Preview Button */}
                  {queueMode === 'DOCUMENT' && managingChange.document?.filePath && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewDocument(managingChange);
                        setDrawerOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all shadow-2xs"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      Belgeyi İncele (Önizle)
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Approve Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        await handleApprove(managingChange.id);
                        setManagingChange(null);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-2xs"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                      Onayla
                    </button>

                    {/* Reject Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsInlineRejecting(true);
                        setRejectionNote(managingChange.reviewNote || '');
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all shadow-2xs"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
                      Reddet
                    </button>
                  </div>

                  {/* Delete Document Button */}
                  {queueMode === 'DOCUMENT' && managingChange.document?.id && (
                    <div className="pt-2 border-t border-gray-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const docId = managingChange.document!.id!;
                          setManagingChange(null);
                          handleDeleteDocument(docId);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Belgeyi Kalıcı Olarak Sil
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50/80 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setManagingChange(null);
                  setIsInlineRejecting(false);
                }}
                className="btn-secondary text-xs px-4 py-1.5"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Note Modal ── */}
      {rejectingChange && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-200">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 font-bold">
                  !
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Talebi Reddet</h3>
                  <p className="text-[11px] text-rose-700">
                    {rejectingChange.studentProfile?.firstName} {rejectingChange.studentProfile?.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingChange(null)}
                className="w-7 h-7 rounded-lg hover:bg-rose-200/50 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div>
                <label className="form-label text-xs">
                  Red Gerekçesi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className="form-input text-xs"
                  rows={4}
                  required
                  placeholder="Örn: Yüklenen transkriptte güncel dönem notları okunmuyor veya belgede e-imza/barkod bulunmamaktadır."
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Bu gerekçe öğrenciye bildirilecek ve panelinde pop-up olarak görüntülenecektir.
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectingChange(null)}
                  className="btn-secondary flex-1 text-xs"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="btn-sm bg-rose-600 hover:bg-rose-700 text-white font-semibold flex-1 text-xs rounded-lg transition-colors flex items-center justify-center"
                >
                  {rejecting ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Reddi Onayla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Bulk Reject Modal ── */}
      {isBulkRejectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-200">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 font-bold">
                  !
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Toplu Reddet</h3>
                  <p className="text-[11px] text-rose-700">
                    Seçili {selected.size} kayıt reddedilecek.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkRejectModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-rose-200/50 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleBulkRejectSubmit} className="p-6 space-y-4">
              <div>
                <label className="form-label text-xs">
                  Red Gerekçesi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className="form-input text-xs"
                  rows={4}
                  required
                  placeholder="Seçili tüm belgeler/profiller için ortak ret gerekçesi..."
                  value={bulkRejectionNote}
                  onChange={e => setBulkRejectionNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBulkRejectModalOpen(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={bulkRejecting}
                  className="btn-sm bg-rose-600 hover:bg-rose-700 text-white font-semibold flex-1 text-xs rounded-lg transition-colors flex items-center justify-center"
                >
                  {bulkRejecting ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Toplu Reddet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Rejection Note Modal ── */}
      {viewRejectionNote && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-gray-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Red Gerekçesi</h3>
              <button
                onClick={() => setViewRejectionNote(null)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-sm text-rose-800 whitespace-pre-wrap break-words">
                {viewRejectionNote}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                onClick={() => setViewRejectionNote(null)}
                className="btn-secondary text-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Delete Confirmation Modal ── */}
      {documentToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-gray-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 font-bold">
                  !
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Belgeyi Sil</h3>
              </div>
              <button
                onClick={() => setDocumentToDelete(null)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">
                Bu belgeyi sistemden tamamen silmek istediğinize emin misiniz? <br />
                <span className="font-medium text-rose-600 block mt-2">Bu işlem geri alınamaz.</span>
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button
                onClick={() => setDocumentToDelete(null)}
                className="btn-secondary text-xs flex-1"
                disabled={deletingDocumentId !== null}
              >
                İptal
              </button>
              <button
                onClick={confirmDeleteDocument}
                disabled={deletingDocumentId !== null}
                className="btn-sm bg-rose-600 hover:bg-rose-700 text-white font-semibold flex-1 text-xs rounded-lg transition-colors flex items-center justify-center"
              >
                {deletingDocumentId !== null ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
