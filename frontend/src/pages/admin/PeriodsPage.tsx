import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { DocumentPeriod } from '../../types';
import toast from 'react-hot-toast';

const periodTypeLabels: Record<string, string> = {
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  VOLUNTEER_REPORT: 'STK Gönüllülük Raporu',
};

const periodDescriptions: Record<string, string> = {
  TRANSCRIPT: 'Öğrencilerin güncel dönem not döküm belgesi (PDF).',
  STUDENT_CERTIFICATE: 'Öğrencinin aktif kayıt durumunu gösteren güncel e-devlet belgesi.',
  VOLUNTEER_REPORT: 'Bursiyerlerin sivil toplum kuruluşlarında yaptıkları gönüllülük faaliyet raporu.',
};

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.listPeriods();
      setPeriods(data);
      
      // Group by label to find unique semesters
      const semesters = Array.from(new Set(data.map(p => p.label)));
      if (semesters.length > 0) {
        // If there's an active (isOpen) period, select its label. Otherwise select the latest one.
        const active = data.find(p => p.isOpen);
        setSelectedSemester(active ? active.label : semesters[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(period: DocumentPeriod) {
    const res = await adminApi.updatePeriod(period.id, { isOpen: !period.isOpen }) as any;
    
    if (res.autoClosedOtherSemesters) {
      setShowWarningModal(true);
    }
    
    toast.success(`${periodTypeLabels[period.type]} yükleme izni ${period.isOpen ? 'kapatıldı' : 'açıldı'}.`);
    // Reload periods
    const data = await adminApi.listPeriods();
    setPeriods(data);
  }

  async function handleCreateSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      // Create the 3 base periods for this new semester
      await Promise.all([
        adminApi.createPeriod({ type: 'TRANSCRIPT', label: newLabel, semester: 'GUZ', academicYear: '' }),
        adminApi.createPeriod({ type: 'STUDENT_CERTIFICATE', label: newLabel, semester: 'GUZ', academicYear: '' }),
        adminApi.createPeriod({ type: 'VOLUNTEER_REPORT', label: newLabel, semester: 'GUZ', academicYear: '' }),
      ]);
      toast.success('Yeni dönem başarıyla oluşturuldu.');
      setShowCreate(false);
      setNewLabel('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  // Group periods by semester label
  const semesterMap: Record<string, DocumentPeriod[]> = {};
  periods.forEach(p => {
    if (!semesterMap[p.label]) semesterMap[p.label] = [];
    semesterMap[p.label].push(p);
  });
  const semesters = Object.keys(semesterMap);

  const selectedSemesterPeriods = semesterMap[selectedSemester] || [];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Dönem ve Evrak Yönetimi</h1>
          <p className="page-subtitle">Aktif eğitim dönemini seçin ve toplanacak belgeleri belirleyin</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Dönem Ekle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
        </div>
      ) : semesters.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Henüz oluşturulmuş bir dönem bulunmamaktadır. Sağ üstteki "Yeni Dönem Ekle" butonu ile başlayın.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Semester Selector Card */}
          <div className="card">
            <div className="card-body py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="form-label mb-1.5 font-semibold text-gray-700">Aktif Eğitim Dönemi</label>
                <select
                  className="form-select text-base py-2.5 px-3.5 border-gray-300 rounded-lg shadow-sm"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  {semesters.map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-600 sm:max-w-xs">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 flex-shrink-0 inline mr-1" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Aşağıdaki evrak açma/kapama ayarları yalnızca seçili olan <strong>{selectedSemester}</strong> için geçerlidir.
              </div>
            </div>
          </div>

          {/* Active Period Settings List */}
          <div className="card">
            <div className="card-header border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">{selectedSemester} Evrak Ayarları</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {['TRANSCRIPT', 'STUDENT_CERTIFICATE', 'VOLUNTEER_REPORT'].map(type => {
                const period = selectedSemesterPeriods.find(p => p.type === type);
                const isOpen = period?.isOpen ?? false;
                const docCount = (period as any)?._count?.documents ?? 0;

                return (
                  <div key={type} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{periodTypeLabels[type]}</h4>
                        {isOpen && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 animate-pulse">
                            Aktif Alımda
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">{periodDescriptions[type]}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                        <span>Yüklenen Belge: <strong className="text-gray-700 font-medium">{docCount} adet</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className={`text-xs font-semibold ${isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                        {isOpen ? 'Yükleme Açık' : 'Yükleme Kapalı'}
                      </span>
                      {period ? (
                        <button
                          onClick={() => handleToggle(period)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isOpen ? 'bg-status-approved' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isOpen ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Oluşturuluyor...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Semester Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-lg text-gray-900">Yeni Eğitim Dönemi Ekle</h3>
            </div>
            <form onSubmit={handleCreateSemester} className="p-5 space-y-4">
              <div>
                <label className="form-label mb-1.5">Dönem Adı (Etiket)</label>
                <input
                  className="form-input text-sm p-2.5"
                  placeholder="Örn: 2024-2025 Güz Dönemi"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  required
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Bu işlem, girilen dönem adına ait Transkript, Öğrenci Belgesi ve Gönüllülük Raporu kayıtlarını otomatik oluşturacaktır.
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1 animate-fade-in" disabled={creating}>
                  {creating ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Dönem Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-amber-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-amber-900">Otomatik Kapatma Bildirimi</h3>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Sistemde aynı anda sadece <strong>TEK BİR dönemin</strong> aktif olmasına izin verilmektedir.
              </p>
              <p className="text-sm text-gray-700">
                Siz bu dönemi açtığınız için, çakışmayı önlemek adına <strong className="text-amber-700">DİĞER TÜM DÖNEMLERDEKİ</strong> (eski dönemler vb.) açık evrak yüklemeleri otomatik olarak KAPATILMIŞTIR!
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                onClick={() => setShowWarningModal(false)}
                className="px-5 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-sm"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
