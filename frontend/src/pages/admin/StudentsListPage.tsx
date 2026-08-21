import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import CategoryManagerModal from '../../components/CategoryManagerModal';
import { adminApi } from '../../api';
import type { StudentProfile, PaginatedResponse } from '../../types';
import toast from 'react-hot-toast';


export default function StudentsListPage() {
  const [result, setResult] = useState<PaginatedResponse<StudentProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasPending, setHasPending] = useState(false);
  const [scholarshipGroup, setScholarshipGroup] = useState('');
  const [page, setPage] = useState(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [sendingReminders, setSendingReminders] = useState(false);

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pastedTcs, setPastedTcs] = useState('');
  const [modalGroup, setModalGroup] = useState('');
  const [isNewStudentBulk, setIsNewStudentBulk] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdResults, setCreatedResults] = useState<any[]>([]);

  // Excel Import
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isNewStudentExcel, setIsNewStudentExcel] = useState(true);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelResults, setExcelResults] = useState<any>(null);
  const [excelResultFilter, setExcelResultFilter] = useState<'all' | 'created' | 'existing' | 'error'>('all');
  const [selectedErrorDetail, setSelectedErrorDetail] = useState<any | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Student Delete
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Single Create
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ tcKimlikNo: '', firstName: '', lastName: '', scholarshipCategoryId: '', isNewStudent: true });
  const [createResult, setCreateResult] = useState<{ tcKimlikNo?: string; password?: string; error?: string } | null>(null);

  // Export Modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [includeGraduates, setIncludeGraduates] = useState(false);

  // States for Mentor assignment modal
  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [selectedStudentForMentor, setSelectedStudentForMentor] = useState<StudentProfile | null>(null);
  const [mentorsList, setMentorsList] = useState<any[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [assigningMentor, setAssigningMentor] = useState(false);

  const [categories, setCategories] = useState<import('../../types').ScholarshipCategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Graduation modal
  const [graduationModalOpen, setGraduationModalOpen] = useState(false);
  const [graduatingStudentIds, setGraduatingStudentIds] = useState<string[]>([]);
  const [graduationYear, setGraduationYear] = useState<number>(new Date().getFullYear());
  const [graduating, setGraduating] = useState(false);

  // Load mentors and categories once
  useEffect(() => {
    adminApi.listMentors().then(setMentorsList).catch(console.error);
    adminApi.listScholarshipCategories().then(setCategories).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '20' };
    if (search) params.search = search;
    if (hasPending) params.hasPending = 'true';
    if (scholarshipGroup) params.scholarshipGroup = scholarshipGroup;
    try {
      const data = await adminApi.listStudents(params);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [search, hasPending, scholarshipGroup, page]);

  useEffect(() => { load(); }, [load]);



  async function handleBulkPasteCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!pastedTcs.trim()) {
      toast.error('Lütfen en az bir TC Kimlik Numarası girin.');
      return;
    }
    setCreating(true);
    try {
      const res = await adminApi.bulkCreateJson({
        tcs: pastedTcs,
        scholarshipCategoryId: modalGroup,
        isNewStudent: isNewStudentBulk,
      });
      setCreatedResults(res.data);
      toast.success('Bursiyer oluşturma işlemi tamamlandı.');
      load();
    } catch (err) {
      // Handled by API error interceptor
    } finally {
      setCreating(false);
    }
  }

  async function handleExcelImport(e: React.FormEvent) {
    e.preventDefault();
    if (!excelFile) {
      toast.error('Lütfen bir Excel dosyası seçin.');
      return;
    }
    setExcelImporting(true);
    try {
      const res = await adminApi.importExcel(excelFile, isNewStudentExcel);
      setExcelResults(res);
      if (res.summary.created > 0) {
        toast.success(`${res.summary.created} bursiyer başarıyla oluşturuldu.`);
      }
      if (res.summary.errors > 0) {
        toast.error(`${res.summary.errors} satırda hata oluştu.`);
      }
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Excel aktarımı sırasında hata oluştu.');
    } finally {
      setExcelImporting(false);
    }
  }

  async function handleDownloadExcelTemplate() {
    setDownloadingTemplate(true);
    try {
      const blob = await adminApi.getExcelTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bursiyer-aktarma-sablonu.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel şablonu indirildi.');
    } catch {
      toast.error('Şablon indirilemedi.');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function confirmDeleteStudent() {
    if (!studentToDelete) return;
    setDeletingStudent(true);
    try {
      await adminApi.deleteStudent(studentToDelete.id);
      toast.success(`${studentToDelete.firstName || ''} ${studentToDelete.lastName || ''} başarıyla silindi.`);
      setStudentToDelete(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bursiyer silinirken bir hata oluştu.');
    } finally {
      setDeletingStudent(false);
    }
  }

  function downloadExcelResults() {
    if (!excelResults?.data?.length) return;
    const header = 'SATIR;TC KİMLİK;AD;SOYAD;ŞİFRE;DURUM;AÇIKLAMA / HATA DETAYI';
    const rows = excelResults.data.map((r: any) => {
      const statusText = r.status === 'created' ? 'Oluşturuldu' : r.status === 'existing' ? 'Zaten Kayıtlı' : 'Kaydedilemedi (Hata)';
      const reasonText = (r.error || (r.status === 'created' ? 'Başarıyla kaydedildi' : 'Sistemde zaten kayıtlı')).replace(/"/g, '""');
      return `"${r.row}";"${r.tcKimlikNo}";"${r.firstName || ''}";"${r.lastName || ''}";"${r.password || ''}";"${statusText}";"${reasonText}"`;
    });
    const fileContent = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + fileContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excel-aktarim-sonuc-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreateSingle(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await adminApi.createStudent({
        tcKimlikNo: newStudentForm.tcKimlikNo,
        firstName: newStudentForm.firstName,
        lastName: newStudentForm.lastName,
        scholarshipCategoryId: newStudentForm.scholarshipCategoryId || undefined,
        isNewStudent: newStudentForm.isNewStudent,
      });
      setCreateResult({ tcKimlikNo: res.tcKimlikNo, password: res.password });
      load();
      toast.success('Bursiyer oluşturuldu.');
    } catch (err: any) {
      setCreateResult({ error: err.response?.data?.message || 'Bir hata oluştu.' });
    } finally {
      setCreating(false);
    }
  }

  function downloadCreatedResults() {
    if (!createdResults.length) return;
    const header = 'TC KİMLİK;ŞİFRE';
    const rows = createdResults
      .filter(r => r.status === 'created')
      .map(r => `${r.tcKimlikNo};${r.password || ''}`);
    const fileContent = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + fileContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bursiyer-sifreler-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openMentorModal(student: StudentProfile) {
    setSelectedStudentForMentor(student);
    setSelectedMentorId((student as any).mentor?.id || '');
    setMentorModalOpen(true);
  }

  async function handleAssignMentor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentForMentor) return;
    setAssigningMentor(true);
    try {
      await adminApi.assignMentor(selectedStudentForMentor.id, selectedMentorId || null);
      toast.success('Mentör ataması güncellendi.');
      setMentorModalOpen(false);
      load();
    } catch (err) {
      // handled by interceptor
    } finally {
      setAssigningMentor(false);
    }
  }

  const [exporting, setExporting] = useState(false);

  function handleExport() {
    setExportModalOpen(true);
  }

  async function submitExport() {
    setExporting(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (hasPending) params.hasPending = 'true';
      if (scholarshipGroup) params.scholarshipGroup = scholarshipGroup;
      if (includeGraduates) params.includeGraduates = 'true';

      const blob = await adminApi.exportStudentsReport(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bursiyer-tablosu-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Bursiyer tablosu başarıyla indirildi.');
      setExportModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Excel dosyası indirilirken bir hata oluştu.');
    } finally {
      setExporting(false);
    }
  }

  async function handleConfirmGraduation() {
    if (graduatingStudentIds.length === 0) return;
    setGraduating(true);
    try {
      await adminApi.graduateStudents({
        studentIds: graduatingStudentIds,
        graduationYear: Number(graduationYear),
      });
      toast.success(`${graduatingStudentIds.length} öğrenci başarıyla ${graduationYear} mezunlarına aktarıldı.`);
      setGraduationModalOpen(false);
      setGraduatingStudentIds([]);
      setSelectedStudentIds(new Set());
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Mezuniyete aktarma sırasında hata oluştu.');
    } finally {
      setGraduating(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!result) return;
    const allIds = result.data.map(p => p.id);
    if (selectedStudentIds.size === allIds.length) setSelectedStudentIds(new Set());
    else setSelectedStudentIds(new Set(allIds));
  }

  async function handleBulkRemind() {
    if (selectedStudentIds.size === 0) return;
    setSendingReminders(true);
    try {
      const res = await adminApi.bulkRemindStudents(Array.from(selectedStudentIds));
      toast.success(res?.message || `${selectedStudentIds.size} öğrenciye belge hatırlatması gönderildi.`);
      setSelectedStudentIds(new Set());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Hatırlatma gönderilirken hata oluştu.');
    } finally {
      setSendingReminders(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="page-title">Bursiyerler</h1>
          <p className="page-subtitle">{result?.pagination.total ?? 0} bursiyer kayıtlı</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExport} disabled={exporting} className="btn-secondary btn-sm text-green-700 border-green-200 hover:bg-green-50 shadow-2xs font-semibold">
            {exporting ? (
              <span className="spinner w-4 h-4 border-green-700 mr-1" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            )}
            Excel İndir
          </button>
          <button onClick={() => setIsCategoryModalOpen(true)} className="btn-secondary btn-sm text-gray-700 shadow-2xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
            Kategoriler
          </button>
          <button onClick={() => { setCreateModalOpen(true); setCreateResult(null); setNewStudentForm({ tcKimlikNo: '', firstName: '', lastName: '', scholarshipCategoryId: '', isNewStudent: true }); }} className="btn-primary btn-sm shadow-2xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Bursiyer Ekle
          </button>
          <button onClick={() => { setBulkModalOpen(true); setCreatedResults([]); setPastedTcs(''); }} className="btn-secondary btn-sm shadow-2xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Toplu TC Yapıştır
          </button>
          <button onClick={() => { setExcelModalOpen(true); setExcelResults(null); setExcelFile(null); }} className="btn-secondary btn-sm shadow-2xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
            Excel'den Aktar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              className="form-input pl-9 text-xs"
              placeholder="Ad, soyad veya TC ile ara..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="form-select text-xs max-w-[200px]"
            value={scholarshipGroup}
            onChange={(e) => { setScholarshipGroup(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Burs Grupları</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              checked={hasPending}
              onChange={(e) => { setHasPending(e.target.checked); setPage(1); }}
            />
            Onay bekleyenler
          </label>

          {selectedStudentIds.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">{selectedStudentIds.size} seçili</span>
              <button
                onClick={handleBulkRemind}
                disabled={sendingReminders}
                className="btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-xs shadow-xs"
              >
                {sendingReminders ? <span className="spinner w-4 h-4 border-white mr-1" /> : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                )}
                Hatırlatma Gönder
              </button>
              <button
                type="button"
                onClick={() => {
                  setGraduatingStudentIds(Array.from(selectedStudentIds));
                  setGraduationYear(new Date().getFullYear());
                  setGraduationModalOpen(true);
                }}
                className="btn-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs px-2.5 py-1.5 transition-colors"
              >
                <span>🎓 Seçilenleri Mezun Et ({selectedStudentIds.size})</span>
              </button>
            </div>
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
            title="Bursiyer bulunamadı"
            description="Arama kriterlerinizi değiştirin veya yeni bursiyer ekleyin."
          />
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-8 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      checked={!!result?.data.length && selectedStudentIds.size === result.data.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Ad Soyad</th>
                  <th className="text-center">TC Kimlik No</th>
                  <th>Üniversite / Bölüm</th>
                  <th className="text-center">Sınıf</th>
                  <th className="text-center">Kategori</th>
                  <th className="text-center">Belge Durumu</th>
                  <th className="text-center">Mentör</th>
                  <th className="text-center">Onay</th>
                  <th className="text-center w-24">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((profile: any) => (
                  <tr key={profile.id}>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        checked={selectedStudentIds.has(profile.id)}
                        onChange={() => toggleSelect(profile.id)}
                      />
                    </td>
                    <td className="font-semibold text-gray-900 whitespace-nowrap">
                      <Link
                        to={`/admin/students/${profile.id}`}
                        className="hover:text-primary-600 hover:underline transition-colors block"
                      >
                        {profile.firstName || profile.lastName ? `${profile.firstName} ${profile.lastName}`.trim() : 'İsimsiz Öğrenci'}
                      </Link>
                    </td>
                    <td className="text-center text-gray-600 font-mono text-xs whitespace-nowrap">
                      {profile.user?.tcKimlikNo || '—'}
                    </td>
                    <td>
                      <div className="text-gray-900 text-xs font-semibold leading-tight">{profile.universityName || '—'}</div>
                      <div className="text-gray-500 text-[11px] leading-tight mt-0.5">{profile.department}</div>
                    </td>
                    <td className="text-center text-xs font-medium text-gray-700 whitespace-nowrap">{profile.grade ? `${profile.grade}. Sınıf` : '—'}</td>
                    <td className="text-center whitespace-nowrap">
                      {profile.scholarshipCategory ? (
                        <span className="badge badge-gray text-xs">{profile.scholarshipCategory.name}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {profile.documentStatus ? (
                        profile.documentStatus.completed ? (
                          <span className="badge badge-approved bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs">🟢 Tamam</span>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            {profile.documentStatus.missingCount > 0 && (
                              <span className="badge bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2 py-0.5 font-medium inline-flex items-center gap-1">
                                🔴 {profile.documentStatus.missingCount} Eksik
                              </span>
                            )}
                            {profile.documentStatus.pendingCount > 0 && (
                              <span className="badge bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2 py-0.5 font-medium inline-flex items-center gap-1">
                                🟡 {profile.documentStatus.pendingCount} Bekliyor
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {(profile as any).mentor ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-semibold text-gray-900">{(profile as any).mentor.firstName} {(profile as any).mentor.lastName}</span>
                          <button onClick={() => openMentorModal(profile)} className="text-[10px] text-primary-600 hover:underline mt-0.5">Değiştir</button>
                        </div>
                      ) : (
                        <button onClick={() => openMentorModal(profile)} className="btn-ghost btn-sm text-[11px] px-2 py-0.5">Atama Yap</button>
                      )}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {(profile as any)._count?.approvableChanges > 0 ? (
                        <span className="badge bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2 py-0.5 font-medium inline-flex items-center justify-center">
                          {(profile as any)._count.approvableChanges} bekliyor
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setGraduatingStudentIds([profile.id]);
                            setGraduationYear(new Date().getFullYear());
                            setGraduationModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 rounded-lg border border-indigo-100 hover:border-indigo-300 transition-all text-sm shadow-2xs"
                          title="Öğrenciyi Mezuna Aktar"
                        >
                          🎓
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(profile)}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg border border-rose-100 hover:border-rose-300 transition-all shadow-2xs"
                          title="Bursiyeri Sil"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                          </svg>
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
            <span className="text-sm text-gray-500">
              {((page - 1) * 20) + 1}–{Math.min(page * 20, result.pagination.total)} / {result.pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
              >← Önceki</button>
              <span className="text-sm text-gray-600">{page} / {result.pagination.totalPages}</span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page === result.pagination.totalPages}
              >Sonraki →</button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Upload Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Toplu Bursiyer Ekle (TC ile)</h3>
              <button onClick={() => setBulkModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {createdResults.length === 0 ? (
              <form onSubmit={handleBulkPasteCreate} className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
                <div>
                  <label className="form-label mb-1">Burs Grubu</label>
                  <select
                    className="form-select text-sm"
                    value={modalGroup}
                    onChange={(e) => setModalGroup(e.target.value)}
                    required
                  >
                    <option value="">Grup Seçin...</option>
                    {categories.filter(c => c.isActive).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-3 mb-3">
                  <input
                    type="checkbox"
                    id="isNewStudentBulk"
                    checked={isNewStudentBulk}
                    onChange={(e) => setIsNewStudentBulk(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isNewStudentBulk" className="text-sm font-medium text-gray-700">
                    Yeni Bursiyerler (İlk Kayıt Belgeleri İstenir)
                  </label>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="form-label mb-1">TC Kimlik Numaraları (Alt alta, her satıra bir adet, maks 150 adet)</label>
                  <textarea
                    className="form-textarea flex-1 text-sm font-mono p-3 resize-none min-h-[200px]"
                    placeholder="10091231962&#10;20091231963&#10;..."
                    value={pastedTcs}
                    onChange={(e) => setPastedTcs(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-secondary flex-1">İptal</button>
                  <button type="submit" className="btn-primary flex-1" disabled={creating}>
                    {creating ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Bursiyerleri Oluştur'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3 flex items-start gap-2.5">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  <span>Toplu bursiyer oluşturma tamamlandı! Aşağıdaki şifreleri kaydetmeyi veya listeyi indirmeyi unutmayın.</span>
                </div>

                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>TC Kimlik No</th>
                        <th>Geçici Şifre</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createdResults.map((r, i) => (
                        <tr key={i}>
                          <td className="font-mono text-sm font-medium">{r.tcKimlikNo}</td>
                          <td className="font-mono text-sm text-primary-600 font-bold bg-primary-50 px-2 py-1 rounded select-all">{r.password || '—'}</td>
                          <td>
                            {r.status === 'created' && <span className="text-green-600 font-medium text-xs">Oluşturuldu</span>}
                            {r.status === 'existing' && <span className="text-amber-600 font-medium text-xs">Zaten Kayıtlı</span>}
                            {r.status === 'error' && <span className="text-red-600 font-medium text-xs" title={r.error}>Hata: {r.error}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={downloadCreatedResults} className="btn-secondary flex-1">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    Şifreleri Dosya Olarak İndir (CSV)
                  </button>
                  <button onClick={() => setBulkModalOpen(false)} className="btn-primary flex-1">Kapat</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {excelModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Excel'den Bursiyer Aktar</h3>
                  <p className="text-xs text-gray-500">Tüm bilgileriyle toplu öğrenci kaydı oluşturun</p>
                </div>
              </div>
              <button onClick={() => setExcelModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {!excelResults ? (
              <form onSubmit={handleExcelImport} className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
                {/* Template Download */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                  <div className="flex-1">
                    <p className="text-sm text-blue-800 font-medium">Doğru formatta veri yüklemek için önce şablonu indirin.</p>
                    <p className="text-xs text-blue-600 mt-1">Mavi başlıklar zorunlu, gri başlıklar opsiyonel alanlardır.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    disabled={downloadingTemplate}
                    className="btn-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 whitespace-nowrap shadow-xs"
                  >
                    {downloadingTemplate ? <span className="spinner w-3.5 h-3.5 border-white/30 border-t-white" /> : (
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    )}
                    Şablon İndir
                  </button>
                </div>

                {/* File Upload */}
                <div>
                  <label className="form-label mb-1">Excel Dosyası (.xlsx)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                      className="form-input text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer"
                      required
                    />
                  </div>
                  {excelFile && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                      {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                {/* New student toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isNewStudentExcel"
                    checked={isNewStudentExcel}
                    onChange={(e) => setIsNewStudentExcel(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isNewStudentExcel" className="text-sm font-medium text-gray-700">
                    Yeni Bursiyerler (İlk Kayıt Belgeleri İstenir)
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setExcelModalOpen(false)} className="btn-secondary flex-1">İptal</button>
                  <button type="submit" className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500" disabled={excelImporting || !excelFile}>
                    {excelImporting ? (
                      <><span className="spinner border-white/30 border-t-white w-4 h-4 mr-1" /> Aktarılıyor...</>
                    ) : (
                      <><svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg> Excel'den Aktar</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setExcelResultFilter('all')}
                    className={`border rounded-lg p-2.5 text-center transition ${excelResultFilter === 'all'
                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    <div className="text-xl font-bold text-gray-800">{excelResults.summary.total}</div>
                    <div className="text-xs text-gray-600 font-medium">Toplam Satır</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExcelResultFilter('created')}
                    className={`border rounded-lg p-2.5 text-center transition ${excelResultFilter === 'created'
                        ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70'
                      }`}
                  >
                    <div className="text-xl font-bold text-emerald-700">{excelResults.summary.created}</div>
                    <div className="text-xs text-emerald-700 font-medium">✓ Oluşturuldu</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExcelResultFilter('existing')}
                    className={`border rounded-lg p-2.5 text-center transition ${excelResultFilter === 'existing'
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-300'
                        : 'bg-amber-50 border-amber-200 hover:bg-amber-100/70'
                      }`}
                  >
                    <div className="text-xl font-bold text-amber-700">{excelResults.summary.existing}</div>
                    <div className="text-xs text-amber-700 font-medium">⚠ Zaten Kayıtlı</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExcelResultFilter('error')}
                    className={`border rounded-lg p-2.5 text-center transition ${excelResultFilter === 'error'
                        ? 'bg-red-100 border-red-500 ring-2 ring-red-300'
                        : 'bg-red-50 border-red-200 hover:bg-red-100/70'
                      }`}
                  >
                    <div className="text-xl font-bold text-red-700">{excelResults.summary.errors}</div>
                    <div className="text-xs text-red-700 font-medium">✗ Kaydedilemeyen</div>
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExcelResultFilter('all')}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${excelResultFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      Tümü ({excelResults.data.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelResultFilter('created')}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${excelResultFilter === 'created' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                    >
                      Başarılı ({excelResults.summary.created})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelResultFilter('existing')}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${excelResultFilter === 'existing' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                    >
                      Zaten Kayıtlı ({excelResults.summary.existing})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelResultFilter('error')}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${excelResultFilter === 'error' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                    >
                      Kaydedilmeyen / Hatalı ({excelResults.summary.errors})
                    </button>
                  </div>
                </div>

                {/* Results Table */}
                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg max-h-[380px]">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th className="text-center w-12">Satır</th>
                        <th className="w-28">TC Kimlik No</th>
                        <th className="w-36">Ad Soyad</th>
                        <th className="w-28">Geçici Şifre</th>
                        <th className="w-32">Durum</th>
                        <th>Açıklama / Hata Sebebi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelResults.data
                        .filter((r: any) => {
                          if (excelResultFilter === 'all') return true;
                          if (excelResultFilter === 'created') return r.status === 'created';
                          if (excelResultFilter === 'existing') return r.status === 'existing';
                          if (excelResultFilter === 'error') return r.status === 'error';
                          return true;
                        })
                        .map((r: any, i: number) => (
                          <tr key={i} className={r.status === 'error' ? 'bg-red-50/40' : r.status === 'existing' ? 'bg-amber-50/30' : ''}>
                            <td className="text-center text-xs text-gray-500 font-mono">{r.row}</td>
                            <td className="font-mono text-xs font-semibold">{r.tcKimlikNo}</td>
                            <td className="text-xs font-medium text-gray-800">{r.firstName || '—'} {r.lastName || ''}</td>
                            <td>
                              {r.password ? (
                                <span className="font-mono text-xs text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200 select-all inline-block">
                                  {r.password}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td>
                              {r.status === 'created' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Oluşturuldu
                                </span>
                              )}
                              {r.status === 'existing' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                  ⚠ Zaten Kayıtlı
                                </span>
                              )}
                              {r.status === 'error' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                  ✗ Kaydedilmedi
                                </span>
                              )}
                            </td>
                            <td>
                              {r.status === 'error' && (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-xs text-red-700 leading-snug">
                                    {r.error}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedErrorDetail(r)}
                                    className="shrink-0 text-xs text-red-700 bg-white hover:bg-red-100 border border-red-300 font-medium px-2 py-0.5 rounded transition shadow-xs"
                                  >
                                    🔍 Sebebi Gör
                                  </button>
                                </div>
                              )}
                              {r.status === 'existing' && (
                                <div className="text-xs text-amber-700">
                                  {r.error || 'Bu TC Kimlik No ile kayıtlı bursiyer zaten mevcut.'}
                                </div>
                              )}
                              {r.status === 'created' && (
                                <span className="text-xs text-emerald-600">Sisteme başarıyla eklendi.</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={downloadExcelResults} className="btn-secondary flex-1 text-sm">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    Sonuçları İndir (CSV)
                  </button>
                  <button
                    onClick={() => {
                      setExcelResults(null);
                      setExcelFile(null);
                    }}
                    className="btn-secondary flex-1 text-sm bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  >
                    Yeni Dosya Yükle
                  </button>
                  <button onClick={() => setExcelModalOpen(false)} className="btn-primary flex-1 text-sm">Kapat</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Detail Inspection Modal */}
      {selectedErrorDetail && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]"
          style={{ zIndex: 9999 }}
          onClick={() => setSelectedErrorDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <h3 className="font-semibold text-base">Bursiyer Kaydedilemedi — Hata Sebebi</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedErrorDetail(null)}
                className="text-white/80 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block">Excel Satırı:</span>
                  <span className="font-mono font-bold text-gray-800">Satır {selectedErrorDetail.row}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">TC Kimlik No:</span>
                  <span className="font-mono font-bold text-gray-800">{selectedErrorDetail.tcKimlikNo || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block">Ad Soyad:</span>
                  <span className="font-semibold text-gray-900">{selectedErrorDetail.firstName || ''} {selectedErrorDetail.lastName || ''}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Tespit Edilen Çakışma / Hata Sebepleri:
                </label>
                <div className="space-y-2">
                  {(selectedErrorDetail.error || 'Bilinmeyen bir hata oluştu.')
                    .split(' • ')
                    .map((errItem: string, idx: number) => (
                      <div
                        key={idx}
                        className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-md text-xs text-red-800 flex items-start gap-2"
                      >
                        <span className="text-red-500 font-bold mt-0.5">•</span>
                        <div className="font-medium leading-relaxed">{errItem}</div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                💡 <strong>Nasıl Düzeltilir?</strong> Excel dosyanızda yukarıda belirtilen kişisel bilgileri (Sicil No, E-posta, Telefon, IBAN veya TC) benzersiz olacak şekilde güncelleyip dosyayı tekrar yükleyebilirsiniz.
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedErrorDetail(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Yeni Bursiyer Ekle</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="p-5">
              {!createResult?.password ? (
                <form onSubmit={handleCreateSingle} className="space-y-4">
                  <div>
                    <label className="form-label">Ad</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={newStudentForm.firstName}
                      onChange={(e) => setNewStudentForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Soyad</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={newStudentForm.lastName}
                      onChange={(e) => setNewStudentForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">TC Kimlik No</label>
                    <input
                      type="text"
                      required
                      pattern="\d{11}"
                      maxLength={11}
                      title="11 haneli TC Kimlik Numarası"
                      className="form-input font-mono"
                      value={newStudentForm.tcKimlikNo}
                      onChange={(e) => setNewStudentForm(prev => ({ ...prev, tcKimlikNo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Bursiyer Kategorisi</label>
                    <select
                      className="form-select"
                      value={newStudentForm.scholarshipCategoryId}
                      onChange={(e) => setNewStudentForm(prev => ({ ...prev, scholarshipCategoryId: e.target.value }))}
                      required
                    >
                      <option value="">Kategori Seçin...</option>
                      {categories.filter(c => c.isActive).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isNewStudentSingle"
                      checked={newStudentForm.isNewStudent}
                      onChange={(e) => setNewStudentForm(prev => ({ ...prev, isNewStudent: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="isNewStudentSingle" className="text-sm font-medium text-gray-700">
                      Yeni Bursiyer (İlk Kayıt Belgeleri İstenir)
                    </label>
                  </div>
                  {createResult?.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                      {createResult.error}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-6">
                    <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary">İptal</button>
                    <button type="submit" disabled={creating} className="btn-primary">
                      {creating ? 'Oluşturuluyor...' : 'Oluştur'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Bursiyer Kaydı Oluşturuldu</h4>
                  <p className="text-gray-500 mb-6">Bursiyerin sisteme giriş bilgileri aşağıdadır.</p>

                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-left">
                      <div className="text-sm font-medium text-gray-500">TC Kimlik No:</div>
                      <div className="text-sm font-mono font-bold text-gray-900 select-all">{createResult.tcKimlikNo}</div>
                      <div className="text-sm font-medium text-gray-500">Geçici Şifre:</div>
                      <div className="text-sm font-mono font-bold text-primary-600 select-all">{createResult.password}</div>
                    </div>
                  </div>

                  <button onClick={() => setCreateModalOpen(false)} className="btn-primary w-full">
                    Tamam
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Mentor Modal */}
      {mentorModalOpen && selectedStudentForMentor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Mentör Ata</h3>
              <button onClick={() => setMentorModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <form onSubmit={handleAssignMentor} className="p-5">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-4">
                  <span className="font-medium text-gray-900">{selectedStudentForMentor.firstName} {selectedStudentForMentor.lastName}</span> isimli öğrenci için mentör ataması yapıyorsunuz.
                </p>
                <label className="form-label mb-1">Mentör Seçin</label>
                <select
                  className="form-select w-full"
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                >
                  <option value="">-- Mentör Yok (Kaldır) --</option>
                  {mentorsList.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.firstName} {mentor.lastName} {mentor.title ? `(${mentor.title})` : ''} - {mentor._count?.students || 0} öğrenci atanmış
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setMentorModalOpen(false)} className="btn-secondary">İptal</button>
                <button type="submit" className="btn-primary" disabled={assigningMentor}>
                  {assigningMentor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Graduation Modal */}
      {graduationModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-200">
            <div className="p-5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 font-bold">
                  🎓
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Mezuniyete Aktar</h3>
                  <p className="text-[11px] text-indigo-800">
                    {graduatingStudentIds.length} öğrenci mezun statüsüne geçirilecek
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGraduationModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-indigo-200/50 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="form-label text-xs mb-1 block">Mezuniyet Yılı</label>
                <input
                  type="number"
                  min="2000"
                  max="2099"
                  className="form-input text-xs font-semibold"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(parseInt(e.target.value) || new Date().getFullYear())}
                  placeholder="Örn: 2026"
                />
                <p className="text-[11px] text-gray-400 mt-1">Öğrencilerin gruplandırılacağı mezuniyet yılı.</p>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div>• Öğrenciler <strong>Bursiyerler</strong> listesinden çıkarılıp <strong>Mezunlar</strong> paneline taşınır.</div>
                <div>• Öğrenci portalına giriş erişimleri <strong>kapatılır</strong>.</div>
                <div>• Bu işlem dilediğiniz zaman <em>Mezunlar</em> sayfasından <strong>Geri Alınabilir</strong>.</div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setGraduationModalOpen(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGraduation}
                  disabled={graduating}
                  className="btn-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex-1 text-xs rounded-lg transition-colors flex items-center justify-center shadow-xs"
                >
                  {graduating ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : '🎓 Mezuniyete Aktar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Bursiyeri Silmek İstiyor musunuz?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-semibold text-gray-800">
                {studentToDelete.firstName} {studentToDelete.lastName}
              </span>
              {studentToDelete.user?.tcKimlikNo ? ` (TC: ${studentToDelete.user.tcKimlikNo})` : ''} adlı bursiyer, hesabı, belgeleri ve tüm profil verileriyle birlikte kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={deletingStudent}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmDeleteStudent}
                disabled={deletingStudent}
                className="btn-danger flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2 shadow-xs"
              >
                {deletingStudent ? <span className="spinner border-white/30 border-t-white w-4 h-4 mx-auto" /> : 'Evet, Kalıcı Olarak Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Excel İndirme Seçenekleri</h3>
              <button onClick={() => setExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-5">
              İndirilecek Excel dosyasına mevcut filtreleriniz uygulanacaktır. Mezun statüsündeki bursiyerleri de dahil etmek ister misiniz?
            </p>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors mb-6">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={includeGraduates}
                  onChange={(e) => setIncludeGraduates(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
              </div>
              <span className="text-sm font-medium text-gray-800">Mezunları da Dahil Et</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={submitExport}
                disabled={exporting}
                className="btn-primary flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs py-2 shadow-xs"
              >
                {exporting ? <span className="spinner border-white/30 border-t-white w-4 h-4 mx-auto" /> : 'İndir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={() => adminApi.listScholarshipCategories().then(setCategories).catch(console.error)}
      />
    </div>
  );
}
