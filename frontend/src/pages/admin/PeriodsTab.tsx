import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { DocumentPeriod, DocumentTypeConfig, ScholarshipCategory } from '../../types';
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

export default function PeriodsTab() {
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




  // Semester edit modal state
  const [editSemesterLabel, setEditSemesterLabel] = useState<string | null>(null);
  const [semesterForm, setSemesterForm] = useState<{
    label: string;
    semester: string;
    academicYear: string;
    startDate: string;
    endDate: string;
    categoryIds: string[];
    isVolunteerFormOpen: boolean;
  }>({ label: '', semester: '', academicYear: '', startDate: '', endDate: '', categoryIds: [], isVolunteerFormOpen: false });
  const [savingSemester, setSavingSemester] = useState(false);

  // Semester delete confirmation modal state
  const [deleteSemesterLabel, setDeleteSemesterLabel] = useState<string | null>(null);
  const [deletingSemester, setDeletingSemester] = useState(false);

  // Single period (document request) edit modal state
  const [editPeriod, setEditPeriod] = useState<DocumentPeriod | null>(null);
  const [editPeriodForm, setEditPeriodForm] = useState<{
    startDate: string;
    endDate: string;
    categoryIds: string[];
  }>({ startDate: '', endDate: '', categoryIds: [] });
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Single period delete state
  const [deletePeriodId, setDeletePeriodId] = useState<string | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  // Single period add modal state
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [addPeriodForm, setAddPeriodForm] = useState<{
    type: string;
    startDate: string;
    endDate: string;
    categoryIds: string[];
  }>({ type: '', startDate: '', endDate: '', categoryIds: [] });
  const [addingPeriod, setAddingPeriod] = useState(false);

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

  async function toggleVolunteerForm(label: string, currentValue: boolean) {
    try {
      await adminApi.updateSemester({ oldLabel: label, isVolunteerFormOpen: !currentValue } as any);
      toast.success(`STK Gönüllülük Formu ${currentValue ? 'kapatıldı' : 'açıldı'}.`);
      const data = await adminApi.listPeriods();
      setPeriods(data);
    } catch (err: any) {
      toast.error('Güncellenirken hata oluştu.');
    }
  }



  async function handleCreateSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      // Create the base periods for this new semester with selected categories
      const activeTypes = docTypes.filter(t => t.isActive);
      
      // Always ensure TRANSCRIPT is included even if not explicitly active, as it's a fixed request
      if (!activeTypes.find(t => t.code === 'TRANSCRIPT')) {
        activeTypes.push({ code: 'TRANSCRIPT', name: 'Transkript', isActive: true } as any);
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
      categoryIds: Array.from(allCatIds),
      isVolunteerFormOpen: existingPeriod.isVolunteerFormOpen || false,
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
        categoryIds: semesterForm.categoryIds,
        isVolunteerFormOpen: semesterForm.isVolunteerFormOpen,
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

  // Single Document Request handlers
  function openPeriodEditor(period: DocumentPeriod) {
    setEditPeriod(period);
    setEditPeriodForm({
      startDate: period.startDate ? new Date(period.startDate).toISOString().slice(0, 16) : '',
      endDate: period.endDate ? new Date(period.endDate).toISOString().slice(0, 16) : '',
      categoryIds: parseCategoryIds(period),
    });
  }

  function toggleEditPeriodCatId(catId: string) {
    setEditPeriodForm(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter(id => id !== catId)
        : [...prev.categoryIds, catId]
    }));
  }

  async function handleSavePeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!editPeriod) return;
    setSavingPeriod(true);
    try {
      await adminApi.updatePeriod(editPeriod.id, {
        startDate: editPeriodForm.startDate ? new Date(editPeriodForm.startDate).toISOString() : null,
        endDate: editPeriodForm.endDate ? new Date(editPeriodForm.endDate).toISOString() : null,
        categoryIds: editPeriodForm.categoryIds,
      });
      toast.success('Evrak talebi ayarları başarıyla güncellendi.');
      setEditPeriod(null);
      await load();
    } catch {
      toast.error('Ayarlar kaydedilirken bir hata oluştu.');
    } finally {
      setSavingPeriod(false);
    }
  }

  async function handleDeletePeriod() {
    if (!deletePeriodId) return;
    setDeletingPeriod(true);
    try {
      await adminApi.deletePeriod(deletePeriodId);
      toast.success('Evrak talebi bu dönemden başarıyla kaldırıldı.');
      setDeletePeriodId(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Kaldırılırken bir hata oluştu.');
    } finally {
      setDeletingPeriod(false);
    }
  }

  function toggleAddPeriodCatId(catId: string) {
    setAddPeriodForm(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter(id => id !== catId)
        : [...prev.categoryIds, catId]
    }));
  }

  async function handleAddPeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSemester || !addPeriodForm.type) return;
    setAddingPeriod(true);
    try {
      // Find an existing period in this semester to copy its academicYear/semester code.
      const existingPeriod = periods.find(p => p.label === selectedSemester);
      
      await adminApi.createPeriod({
        type: addPeriodForm.type,
        label: selectedSemester,
        semester: existingPeriod?.semester || 'GUZ',
        academicYear: existingPeriod?.academicYear || '',
        startDate: addPeriodForm.startDate ? new Date(addPeriodForm.startDate).toISOString() : null,
        endDate: addPeriodForm.endDate ? new Date(addPeriodForm.endDate).toISOString() : null,
        categoryIds: addPeriodForm.categoryIds,
        isOpen: true,
      });

      toast.success('Yeni evrak talebi başarıyla eklendi.');
      setShowAddPeriod(false);
      setAddPeriodForm({ type: '', startDate: '', endDate: '', categoryIds: [] });
      await load();
    } catch {
      toast.error('Talep oluşturulurken bir hata oluştu.');
    } finally {
      setAddingPeriod(false);
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
      <div className="flex justify-end mb-4">
          <button onClick={() => { setShowCreate(true); setNewCategoryIds([]); }} className="btn-primary flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Dönem Ekle
          </button>
      </div>

        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              
              {/* Left Column: Semester Navigation Sidebar */}
              <div className="lg:col-span-1 space-y-4">
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-150">
                    <h3 className="font-semibold text-gray-800 text-sm">Eğitim Dönemleri</h3>
                    <button 
                      onClick={() => { setShowCreate(true); setNewCategoryIds([]); }} 
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-0.5"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Yeni
                    </button>
                  </div>
                  
                  {semesters.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">Dönem bulunmuyor.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {semesters.map(sem => {
                        const isSelected = sem === selectedSemester;
                        // Count active document requests in this semester
                        const semPeriods = semesterMap[sem] || [];
                        const activeCount = semPeriods.filter(p => p.isOpen).length;
                        
                        return (
                          <button
                            key={sem}
                            onClick={() => setSelectedSemester(sem)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                              isSelected 
                                ? 'bg-primary-50 text-primary-800 border-l-4 border-primary-600 pl-2' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <span className="truncate pr-2">{sem}</span>
                            {activeCount > 0 && (
                              <span className="bg-green-100 text-green-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                                {activeCount} Aktif
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Semester Details & Requested Documents */}
              <div className="lg:col-span-3 space-y-6 animate-fade-in">
                {!selectedSemester ? (
                  <div className="card p-12 text-center text-gray-500 border-2 border-dashed border-gray-200">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h4 className="font-semibold text-gray-800 text-base mb-1">Eğitim Dönemi Seçilmedi</h4>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">Detayları ve evrak taleplerini görmek için sol taraftaki listeden bir dönem seçin.</p>
                  </div>
                ) : (
                  <>
                    {/* Selected Semester Title and Bulk Action buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
                      <div>
                        <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Seçili Dönem</span>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{selectedSemester}</h2>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openSemesterEditor(selectedSemester)}
                          className="btn-secondary btn-sm px-3.5 py-2 font-semibold text-gray-700 flex items-center gap-1"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Dönemi Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteSemesterClick(selectedSemester)}
                          className="btn-secondary btn-sm px-3.5 py-2 font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100 flex items-center gap-1"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          Sil
                        </button>
                      </div>
                    </div>

                    {/* Sabit Talepler Alanı */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 px-1 border-b pb-2">Sabit Talepler</h3>
                      <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-amber-900 text-sm sm:text-base mb-1 flex items-center gap-2">
                            STK Gönüllülük Formu
                            {selectedSemesterPeriods[0]?.isVolunteerFormOpen && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 animate-pulse">Aktif Alımda</span>
                            )}
                          </h4>
                          <p className="text-xs text-amber-700 max-w-xl">
                            Öğrencilerin STK çalışmalarını raporlayacağı gönüllülük formu. Aktif edildiğinde öğrenci profilinde doldurulabilir hale gelir.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          {selectedSemesterPeriods[0]?.isVolunteerFormOpen && (
                            <Link to={`/admin/volunteer-forms?periodLabel=${encodeURIComponent(selectedSemester)}`} className="text-xs font-semibold text-primary-600 hover:text-primary-800 bg-white border border-primary-200 px-3 py-1.5 rounded-lg transition-colors">
                              Formları Görüntüle
                            </Link>
                          )}
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={!!selectedSemesterPeriods[0]?.isVolunteerFormOpen} onChange={() => toggleVolunteerForm(selectedSemester, !!selectedSemesterPeriods[0]?.isVolunteerFormOpen)} />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                            <span className={`ml-2 text-xs font-bold ${selectedSemesterPeriods[0]?.isVolunteerFormOpen ? 'text-green-600' : 'text-gray-400'}`}>
                              {selectedSemesterPeriods[0]?.isVolunteerFormOpen ? 'AÇIK' : 'PASİF'}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Document Requests List */}
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-gray-800 text-base">Bu Dönemde Talep Edilen Belgeler</h3>
                        <span className="text-xs text-gray-500 font-medium">{selectedSemesterPeriods.length} belge isteniyor</span>
                      </div>

                      {selectedSemesterPeriods.length === 0 ? (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h4 className="font-semibold text-gray-800 text-sm mb-1">Evrak Talebi Yok</h4>
                          <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">Bu eğitim dönemi için öğrencilerden henüz hiçbir belge talep edilmedi.</p>
                          <button
                            onClick={() => {
                              setAddPeriodForm({ type: '', startDate: '', endDate: '', categoryIds: [] });
                              setShowAddPeriod(true);
                            }}
                            className="btn-primary btn-sm px-4"
                          >
                            + Evrak Talebi Ekle
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {selectedSemesterPeriods.map(period => {
                            const docTypeObj = docTypes.find(dt => dt.code === period.type);
                            const docCount = (period as any)?._count?.documents ?? 0;
                            const isOpen = period.isOpen;

                            let parsedCatIds: string[] = [];
                            try {
                              parsedCatIds = period.categoryIds ? JSON.parse(period.categoryIds) : [];
                            } catch {}
                            const assignedCats = parsedCatIds.length > 0
                              ? categories.filter(c => parsedCatIds.includes(c.id))
                              : [];

                            return (
                              <div key={period.id} className="bg-white rounded-2xl border border-gray-150 p-5 shadow-sm hover:border-gray-200 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                                <div className="flex items-start gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-none">
                                        {docTypeObj?.name || period.type}
                                      </h4>
                                      {isOpen && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 animate-pulse">
                                          Aktif Alımda
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
                                      {docTypeObj?.description || 'Evrak açıklaması tanımlanmamış.'}
                                    </p>
                                    
                                    {/* Date and Target Info Chips */}
                                    <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap pt-1">
                                      {docCount > 0 ? (
                                        <div className="flex items-center gap-3">
                                          <Link 
                                            to={`/admin/documents?tab=approvals&periodLabel=${encodeURIComponent(selectedSemester)}&entity=${period.type}`}
                                            className="text-primary-600 font-semibold hover:underline flex items-center gap-0.5"
                                          >
                                            {docCount} Belge Yüklendi
                                          </Link>
                                          <a 
                                            href={`/api/admin/documents/download-zip?periodLabel=${encodeURIComponent(selectedSemester)}&entity=${period.type}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-md hover:bg-primary-100 transition-colors border border-primary-200"
                                          >
                                            TÜMÜNÜ İNDİR (ZIP)
                                          </a>
                                        </div>
                                      ) : (
                                        <span className="font-medium text-gray-400">0 belge yüklendi</span>
                                      )}
                                      
                                      {period.startDate && (
                                        <span className="border-l border-gray-200 pl-3">Başlangıç: <strong className="text-gray-700">{new Date(period.startDate).toLocaleDateString('tr-TR')}</strong></span>
                                      )}
                                      {period.endDate && (
                                        <span className="border-l border-gray-200 pl-3">Bitiş: <strong className="text-gray-700">{new Date(period.endDate).toLocaleDateString('tr-TR')}</strong></span>
                                      )}

                                    </div>

                                    {/* Categories Limit indicator */}
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hedef Gruplar:</span>
                                      {assignedCats.length > 0 ? (
                                        assignedCats.map(cat => (
                                          <span key={cat.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700 border border-primary-200">
                                            {cat.name}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                          Tüm Bursiyerler
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-3 sm:self-center self-end border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto justify-end">
                                  {/* Toggle Switch */}
                                  <div className="flex items-center gap-1.5 mr-2">
                                    <span className={`text-xs font-semibold ${isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                                      {isOpen ? 'Açık' : 'Kapalı'}
                                    </span>
                                    <button
                                      onClick={() => handleToggle(period)}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        isOpen ? 'bg-status-approved' : 'bg-gray-300'
                                      }`}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        isOpen ? 'translate-x-4' : 'translate-x-1'
                                      }`} />
                                    </button>
                                  </div>

                                  {/* Edit & Delete Buttons */}
                                  <button
                                    onClick={() => openPeriodEditor(period)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                    title="Talebi Düzenle"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                  <button
                                    onClick={() => setDeletePeriodId(period.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                                    title="Talebi Sil"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Add New Request Button inside Semester */}
                          <button
                            onClick={() => {
                              setAddPeriodForm({ type: '', startDate: '', endDate: '', categoryIds: [] });
                              setShowAddPeriod(true);
                            }}
                            className="w-full py-4 border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/20 rounded-2xl text-sm font-semibold text-gray-600 hover:text-primary-600 transition-all flex items-center justify-center gap-1.5 mt-2"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Bu Döneme Yeni Belge Talebi Ekle
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

            </div>
          )}
        </>

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

              </div>

              <div className="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-indigo-900">Gönüllülük Formu Erişimi</h4>
                  <p className="text-[11px] text-indigo-700/80 mt-0.5">Öğrencilerin bu dönemde STK/Gönüllülük formu doldurmasına izin ver.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={semesterForm.isVolunteerFormOpen}
                    onChange={(e) => setSemesterForm(f => ({ ...f, isVolunteerFormOpen: e.target.checked }))}
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300"></div>
                </label>
              </div>

              <div>
                <label className="form-label mb-1.5 mt-2">Kimlere Açık Olsun? (Toplu Uygulanır)</label>
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

      {/* Edit Single Period Modal */}
      {editPeriod && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Evrak Talebini Düzenle</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(docTypes.find(dt => dt.code === editPeriod.type)?.name) || editPeriod.type} belgesi için talebi güncelliyorsunuz.
                </p>
              </div>
              <button onClick={() => setEditPeriod(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSavePeriod} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1">Başlangıç Tarihi</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={editPeriodForm.startDate} onChange={e => setEditPeriodForm(f => ({...f, startDate: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label mb-1">Bitiş Tarihi</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={editPeriodForm.endDate} onChange={e => setEditPeriodForm(f => ({...f, endDate: e.target.value}))} />
                </div>

              </div>

              <div>
                <label className="form-label mb-1.5 mt-2">Kimlere Açık Olsun?</label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Seçili kategoriler dışındaki bursiyerlerden bu evrak talep edilmez. Hiçbiri seçilmezse tüm kategorilerden istenir.
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
                          checked={editPeriodForm.categoryIds.includes(cat.id)}
                          onChange={() => toggleEditPeriodCatId(cat.id)}
                        />
                        <span className="text-sm text-gray-700 font-medium">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setEditPeriod(null)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={savingPeriod}>
                  {savingPeriod ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Period Confirmation Modal */}
      {deletePeriodId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-red-100 animate-zoom-in">
            <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="font-semibold text-red-900">Evrak Talebini Kaldır</h3>
              </div>
              <button onClick={() => setDeletePeriodId(null)} className="text-red-400 hover:text-red-600 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Bu belge talebini bu dönemden kaldırmak istediğinize emin misiniz? Öğrenciler artık bu dönem için bu belgeyi yükleyemeyecektir.
              </p>
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="font-semibold text-amber-600 block mb-1">DİKKAT:</span>
                Eğer bu talebe ait öğrencilerin yüklediği onaylı/bekleyen belgeler varsa silme işlemine izin verilmeyecektir.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setDeletePeriodId(null)} className="btn-secondary px-5">İptal</button>
              <button onClick={handleDeletePeriod} className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 px-5" disabled={deletingPeriod}>
                {deletingPeriod ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Evet, Talebi Kaldır'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Request Modal */}
      {showAddPeriod && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Evrak Talebi Ekle</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <strong>{selectedSemester}</strong> dönemine yeni bir belge toplama talebi ekleyin.
                </p>
              </div>
              <button onClick={() => setShowAddPeriod(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAddPeriod} className="p-5 space-y-4">
              <div>
                <label className="form-label mb-1">Talep Edilecek Belge Türü</label>
                <select
                  className="form-select text-sm p-2"
                  value={addPeriodForm.type}
                  onChange={e => setAddPeriodForm(f => ({...f, type: e.target.value}))}
                  required
                >
                  <option value="">Belge Türü Seçin</option>
                  {docTypes
                    .filter(t => t.isActive && !selectedSemesterPeriods.some(p => p.type === t.code))
                    .map(t => (
                      <option key={t.id} value={t.code}>{t.name}</option>
                    ))}
                </select>
                {docTypes.filter(t => t.isActive && !selectedSemesterPeriods.some(p => p.type === t.code)).length === 0 && (
                  <span className="text-[11px] text-amber-600 mt-1 block">
                    ⚠️ Bu döneme eklenebilecek aktif başka bir belge türü bulunmuyor. Önce "Belge Türü Ayarları" sekmesinden yeni bir tür tanımlayın.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1">Başlangıç Tarihi (Opsiyonel)</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={addPeriodForm.startDate} onChange={e => setAddPeriodForm(f => ({...f, startDate: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label mb-1">Bitiş Tarihi (Opsiyonel)</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={addPeriodForm.endDate} onChange={e => setAddPeriodForm(f => ({...f, endDate: e.target.value}))} />
                </div>

              </div>

              <div>
                <label className="form-label mb-1.5 mt-2">Kimlere Açık Olsun?</label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Seçili kategoriler dışındaki bursiyerlerden bu evrak talep edilmez. Hiçbiri seçilmezse tüm kategorilerden istenir.
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
                          checked={addPeriodForm.categoryIds.includes(cat.id)}
                          onChange={() => toggleAddPeriodCatId(cat.id)}
                        />
                        <span className="text-sm text-gray-700 font-medium">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setShowAddPeriod(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={addingPeriod || docTypes.filter(t => t.isActive && !selectedSemesterPeriods.some(p => p.type === t.code)).length === 0}>
                  {addingPeriod ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Talebi Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-amber-100 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-amber-900 text-lg">Otomatik Kapatma Bildirimi</h3>
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
                className="px-6 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Period Modal */}
      {editPeriod && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Evrak Talebini Düzenle</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(docTypes.find(dt => dt.code === editPeriod.type)?.name) || editPeriod.type} belgesi için talebi güncelliyorsunuz.
                </p>
              </div>
              <button onClick={() => setEditPeriod(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSavePeriod} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1">Başlangıç Tarihi</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={editPeriodForm.startDate} onChange={e => setEditPeriodForm(f => ({...f, startDate: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label mb-1">Bitiş Tarihi</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={editPeriodForm.endDate} onChange={e => setEditPeriodForm(f => ({...f, endDate: e.target.value}))} />
                </div>

              </div>

              <div>
                <label className="form-label mb-1.5 mt-2">Kimlere Açık Olsun?</label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Seçili kategoriler dışındaki bursiyerlerden bu evrak talep edilmez. Hiçbiri seçilmezse tüm kategorilerden istenir.
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
                          checked={editPeriodForm.categoryIds.includes(cat.id)}
                          onChange={() => toggleEditPeriodCatId(cat.id)}
                        />
                        <span className="text-sm text-gray-700 font-medium">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setEditPeriod(null)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={savingPeriod}>
                  {savingPeriod ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Period Confirmation Modal */}
      {deletePeriodId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-red-100 animate-zoom-in">
            <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="font-semibold text-red-900">Evrak Talebini Kaldır</h3>
              </div>
              <button onClick={() => setDeletePeriodId(null)} className="text-red-400 hover:text-red-600 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Bu belge talebini bu dönemden kaldırmak istediğinize emin misiniz? Öğrenciler artık bu dönem için bu belgeyi yükleyemeyecektir.
              </p>
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="font-semibold text-amber-600 block mb-1">DİKKAT:</span>
                Eğer bu talebe ait öğrencilerin yüklediği onaylı/bekleyen belgeler varsa silme işlemine izin verilmeyecektir.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setDeletePeriodId(null)} className="btn-secondary px-5">İptal</button>
              <button onClick={handleDeletePeriod} className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 px-5" disabled={deletingPeriod}>
                {deletingPeriod ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Evet, Talebi Kaldır'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Request Modal */}
      {showAddPeriod && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">Evrak Talebi Ekle</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <strong>{selectedSemester}</strong> dönemine yeni bir belge toplama talebi ekleyin.
                </p>
              </div>
              <button onClick={() => setShowAddPeriod(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAddPeriod} className="p-5 space-y-4">
              <div>
                <label className="form-label mb-1">Talep Edilecek Belge Türü</label>
                <select
                  className="form-select text-sm p-2"
                  value={addPeriodForm.type}
                  onChange={e => setAddPeriodForm(f => ({...f, type: e.target.value}))}
                  required
                >
                  <option value="">Belge Türü Seçin</option>
                  {docTypes
                    .filter(t => t.isActive && !selectedSemesterPeriods.some(p => p.type === t.code))
                    .map(t => (
                      <option key={t.id} value={t.code}>{t.name}</option>
                    ))}
                </select>
                {docTypes.filter(t => t.isActive && !selectedSemesterPeriods.some(p => p.type === t.code)).length === 0 && (
                  <span className="text-[11px] text-amber-600 mt-1 block">
                    ⚠️ Bu döneme eklenebilecek aktif başka bir belge türü bulunmuyor. Önce "Belge Türü Ayarları" sekmesinden yeni bir tür tanımlayın.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1">Başlangıç Tarihi (Opsiyonel)</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={addPeriodForm.startDate} onChange={e => setAddPeriodForm(f => ({...f, startDate: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label mb-1">Bitiş Tarihi (Opsiyonel)</label>
                  <input type="datetime-local" className="form-input text-sm p-2" value={addPeriodForm.endDate} onChange={e => setAddPeriodForm(f => ({...f, endDate: e.target.value}))} />
                </div>

              </div>

              <div>
                <label className="form-label mb-1.5 mt-2">Kimlere Açık Olsun?</label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Seçili kategoriler dışındaki bursiyerlerden bu evrak talep edilmez. Hiçbiri seçilmezse tüm kategorilerden istenir.
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
                          checked={addPeriodForm.categoryIds.includes(cat.id)}
                          onChange={() => toggleAddPeriodCatId(cat.id)}
                        />
                        <span className="text-sm text-gray-700 font-medium">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setShowAddPeriod(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={addingPeriod || docTypes.filter(t => t.isActive && !selectedSemesterPeriods.some(p => p.type === t.code)).length === 0}>
                  {addingPeriod ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Talebi Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
