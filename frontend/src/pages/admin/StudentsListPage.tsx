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

  // Single Create
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ tcKimlikNo: '', firstName: '', lastName: '', scholarshipCategoryId: '', isNewStudent: true });
  const [createResult, setCreateResult] = useState<{ tcKimlikNo?: string; password?: string; error?: string } | null>(null);

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

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await adminApi.exportStudentsReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bursiyer-raporu-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Rapor başarıyla indirildi.');
    } catch (err) {
      toast.error('Toplu hatırlatma gönderilirken hata oluştu.');
    } finally {
      setSendingReminders(false);
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
              <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            )}
            Excel İndir
          </button>
          <button onClick={() => setIsCategoryModalOpen(true)} className="btn-secondary btn-sm text-gray-700 shadow-2xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
            Kategoriler
          </button>
          <button onClick={() => { setCreateModalOpen(true); setCreateResult(null); setNewStudentForm({ tcKimlikNo: '', firstName: '', lastName: '', scholarshipCategoryId: '', isNewStudent: true }); }} className="btn-primary btn-sm shadow-2xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Bursiyer Ekle
          </button>
          <button onClick={() => { setBulkModalOpen(true); setCreatedResults([]); setPastedTcs(''); }} className="btn-secondary btn-sm shadow-2xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Toplu TC Yapıştır
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
                  <th className="text-center w-14">Mezun</th>
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
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
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
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Şifreleri Dosya Olarak İndir (CSV)
                  </button>
                  <button onClick={() => setBulkModalOpen(false)} className="btn-primary flex-1">Kapat</button>
                </div>
              </div>
            )}
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
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
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
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={() => adminApi.listScholarshipCategories().then(setCategories).catch(console.error)}
      />
    </div>
  );
}
