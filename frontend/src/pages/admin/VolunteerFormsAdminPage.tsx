import { useEffect, useState, useCallback } from 'react';
import { volunteerApi } from '../../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import VolunteerFormSettingsModal from '../../components/VolunteerFormSettingsModal';

// ── Types ─────────────────────────────────────────────────────────────
interface VolunteerForm {
  id: string;
  fullName: string;
  email: string;
  scholarshipCategoryId?: string;
  scholarshipCategory?: { id: string; name: string };
  schoolAndDepartment: string;
  ngoOrProjectName: string;
  projectDescription: string;
  targetGroup: string;
  targetGroupOther?: string | null;
  totalHours: number;
  personalImpactEvaluation: string;
  document1Path: string;
  document1OriginalName: string;
  document2Path?: string | null;
  document2OriginalName?: string | null;
  document3Path?: string | null;
  document3OriginalName?: string | null;
  createdAt: string;
  updatedAt: string;
  studentProfile?: {
    id: string;
    firstName: string;
    lastName: string;
    user?: { tcKimlikNo?: string };
  };
}

interface PaginatedResponse {
  data: VolunteerForm[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ── Constants ─────────────────────────────────────────────────────────

const PROGRAM_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
];

function getCategoryColor(index: number) {
  return PROGRAM_COLORS[index % PROGRAM_COLORS.length];
}

// ── File Link ─────────────────────────────────────────────────────────
function FileLink({ path, name }: { path: string; name: string }) {
  const backendUrl = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
  const url = `${backendUrl}/${path}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 hover:underline max-w-[180px]"
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="truncate">{name}</span>
    </a>
  );
}

// ── Detail Modal (Read-Only) ─────────────────────────────────────────
function FormDetailModal({ form, categories, schema, onClose, onDeleted }: {
  form: VolunteerForm;
  categories: any[];
  schema: any;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm('Bu formu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    setDeleting(true);
    try {
      await volunteerApi.adminDelete(form.id);
      toast.success('Form silindi.');
      onDeleted(form.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Silme işlemi başarısız.');
      setDeleting(false);
    }
  }

  const backendUrl = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
  const docs = [
    form.document1Path ? { path: form.document1Path, name: form.document1OriginalName, label: 'Belge 1' } : null,
    form.document2Path ? { path: form.document2Path, name: form.document2OriginalName!, label: 'Belge 2' } : null,
    form.document3Path ? { path: form.document3Path, name: form.document3OriginalName!, label: 'Belge 3' } : null,
  ].filter(Boolean) as { path: string; name: string; label: string }[];

  let dynamicFieldsData: any = {};
  try {
    if ((form as any).dynamicFields) {
      dynamicFieldsData = JSON.parse((form as any).dynamicFields);
    }
  } catch (e) {}

  let otherDocs: any[] = [];
  try {
    if ((form as any).otherDocuments) {
      otherDocs = JSON.parse((form as any).otherDocuments);
    }
  } catch(e) {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Gönüllülük Formu Detayı</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {form.studentProfile ? `${form.studentProfile.firstName} ${form.studentProfile.lastName}` : form.fullName}
              {' · '}
              {format(new Date(form.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg ml-2 border border-transparent hover:border-red-200 transition-colors"
              title="Formu Sil"
            >
              {deleting ? (
                <span className="spinner border-red-500/30 border-t-red-500 w-5 h-5" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                </svg>
              )}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-1">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 bg-gray-50/30 space-y-6">
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-5 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              Form Yanıtları
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Program */}
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Gelişim Programı</p>
                <span className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-full ${getCategoryColor(categories.findIndex(c => c.id === form.scholarshipCategoryId) || 0)}`}>
                  {form.scholarshipCategory?.name || 'Belirtilmemiş'}
                </span>
              </div>

