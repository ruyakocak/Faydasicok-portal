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

  // States for bulk paste modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pastedTcs, setPastedTcs] = useState('');
  const [modalGroup, setModalGroup] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdResults, setCreatedResults] = useState<any[]>([]);

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

  async function downloadTemplate() {
    const blob = await adminApi.getCsvTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bursiyer-sablonu.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

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
        scholarshipGroup: modalGroup,
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

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Bursiyerler</h1>
          <p className="page-subtitle">{result?.pagination.total ?? 0} bursiyer kayıtlı</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="btn-secondary btn-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Şablon İndir
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
            className="form-select w-48 text-sm"
            value={scholarshipGroup}
            onChange={(e) => { setScholarshipGroup(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Burs Grupları</option>
            <option value="Sedefteki İnciler">Sedefteki İnciler</option>
            <option value="İz Bırakanlar">İz Bırakanlar</option>
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
                  <th>Kayıt Durumu</th>
                  <th>Onay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((profile) => (
                  <tr key={profile.id}>
                    <td className="font-medium text-gray-900">
                      <div>{profile.firstName} {profile.lastName}</div>
                      {profile.scholarshipGroup && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded mt-1">
                          {profile.scholarshipGroup === 'Sedefteki İnciler' ? (
                            <img src="/sedefteki-inciler-logo.png" alt="Logo" className="h-3 object-contain" />
                          ) : (
                            <img src="/izbirakanlar-logo.png" alt="Logo" className="h-3 object-contain" />
                          )}
                          {profile.scholarshipGroup}
                        </span>
                      )}
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
                      <span className={`badge ${
                        profile.studentStatus === 'ACTIVE' ? 'badge-approved' :
                        profile.studentStatus === 'INCOMPLETE' ? 'badge-pending' :
                        'badge-gray'
                      }`}>
                        {statusLabels[profile.studentStatus] || profile.studentStatus}
                      </span>
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

      {/* Bulk paste modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Toplu TC Kimlik ile Bursiyer Oluştur</h3>
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
                    <option value="Sedefteki İnciler">Sedefteki İnciler</option>
                    <option value="İz Bırakanlar">İz Bırakanlar</option>
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
    </div>
  );
}
