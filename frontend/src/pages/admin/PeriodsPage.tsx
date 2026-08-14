import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { DocumentPeriod, DocumentTypeConfig, ScholarshipCategory } from '../../types';
import DocumentTypesTab from './DocumentTypesTab';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

// Helper to parse categoryIds JSON string into an array
function parseCategoryIds(period: DocumentPeriod): string[] {
  if (!period.categoryIds) return [];
  try {
    const ids = JSON.parse(period.categoryIds);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeConfig[]>([]);
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategoryIds, setNewCategoryIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [activeTab, setActiveTab] = useState<'periods' | 'types'>('periods');

  // Category edit modal state
  const [editCatPeriod, setEditCatPeriod] = useState<DocumentPeriod | null>(null);
  const [editCatIds, setEditCatIds] = useState<string[]>([]);
  const [savingCats, setSavingCats] = useState(false);

  // Semester edit modal state
  const [editSemesterLabel, setEditSemesterLabel] = useState<string | null>(null);
  const [semesterForm, setSemesterForm] = useState<{
    label: string;
    semester: string;
    academicYear: string;
    startDate: string;
    endDate: string;
    grade: number | '';
    categoryIds: string[];
  }>({ label: '', semester: '', academicYear: '', startDate: '', endDate: '', grade: '', categoryIds: [] });
  const [savingSemester, setSavingSemester] = useState(false);

  // Semester delete confirmation modal state
  const [deleteSemesterLabel, setDeleteSemesterLabel] = useState<string | null>(null);
  const [deletingSemester, setDeletingSemester] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [periodsData, typesData, categoriesData] = await Promise.all([
        adminApi.listPeriods(),
        adminApi.listDocumentTypes(),
        adminApi.listScholarshipCategories(),
      ]);
      setPeriods(periodsData);
      setDocTypes(typesData);
      setCategories(categoriesData);
      
      // Group by label to find unique semesters
      const semesters = Array.from(new Set(periodsData.map(p => p.label)));
      if (semesters.length > 0) {
        // If there's an active (isOpen) period, select its label. Otherwise select the latest one.
        const active = periodsData.find(p => p.isOpen);
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
    
    const docTypeName = docTypes.find(d => d.code === period.type)?.name || period.type;
    toast.success(`${docTypeName} yükleme izni ${period.isOpen ? 'kapatıldı' : 'açıldı'}.`);
    // Reload periods
    const data = await adminApi.listPeriods();
    setPeriods(data);
  }

  async function handleAddToSemester(docType: DocumentTypeConfig) {
    if (!selectedSemester) return;
    
    // Find an existing period in this semester to copy its academicYear/semester code.
    const existingPeriod = periods.find(p => p.label === selectedSemester);
    if (!existingPeriod) {
      toast.error('Dönem bilgileri bulunamadı.');
      return;
    }
    
    let catIds: string[] | undefined;
    try {
      const parsed = docType.categoryIds ? JSON.parse(docType.categoryIds) : [];
      if (Array.isArray(parsed) && parsed.length > 0) catIds = parsed;
    } catch {}

    try {
      await adminApi.createPeriod({
        type: docType.code,
        label: selectedSemester,
        semester: existingPeriod.semester,
        academicYear: existingPeriod.academicYear,
        categoryIds: catIds,
        isOpen: false
      });
      toast.success(`${docType.name} bu döneme eklendi.`);
      await load();
    } catch (err: any) {
      toast.error('Eklenirken bir hata oluştu');
    }
  }

  async function handleCreateSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      // Create the base periods for this new semester with selected categories
      const activeTypes = docTypes.filter(t => t.isActive);
      if (activeTypes.length === 0) {
        toast.error('Aktif bir belge türü bulunamadı. Lütfen önce belge türü ekleyin.');
        setCreating(false);
        return;
      }
      await Promise.all(
        activeTypes.map(t => {
          let documentCatIds: string[] = [];
          try {
            documentCatIds = t.categoryIds ? JSON.parse(t.categoryIds) : [];
          } catch {}

          let finalCatIds = newCategoryIds.length > 0 ? [...newCategoryIds] : [];

          // If the document has specific categories natively
          if (documentCatIds.length > 0) {
            if (newCategoryIds.length > 0) {
              // Intersect semester categories with document's native categories
              finalCatIds = documentCatIds.filter(id => newCategoryIds.includes(id));
            } else {
              // Semester is open to all, so document takes its own specific categories
              finalCatIds = documentCatIds;
            }
          } else {
             // Document is open to all natively, so it just takes the semester's categories
             finalCatIds = newCategoryIds;
          }

          return adminApi.createPeriod({
            type: t.code,
            label: newLabel,
            semester: 'GUZ',
            academicYear: '',
            categoryIds: finalCatIds.length > 0 ? finalCatIds : undefined,
          } as any);
        })
      );
      toast.success('Yeni dönem başarıyla oluşturuldu.');
      setShowCreate(false);
      setNewLabel('');
      setNewCategoryIds([]);
      await load();
    } finally {
      setCreating(false);
    }
  }

  function openCategoryEditor(period: DocumentPeriod) {
    setEditCatPeriod(period);
    setEditCatIds(parseCategoryIds(period));
  }

  function toggleEditCatId(catId: string) {
    setEditCatIds(prev =>
      prev.includes(catId)
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    );
  }

  async function handleSaveCategories() {
    if (!editCatPeriod) return;
    setSavingCats(true);
    try {
      await adminApi.updatePeriodCategories(editCatPeriod.id, editCatIds);
      toast.success('Kategori atamaları güncellendi.');
      setEditCatPeriod(null);
      const data = await adminApi.listPeriods();
      setPeriods(data);
    } catch {
      toast.error('Kategori güncellenirken bir hata oluştu.');
    } finally {
      setSavingCats(false);
    }
  }

  function openSemesterEditor(label: string) {
    const existingPeriods = periods.filter(p => p.label === label);
    if (existingPeriods.length === 0) return;
    
    const existingPeriod = existingPeriods[0];
    
    const allCatIds = new Set<string>();
    existingPeriods.forEach(p => {
      const ids = parseCategoryIds(p);
      ids.forEach(id => allCatIds.add(id));
    });

    setEditSemesterLabel(label);
    setSemesterForm({
      label: existingPeriod.label || '',
      semester: existingPeriod.semester || '',
      academicYear: existingPeriod.academicYear || '',
      startDate: existingPeriod.startDate ? new Date(existingPeriod.startDate).toISOString().slice(0, 16) : '',
      endDate: existingPeriod.endDate ? new Date(existingPeriod.endDate).toISOString().slice(0, 16) : '',
      grade: existingPeriod.grade || '',
      categoryIds: Array.from(allCatIds),
    });
  }

  function toggleSemesterCatId(catId: string) {
    setSemesterForm(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter(id => id !== catId)
        : [...prev.categoryIds, catId]
    }));
  }

  async function handleSaveSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!editSemesterLabel) return;
    setSavingSemester(true);
    try {
      const payload: any = {
        oldLabel: editSemesterLabel,
        label: semesterForm.label,
        semester: semesterForm.semester,
        academicYear: semesterForm.academicYear,
        startDate: semesterForm.startDate ? new Date(semesterForm.startDate).toISOString() : null,
        endDate: semesterForm.endDate ? new Date(semesterForm.endDate).toISOString() : null,
        grade: semesterForm.grade === '' ? null : Number(semesterForm.grade),
        categoryIds: semesterForm.categoryIds,
      };

      await adminApi.updateSemester(payload);
      toast.success('Dönem bilgileri güncellendi.');
      setEditSemesterLabel(null);
      const data = await adminApi.listPeriods();
      setPeriods(data);
      if (semesterForm.label !== selectedSemester) {
        setSelectedSemester(semesterForm.label);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Güncellenirken bir hata oluştu.');
    } finally {
      setSavingSemester(false);
    }
  }

  function handleDeleteSemesterClick(label: string) {
    setDeleteSemesterLabel(label);
  }

  async function confirmDeleteSemester() {
    if (!deleteSemesterLabel) return;
    setDeletingSemester(true);
    try {
      await adminApi.deleteSemester(deleteSemesterLabel);
      toast.success('Dönem tüm evraklarıyla birlikte başarıyla silindi.');
      const data = await adminApi.listPeriods();
      setPeriods(data);
      
      // If no periods left for this semester, switch to another
      const remainingForSem = data.filter(p => p.label === selectedSemester);
      if (remainingForSem.length === 0) {
        const semesters = Array.from(new Set(data.map(p => p.label)));
        setSelectedSemester(semesters[0] || '');
      }
      setDeleteSemesterLabel(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Silinirken bir hata oluştu.');
    } finally {
      setDeletingSemester(false);
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

  const activeCategories = categories.filter(c => c.isActive);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Dönem ve Evrak Yönetimi</h1>
          <p className="page-subtitle">Eğitim dönemlerini ve toplanacak evrak türlerini belirleyin</p>
        </div>
        {activeTab === 'periods' && (
          <button onClick={() => { setShowCreate(true); setNewCategoryIds([]); }} className="btn-primary flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Dönem Ekle
          </button>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6 flex gap-6">
        <button
          onClick={() => setActiveTab('periods')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'periods' ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Dönem Yönetimi
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'types' ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Belge Türü Ayarları
        </button>
      </div>

      {activeTab === 'types' && <DocumentTypesTab />}

      {activeTab === 'periods' && (
        <>
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
            <div className="card-body py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="form-label mb-1.5 font-semibold text-gray-700">Aktif Eğitim Dönemi</label>
                <select
                  className="form-select text-base py-2.5 px-3.5 border-gray-300 rounded-lg shadow-sm w-full"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  {semesters.map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
                
                {/* Genel Dönem Kategorileri */}
                <div className="mt-4 flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-gray-600">Bu dönemin açık olduğu gruplar (Varsayılan):</span>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const allCatIds = new Set<string>();
                      selectedSemesterPeriods.forEach(p => {
                        const ids = parseCategoryIds(p);
                        ids.forEach(id => allCatIds.add(id));
                      });
                      const catIds = Array.from(allCatIds);
                      const cats = catIds.length > 0 ? categories.filter(c => catIds.includes(c.id)) : [];
                      return cats.length > 0 ? cats.map(c => (
                        <span key={c.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-50 text-primary-700 border border-primary-200">
                          {c.name}
                        </span>
                      )) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Tüm Bursiyerler
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-600 sm:max-w-xs mt-2 sm:mt-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 flex-shrink-0 inline mr-1" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Aşağıdaki evrak açma/kapama ayarları yalnızca seçili olan <strong>{selectedSemester}</strong> için geçerlidir.
              </div>
            </div>
          </div>

          {/* Active Period Settings List */}
          <div className="card">
            <div className="card-header border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">{selectedSemester} Evrak Ayarları</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSemesterEditor(selectedSemester)}
                  className="btn-secondary btn-sm text-xs py-1 px-3 hover:bg-gray-100"
                >
                  Dönemi Düzenle
                </button>
                <button
                  onClick={() => handleDeleteSemesterClick(selectedSemester)}
                  className="btn-secondary btn-sm text-xs py-1 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Dönemi Sil
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {docTypes.filter(docType => {
                const allCatIds = new Set<string>();
                selectedSemesterPeriods.forEach(p => {
                  const ids = parseCategoryIds(p);
                  ids.forEach(id => allCatIds.add(id));
                });
                const semCatIds = Array.from(allCatIds);
                
                let dtCatIds: string[] = [];
                try {
                  dtCatIds = docType.categoryIds ? JSON.parse(docType.categoryIds) : [];
                  if (!Array.isArray(dtCatIds)) dtCatIds = [];
                } catch (e) {}

                if (dtCatIds.length === 0) return true; // Belge türü herkese açıksa her dönemde görünsün
                if (semCatIds.length === 0) return true; // Dönem herkese açıksa her belge türü görünsün
                
                // Dönem belirli gruplara açıksa ve belge türü de belirli gruplara özgüyse, kesişim olmalı
                return dtCatIds.some(id => semCatIds.includes(id));
              }).map(docType => {
                const type = docType.code;
                const period = selectedSemesterPeriods.find(p => p.type === type);
                const isOpen = period?.isOpen ?? false;
                const docCount = (period as any)?._count?.documents ?? 0;
                
                let dtCatIds: string[] = [];
                try {
                  dtCatIds = docType.categoryIds ? JSON.parse(docType.categoryIds) : [];
                  if (!Array.isArray(dtCatIds)) dtCatIds = [];
                } catch (e) {}

                const assignedCats = dtCatIds.length > 0
                  ? categories.filter(c => dtCatIds.includes(c.id))
                  : [];

                return (
                  <div key={type} className="p-5 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{docType.name}</h4>
                          {isOpen && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 animate-pulse">
                              Aktif Alımda
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">{docType.description}</p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                          {docCount > 0 ? (
                            <Link 
                              to={`/admin/approvals?periodLabel=${encodeURIComponent(selectedSemester)}&entity=${docType.code}`}
                              className="hover:text-primary-600 transition-colors flex items-center gap-1 group"
                            >
                              <span>Yüklenen Belge:</span>
                              <strong className="text-gray-700 font-medium group-hover:text-primary-600 group-hover:underline">
                                {docCount} adet
                              </strong>
                            </Link>
                          ) : (
                            <span>Yüklenen Belge: <strong className="text-gray-700 font-medium">0 adet</strong></span>
                          )}
                          {period?.academicYear && (
                            <span className="border-l border-gray-200 pl-3">Yıl: <strong className="text-gray-700">{period.academicYear}</strong></span>
                          )}
                          {period?.grade && (
                            <span className="border-l border-gray-200 pl-3">Sınıf: <strong className="text-gray-700">{period.grade}. Sınıf</strong></span>
                          )}
                          {period?.startDate && (
                            <span className="border-l border-gray-200 pl-3">Başlangıç: <strong className="text-gray-700">{new Date(period.startDate).toLocaleDateString('tr-TR')}</strong></span>
                          )}
                          {period?.endDate && (
                            <span className="border-l border-gray-200 pl-3">Bitiş: <strong className="text-gray-700">{new Date(period.endDate).toLocaleDateString('tr-TR')}</strong></span>
                          )}
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
                          <button onClick={() => handleAddToSemester(docType)} className="btn-secondary btn-sm text-xs py-1 px-3">
                            Bu Döneme Ekle
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category badges and edit */}
                    {period && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium text-gray-500">Kategoriler:</span>
                        {assignedCats.length > 0 ? (
                          assignedCats.map(cat => (
                            <span key={cat.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700 border border-primary-200">
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            Tüm Kategoriler
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </>
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
                  Bu işlem, girilen dönem adına ait tüm aktif belge türlerinin kayıtlarını otomatik oluşturacaktır.
                </span>
              </div>

              {/* Category selection for new semester */}
              <div>
                <label className="form-label mb-1.5">Bursiyer Kategorileri</label>
                <p className="text-[11px] text-gray-400 mb-2">Bu dönem hangi kategorilere açık olsun? Hiçbiri seçilmezse tüm kategorilere açık olur.</p>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {activeCategories.length === 0 ? (
                    <p className="text-xs text-gray-400">Henüz kategori tanımlanmamış.</p>
                  ) : (
                    activeCategories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                          checked={newCategoryIds.includes(cat.id)}
                          onChange={() => {
                            setNewCategoryIds(prev =>
                              prev.includes(cat.id)
                                ? prev.filter(id => id !== cat.id)
                                : [...prev, cat.id]
                            );
                          }}
                        />
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {newCategoryIds.length === 0 && activeCategories.length > 0 && (
                  <span className="text-[11px] text-blue-500 mt-1 block">
                    ℹ️ Hiçbir kategori seçilmedi — dönem tüm bursiyerlere açık olacak.
                  </span>
                )}
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

      {/* Semester Edit Modal */}
      {editSemesterLabel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Dönemi Düzenle</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tüm evraklar için bu ayarlar güncellenecektir.
                </p>
              </div>
              <button onClick={() => setEditSemesterLabel(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSaveSemester} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label mb-1">Dönem Etiketi</label>
                  <input className="form-input text-sm p-2" value={semesterForm.label} onChange={e => setSemesterForm(f => ({...f, label: e.target.value}))} required />
                </div>
                <div>
                  <label className="form-label mb-1">Dönem (Güz/Bahar)</label>
                  <select className="form-select text-sm p-2" value={semesterForm.semester} onChange={e => setSemesterForm(f => ({...f, semester: e.target.value}))} required>
                    <option value="">Seçiniz</option>
                    <option value="GUZ">Güz</option>
                    <option value="BAHAR">Bahar</option>
                  </select>
                </div>
                <div>
                  <label className="form-label mb-1">Akademik Yıl</label>
                  <input className="form-input text-sm p-2" value={semesterForm.academicYear} onChange={e => setSemesterForm(f => ({...f, academicYear: e.target.value}))} placeholder="2024-2025" />
                </div>
                <div>
                  <label className="form-label mb-1">Başlangıç Tarihi</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={semesterForm.startDate} onChange={e => setSemesterForm(f => ({...f, startDate: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label mb-1">Bitiş Tarihi</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={semesterForm.endDate} onChange={e => setSemesterForm(f => ({...f, endDate: e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <label className="form-label mb-1">Sınıf Kısıtlaması (Boş bırakılırsa tüm sınıflar)</label>
                  <input type="number" min="1" max="6" className="form-input text-sm p-2" value={semesterForm.grade} onChange={e => setSemesterForm(f => ({...f, grade: e.target.value === '' ? '' : Number(e.target.value)}))} placeholder="Örn: 1" />
                </div>
              </div>

              <div>
                <label className="form-label mb-1.5 mt-2">Bursiyer Kategorileri Kısıtlaması (Toplu Uygulanır)</label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Hiçbiri seçilmezse tüm evraklar <strong>tüm kategorilere</strong> açık olur.
                </p>
                <div className="border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                  {activeCategories.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Henüz aktif kategori bulunmuyor.</p>
                  ) : (
                    activeCategories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 w-4 h-4"
                          checked={semesterForm.categoryIds.includes(cat.id)}
                          onChange={() => toggleSemesterCatId(cat.id)}
                        />
                        <span className="text-sm text-gray-700 font-medium">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setEditSemesterLabel(null)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={savingSemester}>
                  {savingSemester ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Toplu Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Delete Semester Confirmation Modal */}
      {deleteSemesterLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-red-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="font-semibold text-red-900">Dönemi Sil</h3>
              </div>
              <button onClick={() => setDeleteSemesterLabel(null)} className="text-red-400 hover:text-red-600 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                <strong>"{deleteSemesterLabel}"</strong> isimli tüm dönemi ve bu döneme ait evrak isteklerini silmek istediğinize emin misiniz?
              </p>
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="font-semibold text-amber-600 block mb-1">DİKKAT:</span>
                Eğer bu döneme daha önce yüklenmiş öğrenci evrakları varsa, sistem veri kaybını önlemek için silme işlemine izin vermeyecektir.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setDeleteSemesterLabel(null)} className="btn-secondary px-5">
                İptal
              </button>
              <button onClick={confirmDeleteSemester} className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 px-5" disabled={deletingSemester}>
                {deletingSemester ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Evet, Dönemi Sil'}
              </button>
            </div>
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
