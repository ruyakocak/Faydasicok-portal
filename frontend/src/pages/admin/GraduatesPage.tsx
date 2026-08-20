import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import type { StudentProfile, ScholarshipCategory, PaginatedResponse } from '../../types';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';

export default function GraduatesPage() {
  const [result, setResult] = useState<PaginatedResponse<StudentProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Revert Modal State
  const [revertingStudent, setRevertingStudent] = useState<StudentProfile | null>(null);
  const [reverting, setReverting] = useState(false);

  // Fetch Categories on mount
  useEffect(() => {
    adminApi.listScholarshipCategories().then(setCategories).catch(console.error);
  }, []);

  const loadGraduates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listGraduates({
        search: search.trim() || undefined,
        year: selectedYear !== 'ALL' ? selectedYear : undefined,
        categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        page: String(page),
        limit: '20',
      });
      setResult(data);
    } catch {
      toast.error('Mezunlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedYear, selectedCategory, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGraduates();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadGraduates]);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await adminApi.exportGraduatesReport({
        year: selectedYear !== 'ALL' ? selectedYear : undefined,
        categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeYear = selectedYear !== 'ALL' ? `_${selectedYear}` : '_tum';
      a.download = `faydasicok_mezunlar${safeYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Mezunlar Excel raporu indirildi.');
    } catch {
      toast.error('Excel raporu oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
    }
  }

  async function handleConfirmRevert() {
    if (!revertingStudent) return;
    setReverting(true);
    try {
      await adminApi.revertGraduation(revertingStudent.id);
      toast.success(`${revertingStudent.firstName} ${revertingStudent.lastName} başarıyla aktif bursiyerliğe geri alındı.`);
      setRevertingStudent(null);
      loadGraduates();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Geri alma işlemi sırasında hata oluştu.');
    } finally {
      setReverting(false);
    }
  }

  // Generate Year tabs from backend or fallback years
  const availableYears = result?.years && result.years.length > 0 
    ? result.years 
    : [new Date().getFullYear(), new Date().getFullYear() - 1];

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── Page Header ── */}
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Mezunlar</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              {result?.pagination.total ?? 0} Mezun
            </span>
          </div>
          <p className="page-subtitle">
            Bursiyerlik sürecini başarıyla tamamlayan mezun öğrenciler ve mezuniyet dönemleri
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary btn-sm flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs font-semibold"
          >
            {exporting ? (
              <span className="spinner border-indigo-400 border-t-indigo-700 w-4 h-4" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            )}
            <span>Mezunlar Excel İndir</span>
          </button>
        </div>
      </div>

      {/* ── Year Pills & Filter Bar ── */}
      <div className="card">
        <div className="card-body p-4 space-y-4">
          {/* Year Buttons */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Mezuniyet Yılı:
            </span>

            <button
              type="button"
              onClick={() => { setSelectedYear('ALL'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedYear === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tüm Yıllar
            </button>

            {availableYears.map(year => (
              <button
                key={year}
                type="button"
                onClick={() => { setSelectedYear(String(year)); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedYear === String(year)
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>🎓 {year} Mezunları</span>
              </button>
            ))}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-56">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                className="form-input pl-9 text-xs"
                placeholder="Mezun adı, soyadı veya TC ile ara..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <select
              className="form-select text-xs w-52"
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            >
              <option value="ALL">Tüm Burs Kategorileri</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Graduates Table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="spinner border-gray-300 border-t-indigo-600 w-7 h-7" />
          </div>
        ) : !result?.data.length ? (
          <EmptyState
            title="Mezun kaydı bulunamadı"
            description="Seçilen mezuniyet yılı ve filtre kriterlerine uygun öğrenci kaydı bulunamadı."
          />
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="data-table min-w-[1050px] w-full">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th className="text-center">TC Kimlik No</th>
                  <th className="text-center">Mezuniyet Yılı</th>
                  <th className="text-center">Kategori</th>
                  <th>Üniversite / Bölüm</th>
                  <th className="text-center">Mentör</th>
                  <th>İletişim</th>
                  <th className="text-center w-36">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((profile) => (
                  <tr key={profile.id}>
                    <td className="font-semibold text-gray-900">
                      <Link
                        to={`/admin/students/${profile.id}`}
                        className="hover:text-indigo-600 hover:underline flex items-center gap-1.5"
                      >
                        <span>{profile.firstName} {profile.lastName}</span>
                      </Link>
                    </td>

                    <td className="text-center text-gray-600 font-mono text-xs">
                      {profile.user?.tcKimlikNo || '—'}
                    </td>

                    <td className="text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                        🎓 {profile.graduationYear ? `${profile.graduationYear} Mezunu` : 'Mezun'}
                      </span>
                    </td>

                    <td className="text-center">
                      {profile.scholarshipCategory ? (
                        <span className="badge badge-gray text-xs whitespace-nowrap">
                          {profile.scholarshipCategory.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    <td>
                      <div className="text-gray-900 text-xs font-semibold">{profile.universityName || '—'}</div>
                      <div className="text-gray-500 text-[11px]">{profile.department}</div>
                    </td>

                    <td className="text-center">
                      {(profile as any).mentor ? (
                        <span className="text-xs font-semibold text-gray-800">
                          {(profile as any).mentor.firstName} {(profile as any).mentor.lastName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="text-xs text-gray-600">
                      <div>{profile.phone || '—'}</div>
                      <div className="text-gray-400 text-[11px]">{profile.user?.email || profile.email}</div>
                    </td>

                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/admin/students/${profile.id}`}
                          className="btn-ghost btn-sm text-indigo-600 font-semibold text-xs whitespace-nowrap"
                          title="Profili Gör"
                        >
                          İncele
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRevertingStudent(profile)}
                          className="btn-sm bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap"
                          title="Öğrenciyi mezunluktan çıkarıp aktif bursiyerliğe geri döndür"
                        >
                          ↩️ Geri Al
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
            <span className="text-xs text-gray-500 font-medium">Toplam {result.pagination.total} mezun kayıt</span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Önceki</button>
              <span className="text-xs font-semibold">{page} / {result.pagination.totalPages}</span>
              <button className="btn-secondary btn-sm text-xs" onClick={() => setPage(p => p + 1)} disabled={page === result.pagination.totalPages}>Sonraki →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Revert Graduation Modal ── */}
      {revertingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-200">
            <div className="p-5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold">
                  ↩️
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Bursiyerliğe Geri Al</h3>
                  <p className="text-[11px] text-amber-800">
                    {revertingStudent.firstName} {revertingStudent.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRevertingStudent(null)}
                className="w-7 h-7 rounded-lg hover:bg-amber-200/50 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Bu öğrenciyi mezun statüsünden çıkarıp tekrar <strong>Aktif Bursiyerler</strong> listesine taşımak üzeresiniz.
              </p>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
                <div>• Öğrencinin burs durumu <strong>Aktif</strong> olarak güncellenecek.</div>
                <div>• Öğrencinin portala giriş erişimi <strong>yeniden açılacaktır</strong>.</div>
                <div>• Öğrenci tekrar evrak yükleme ve duyuruları takip edebilecektir.</div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRevertingStudent(null)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevert}
                  disabled={reverting}
                  className="btn-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold flex-1 text-xs rounded-lg transition-colors flex items-center justify-center"
                >
                  {reverting ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Evet, Geri Al'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
