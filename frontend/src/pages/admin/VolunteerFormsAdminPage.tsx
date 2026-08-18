import { useEffect, useState, useCallback } from 'react';
import { volunteerApi } from '../../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

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
const TARGET_GROUPS = [
  'Eğitim & Gençlik (burslar, özel ders, mentorluk, kariyer gelişimi, liderlik, girişimcilik)',
  'İnsani Yardım & Sosyal Destek (gıda yardımı, afet desteği, temel ihtiyaçlar, aile ve çocuk destekleri)',
  'Dezavantajlı Gruplar (engelliler, dezavantajlı bireyler, kadınlar, gençler, mülteciler)',
  'Çevre, Doğa & Sürdürülebilirlik (iklim değişikliği, geri dönüşüm, sıfır atık, enerji verimliliği)',
  'Teknoloji, Bilim & İnovasyon (yapay zekâ, kodlama, STEM, girişimcilik, dijital dönüşüm)',
  'Toplumsal Gelişim (gönüllülük, sosyal sorumluluk, sosyal girişimcilik, toplumsal dayanışma)',
  'Diğer',
];
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

// ── Detail / Edit Modal ────────────────────────────────────────────────
function FormDetailModal({ form, categories, onClose, onSaved, onDeleted }: {
  form: VolunteerForm;
  categories: any[];
  onClose: () => void;
  onSaved: (updated: VolunteerForm) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editData, setEditData] = useState({
    fullName: form.fullName,
    email: form.email,
    scholarshipCategoryId: form.scholarshipCategoryId || '',
    schoolAndDepartment: form.schoolAndDepartment,
    ngoOrProjectName: form.ngoOrProjectName,
    projectDescription: form.projectDescription,
    targetGroup: form.targetGroup,
    targetGroupOther: form.targetGroupOther || '',
    totalHours: String(form.totalHours),
    personalImpactEvaluation: form.personalImpactEvaluation,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setEditData(d => ({ ...d, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, any> = { ...editData, totalHours: parseInt(editData.totalHours, 10) };
      if (editData.targetGroup !== 'Diğer') payload.targetGroupOther = null;
      const res = await volunteerApi.adminUpdate(form.id, payload);
      onSaved(res.form);
      toast.success('Form güncellendi.');
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="btn-secondary btn-sm flex items-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Düzenle
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">İptal</button>
                <button onClick={handleSave} disabled={saving || deleting} className="btn-primary btn-sm flex items-center gap-1.5">
                  {saving ? <span className="spinner border-white/30 border-t-white w-3.5 h-3.5" /> : null}
                  Kaydet
                </button>
              </div>
            )}
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
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
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ad Soyad" name="fullName" value={editData.fullName} editing={editing} onChange={handleChange} />
            <Field label="E-posta" name="email" value={editData.email} type="email" editing={editing} onChange={handleChange} />
          </div>
          <Field label="Okul ve Bölüm" name="schoolAndDepartment" value={editData.schoolAndDepartment} editing={editing} onChange={handleChange} />

          {/* Program */}
          {editing ? (
            <div>
              <label className="form-label">Gelişim Programı (Grup)</label>
              <select name="scholarshipCategoryId" className="form-select" value={editData.scholarshipCategoryId} onChange={handleChange}>
                <option value="">Seçiniz...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Gelişim Programı</p>
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${getCategoryColor(categories.findIndex(c => c.id === form.scholarshipCategoryId) || 0)}`}>
                {form.scholarshipCategory?.name || 'Belirtilmemiş'}
              </span>
            </div>
          )}

          {/* STK */}
          <Field label="STK / Proje Adı" name="ngoOrProjectName" value={editData.ngoOrProjectName} editing={editing} onChange={handleChange} />

          {/* Project Desc */}
          <TextAreaField
            label="Proje Detayı"
            name="projectDescription"
            value={editData.projectDescription}
            editing={editing}
            onChange={handleChange}
            rows={4}
          />

          {/* Target Group */}
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="form-label">Hedef Grup</label>
                <select name="targetGroup" className="form-select" value={editData.targetGroup} onChange={handleChange}>
                  {TARGET_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {editData.targetGroup === 'Diğer' && (
                <Field label='Diğer (açıklama)' name="targetGroupOther" value={editData.targetGroupOther} editing={editing} onChange={handleChange} />
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Hedef Grup</p>
              <p className="text-sm text-gray-900">{form.targetGroup}</p>
              {form.targetGroupOther && <p className="text-xs text-gray-500 mt-0.5">→ {form.targetGroupOther}</p>}
            </div>
          )}

          {/* Hours */}
          {editing ? (
            <div>
              <label className="form-label">Toplam Saat</label>
              <input type="number" min="1" name="totalHours" className="form-input w-32" value={editData.totalHours} onChange={handleChange} />
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Toplam Saat</p>
              <p className="text-sm font-semibold text-gray-900">{form.totalHours} saat</p>
            </div>
          )}

          {/* Personal Impact */}
          <TextAreaField
            label="Kişisel Etki ve Değişim Değerlendirmesi"
            name="personalImpactEvaluation"
            value={editData.personalImpactEvaluation}
            editing={editing}
            onChange={handleChange}
            rows={3}
          />

          {/* Documents */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Yüklenen Belgeler</p>
            {docs.length === 0 ? (
              <p className="text-sm text-gray-400">Belge yok</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {docs.map(d => (
                  <a
                    key={d.path}
                    href={`${backendUrl}/${d.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-gray-700">{d.label}</p>
                      <p className="text-[11px] text-gray-400 max-w-[150px] truncate">{d.name}</p>
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

// ── Small field helpers ────────────────────────────────────────────────
function Field({ label, name, value, editing, onChange, type = 'text' }: {
  label: string; name: string; value: string;
  editing: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      {editing ? (
        <input type={type} name={name} className="form-input text-sm" value={value} onChange={onChange} />
      ) : (
        <p className="text-sm text-gray-900">{value || '—'}</p>
      )}
    </div>
  );
}

function TextAreaField({ label, name, value, editing, onChange, rows = 3 }: {
  label: string; name: string; value: string;
  editing: boolean; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      {editing ? (
        <textarea name={name} className="form-textarea text-sm" rows={rows} value={value} onChange={onChange} />
      ) : (
        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{value || '—'}</p>
      )}
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

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      // Import adminApi locally if not at top level to avoid circular issues, or use a relative path if imported at top
      const { adminApi } = await import('../../api');
      const [cats, perds] = await Promise.all([
        adminApi.listScholarshipCategories(),
        adminApi.listPeriods()
      ]);
      setCategories(cats);
      // Only show periods where volunteer form is/was allowed
      setPeriods(perds.filter((p: any) => p.isVolunteerFormOpen || p.type === 'VOLUNTEER_FORM'));

      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search.trim()) params.search = search.trim();
      if (programFilter) params.scholarshipCategoryId = programFilter;
      if (targetGroupFilter) params.targetGroup = targetGroupFilter;
      if (periodFilter) params.periodId = periodFilter;
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

  function handleSaved(updated: VolunteerForm) {
    setSelectedForm(updated);
    setResult(r => r ? {
      ...r,
      data: r.data.map(f => f.id === updated.id ? { ...f, ...updated } : f),
    } : r);
  }

  function handleDeleted(id: string) {
    setSelectedForm(null);
    setResult(r => r ? {
      ...r,
      data: r.data.filter(f => f.id !== id),
      pagination: { ...r.pagination, total: r.pagination.total - 1 }
    } : r);
  }

  async function handleExportCSV() {
    try {
      const params: Record<string, string> = { limit: '1000' };
      if (search.trim()) params.search = search.trim();
      if (programFilter) params.scholarshipCategoryId = programFilter;
      if (targetGroupFilter) params.targetGroup = targetGroupFilter;
      if (periodFilter) params.periodId = periodFilter;
      
      const res = await volunteerApi.adminList(params);
      const allForms = res.data;
      
      const headers = ['Öğrenci', 'E-posta', 'Program', 'STK/Proje', 'Okul/Bölüm', 'Hedef Grup', 'Diğer Açıklama', 'Saat', 'Kişisel Etki', 'Tarih'];
      const csvRows = [headers.join(',')];
      
      allForms.forEach((form: VolunteerForm) => {
        const row = [
          form.studentProfile ? `${form.studentProfile.firstName} ${form.studentProfile.lastName}` : form.fullName,
          form.email,
          form.scholarshipCategory?.name || 'Belirtilmemiş',
          form.ngoOrProjectName,
          form.schoolAndDepartment,
          form.targetGroup,
          form.targetGroupOther || '',
          form.totalHours,
          form.personalImpactEvaluation.replace(/[\r\n,]/g, ' '),
          format(new Date(form.createdAt), 'dd.MM.yyyy HH:mm')
        ];
        csvRows.push(row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
      });
      
      const csvString = csvRows.join('\n');
      const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `gonulluluk_formlari_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error('Dışa aktarma başarısız.');
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
          <button onClick={handleExportCSV} className="btn-secondary btn-sm flex items-center gap-1.5">
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
            <option key={p.id} value={p.id}>{p.label}</option>
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
          {TARGET_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
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

      {/* Detail / Edit Modal */}
      {selectedForm && (
        <FormDetailModal
          form={selectedForm}
          categories={categories}
          onClose={() => setSelectedForm(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
