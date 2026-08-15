import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import type { StudentProfile, PaginatedResponse } from '../../types';
import toast from 'react-hot-toast';

const statusLabels: Record<string, string> = {
  INCOMPLETE: 'Tamamlanmadı',
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  GRADUATED: 'Mezun',
};


export default function StudentsListPage() {
  const [result, setResult] = useState<PaginatedResponse<StudentProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasPending, setHasPending] = useState(false);
  const [scholarshipGroup, setScholarshipGroup] = useState('');
  const [page, setPage] = useState(1);

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pastedTcs, setPastedTcs] = useState('');
  const [modalGroup, setModalGroup] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdResults, setCreatedResults] = useState<any[]>([]);

  // Single Create
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ tcKimlikNo: '', firstName: '', lastName: '', scholarshipCategoryId: '' });
  const [createResult, setCreateResult] = useState<{ tcKimlikNo?: string; password?: string; error?: string } | null>(null);

  // States for Mentor assignment modal
  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [selectedStudentForMentor, setSelectedStudentForMentor] = useState<StudentProfile | null>(null);
  const [mentorsList, setMentorsList] = useState<any[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [assigningMentor, setAssigningMentor] = useState(false);

  const [categories, setCategories] = useState<import('../../types').ScholarshipCategory[]>([]);

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



  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const blob = await adminApi.bulkCreate(file);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bursiyer-sonuc-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    load();
  }

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
      toast.error('Rapor indirilirken hata oluştu.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Bursiyerler</h1>
          <p className="page-subtitle">{result?.pagination.total ?? 0} bursiyer kayıtlı</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting} className="btn-secondary btn-sm text-green-700 border-green-200 hover:bg-green-50">
            {exporting ? (
              <span className="spinner w-4 h-4 border-green-700 mr-1" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            )}
            Excel İndir
          </button>
          <button onClick={() => { setCreateModalOpen(true); setCreateResult(null); setNewStudentForm({ tcKimlikNo: '', firstName: '', lastName: '', scholarshipCategoryId: '' }); }} className="btn-primary btn-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Bursiyer Ekle
          </button>

          <button onClick={() => { setBulkModalOpen(true); setCreatedResults([]); setPastedTcs(''); }} className="btn-secondary btn-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Toplu TC Yapıştır
          </button>
          <label className="btn-primary btn-sm cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Toplu Yükle
            <input type="file" accept=".csv" className="sr-only" onChange={handleBulkUpload} />
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              className="form-input pl-9"
              placeholder="Ad, soyad veya TC ile ara..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="form-select max-w-[200px]"
            value={scholarshipGroup}
            onChange={(e) => { setScholarshipGroup(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Burs Grupları</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              checked={hasPending}
              onChange={(e) => { setHasPending(e.target.checked); setPage(1); }}
            />
            Onay bekleyenler
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="spinner border-gray-300 border-t-primary-500 w-7 h-7" />
          </div>
        ) : !result?.data.length ? (
          <div className="empty-state">
            <p className="empty-state-title">Bursiyer bulunamadı</p>
            <p className="empty-state-desc">Arama kriterlerinizi değiştirin veya yeni bursiyer ekleyin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>TC Kimlik No</th>
                  <th>Üniversite / Bölüm</th>
                  <th>Sınıf</th>
                  <th>Kategori</th>
                  <th>Kayıt Durumu</th>
                  <th>Mentör</th>
                  <th>Onay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((profile) => (
                  <tr key={profile.id}>
                    <td className="font-medium text-gray-900">
                      <div>{profile.firstName} {profile.lastName}</div>
                    </td>
                    <td className="text-gray-600 font-mono text-sm">
                      {profile.user?.tcKimlikNo || '—'}
                    </td>
                    <td>
                      <div className="text-gray-900 text-sm">{profile.universityName || '—'}</div>
                      <div className="text-gray-500 text-xs">{profile.department}</div>
                    </td>
                    <td className="text-center">{profile.grade ? `${profile.grade}. Sınıf` : '—'}</td>
                    <td>
                      {profile.scholarshipCategory ? (
                        <span className="badge badge-gray text-xs">{profile.scholarshipCategory.name}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        profile.studentStatus === 'ACTIVE' ? 'badge-approved' :
                        profile.studentStatus === 'INCOMPLETE' ? 'badge-pending' :
                        'badge-gray'
                      }`}>
                        {statusLabels[profile.studentStatus] || profile.studentStatus}
                      </span>
                    </td>
                    <td>
                      {(profile as any).mentor ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{(profile as any).mentor.firstName} {(profile as any).mentor.lastName}</span>
                          <button onClick={() => openMentorModal(profile)} className="text-[10px] text-primary-600 hover:underline self-start">Değiştir</button>
                        </div>
                      ) : (
                        <button onClick={() => openMentorModal(profile)} className="btn-ghost btn-sm text-[11px] px-2 py-1">Atama Yap</button>
                      )}
                    </td>
                    <td>
                      {(profile as any)._count?.approvableChanges > 0 && (
                        <span className="badge-pending badge">
                          {(profile as any)._count.approvableChanges} bekliyor
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/admin/students/${profile.id}`}
                        className="btn-ghost btn-sm text-primary-500"
                      >
                        İncele →
                      </Link>
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
    </div>
  );
}