              {/* Dynamic Fields from Schema */}
              {schema?.fields?.map((f: any) => {
                const val = f.isDefault ? (form as any)[f.id] : dynamicFieldsData[f.id];
                if (val === undefined || val === null || val === '') return null;
                
                const isLongText = f.type === 'textarea';
                
                return (
                  <div key={f.id} className={isLongText ? 'md:col-span-2' : ''}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">{f.label}</p>
                    <div className={`text-sm text-gray-800 leading-relaxed bg-gray-50/50 rounded-lg p-3 border border-gray-100/50 break-words ${isLongText ? 'max-h-48 overflow-y-auto' : 'max-h-32 overflow-y-auto'}`}>
                      <p className="whitespace-pre-wrap">{val}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-5 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              Yüklenen Belgeler
            </h3>
            
            {docs.length === 0 && otherDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <svg viewBox="0 0 24 24" className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16z" />
                  <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
                </svg>
                <p className="text-sm">Belge yüklenmemiş</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.map(d => (
                  <a
                    key={d.path}
                    href={`${backendUrl}/${d.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-primary-50 hover:border-primary-200 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center group-hover:bg-primary-100 group-hover:border-primary-200 group-hover:text-primary-600 transition-colors">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{d.label}</p>
                      <p className="text-[11px] text-gray-500 truncate">{d.name}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



// ── Main Page ─────────────────────────────────────────────────────────
export default function VolunteerFormsAdminPage() {
  const [result, setResult] = useState<PaginatedResponse | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [targetGroupFilter, setTargetGroupFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedForm, setSelectedForm] = useState<VolunteerForm | null>(null);
  const [schema, setSchema] = useState<any>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      // Import adminApi locally if not at top level to avoid circular issues, or use a relative path if imported at top
      const { adminApi } = await import('../../api');
      const [cats, perds, schemaData] = await Promise.all([
        adminApi.listScholarshipCategories(),
        adminApi.listPeriods(),
        volunteerApi.getSettingsSchema()
      ]);
      setCategories(cats);
      setSchema(schemaData);
      
      const uniquePeriodsMap = new Map();
      perds.forEach((p: any) => {
        if (!uniquePeriodsMap.has(p.label)) {
          uniquePeriodsMap.set(p.label, p);
        }
      });
      setPeriods(Array.from(uniquePeriodsMap.values()));

      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search.trim()) params.search = search.trim();
      if (programFilter) params.scholarshipCategoryId = programFilter;
      if (targetGroupFilter) params.targetGroup = targetGroupFilter;
      if (periodFilter) params.periodLabel = periodFilter;
      const data = await volunteerApi.adminList(params);
      setResult(data);
    } catch {
      toast.error('Formlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [search, programFilter, targetGroupFilter, periodFilter, page]);

  useEffect(() => { loadForms(); }, [loadForms]);

  // Debounce search
  useEffect(() => {
    setPage(1);
  }, [search, programFilter, targetGroupFilter, periodFilter]);


  function handleDeleted(id: string) {
    setSelectedForm(null);
    setResult(r => r ? {
      ...r,
      data: r.data.filter(f => f.id !== id),
      pagination: { ...r.pagination, total: r.pagination.total - 1 }
    } : r);
  }

  async function handleExportExcel() {
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (programFilter) params.scholarshipCategoryId = programFilter;
      if (targetGroupFilter) params.targetGroup = targetGroupFilter;
      if (periodFilter) params.periodLabel = periodFilter;
      
      const blob = await volunteerApi.exportExcel(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Gonulluluk_Formlari_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Excel dosyası başarıyla indirildi.');
    } catch {
      toast.error('Excel dışa aktarma başarısız.');
    }
  }

  const forms = result?.data ?? [];
  const total = result?.pagination.total ?? 0;
  const totalPages = result?.pagination.totalPages ?? 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gönüllülük Formları</h1>
        </div>
        <div className="flex items-center gap-4">
          {!loading && (
            <div className="text-sm text-gray-500">
              Toplam <span className="font-semibold text-gray-900">{total}</span> form
            </div>
          )}
          <button onClick={() => setIsSettingsOpen(true)} className="btn-secondary btn-sm flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Form Ayarları
          </button>
          <button onClick={handleExportExcel} className="btn-secondary btn-sm flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Excel'e Aktar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          className="form-select text-sm w-44"
          value={periodFilter}
          onChange={e => setPeriodFilter(e.target.value)}
        >
          <option value="">Tüm Dönemler</option>
          {periods.map(p => (
            <option key={p.id} value={p.label}>{p.label}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Ad, STK, okul ile ara..."
            className="form-input pl-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select text-sm w-52"
          value={programFilter}
          onChange={e => setProgramFilter(e.target.value)}
        >
          <option value="">Tüm Programlar</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="form-select text-sm w-52"
          value={targetGroupFilter}
          onChange={e => setTargetGroupFilter(e.target.value)}
        >
          <option value="">Tüm Hedef Gruplar</option>
          {(
            schema?.fields?.find((f: any) => f.id === 'targetGroup')?.options
              ? schema.fields.find((f: any) => f.id === 'targetGroup').options.split(',').map((s: string) => s.trim()).filter(Boolean)
              : ['Çocuklar', 'Gençler', 'Kadınlar', 'Yaşlılar', 'Engelliler', 'Hayvanlar', 'Çevre', 'Toplumsal Gelişim (gönüllülük sosyal sorumluluk sosyal girişimcilik toplumsal dayanışma)', 'Diğer']
          ).map((g: string) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="spinner border-gray-300 border-t-primary-500 w-7 h-7" />
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Henüz kayıt yok.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Öğrenci</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Program</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">STK / Proje</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Saat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Belgeler</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gönderim</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms.map(form => {
                const docCount = [form.document1Path, form.document2Path, form.document3Path].filter(Boolean).length;
                const studentName = form.studentProfile
                  ? `${form.studentProfile.firstName} ${form.studentProfile.lastName}`
                  : form.fullName;
                return (
                  <tr key={form.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{studentName}</p>
                      <p className="text-xs text-gray-400">{form.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${getCategoryColor(categories.findIndex(c => c.id === form.scholarshipCategoryId) || 0)}`}>
                        {form.scholarshipCategory?.name || 'Belirtilmemiş'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 max-w-[200px] truncate">{form.ngoOrProjectName}</p>
                      <p className="text-xs text-gray-400 max-w-[200px] truncate">{form.schoolAndDepartment}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{form.totalHours}</span>
                      <span className="text-gray-400 text-xs ml-0.5">sa</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {[
                          { path: form.document1Path, name: form.document1OriginalName },
                          { path: form.document2Path, name: form.document2OriginalName },
                          { path: form.document3Path, name: form.document3OriginalName },
                        ].filter(d => d.path).map((d, i) => (
                          <FileLink key={i} path={d.path!} name={d.name!} />
                        ))}
                        {docCount === 0 && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(form.createdAt), 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedForm(form)}
                        className="btn-secondary btn-sm text-xs"
                      >
                        İncele
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Sayfa {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Önceki
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedForm && (
        <FormDetailModal
          form={selectedForm}
          categories={categories}
          schema={schema}
          onClose={() => setSelectedForm(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <VolunteerFormSettingsModal
          onClose={() => {
            setIsSettingsOpen(false);
            loadForms();
          }}
        />
      )}
    </div>
  );
}
