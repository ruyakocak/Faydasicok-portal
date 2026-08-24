import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { DocumentTypeConfig, ScholarshipCategory } from '../../types';
import toast from 'react-hot-toast';

interface CustomField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export default function DocumentTypesTab() {
  const [types, setTypes] = useState<DocumentTypeConfig[]>([]);
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'STATIC' | 'PERIODIC'>('ALL');
  
  // Delete modal state
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteModalLabel, setDeleteModalLabel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const [form, setForm] = useState<{
    id?: string;
    code: string;
    name: string;
    description: string;
    isActive: boolean;
    isStatic: boolean;
    isRequired: boolean;
    hasTemplate: boolean;
    templateName: string;
    order: number;
    customFields: CustomField[];
    categoryIds: string[];
  }>({
    code: '',
    name: '',
    description: '',
    isActive: true,
    isStatic: false,
    isRequired: true,
    hasTemplate: false,
    templateName: '',
    order: 0,
    customFields: [],
    categoryIds: [],
  });

  async function load() {
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([
        adminApi.listDocumentTypes(),
        adminApi.listScholarshipCategories(),
      ]);
      setTypes(data);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleInitStandard() {
    if (!window.confirm('Vakfın 13 statik ilk kayıt belgesi ve 2 dönemsel belgesi otomatik olarak sisteme eklenecek/güncellenecektir. Mevcut tüm bursiyerler bu ilk kayıt belgelerinden muaf olarak işaretlenecektir. Devam etmek istiyor musunuz?')) return;
    setSyncing(true);
    try {
      await adminApi.initStandardDocumentTypes();
      toast.success('Standart belgeler başarıyla oluşturuldu ve mevcut bursiyerler muaf olarak işaretlendi.');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Standart belgeler yüklenemedi.');
    } finally {
      setSyncing(false);
    }
  }

  function handleDelete(id: string, name: string) {
    setDeleteModalId(id);
    setDeleteModalLabel(name);
  }

  async function confirmDelete() {
    if (!deleteModalId) return;
    setDeleting(true);
    try {
      await adminApi.deleteDocumentType(deleteModalId);
      toast.success('Belge türü silindi.');
      if (showModal) setShowModal(false);
      setDeleteModalId(null);
      setDeleteModalLabel(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Belge türü silinemedi.');
    } finally {
      setDeleting(false);
    }
  }

  function handleEdit(item: DocumentTypeConfig) {
    let parsedFields = [];
    try {
      parsedFields = item.customFields ? JSON.parse(item.customFields) : [];
    } catch (e) {}

    let parsedCatIds: string[] = [];
    try {
      parsedCatIds = item.categoryIds ? JSON.parse(item.categoryIds) : [];
      if (!Array.isArray(parsedCatIds)) parsedCatIds = [];
    } catch (e) {}
    
    setForm({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description || '',
      isActive: item.isActive,
      isStatic: item.isStatic ?? false,
      isRequired: item.isRequired !== false,
      hasTemplate: item.hasTemplate ?? false,
      templateName: item.templateName || '',
      order: item.order || 0,
      customFields: parsedFields,
      categoryIds: parsedCatIds,
    });
    setShowModal(true);
  }

  function handleAdd() {
    setForm({
      code: '',
      name: '',
      description: '',
      isActive: true,
      isStatic: false,
      isRequired: true,
      hasTemplate: false,
      templateName: '',
      order: types.length + 1,
      customFields: [],
      categoryIds: [],
    });
    setShowModal(true);
  }

  function addField() {
    setForm(f => ({
      ...f,
      customFields: [
        ...f.customFields,
        { id: Math.random().toString(36).substr(2, 6), label: '', type: 'text', required: true }
      ]
    }));
  }

  function updateField(index: number, key: keyof CustomField, value: any) {
    setForm(f => {
      const fields = [...f.customFields];
      fields[index] = { ...fields[index], [key]: value };
      return { ...f, customFields: fields };
    });
  }

  function removeField(index: number) {
    setForm(f => ({
      ...f,
      customFields: f.customFields.filter((_, i) => i !== index)
    }));
  }

  function generateCode(name: string) {
    return name
      .toLocaleUpperCase('tr-TR')
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/İ/g, 'I')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const generatedCode = form.code ? form.code.trim() : generateCode(form.name);
      
      const payload = {
        code: generatedCode,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
        isStatic: form.isStatic,
        isRequired: form.isRequired,
        hasTemplate: form.hasTemplate,
        templateName: form.templateName || null,
        order: Number(form.order) || 0,
        customFields: JSON.stringify(form.customFields),
        categoryIds: form.categoryIds.length > 0 ? form.categoryIds : undefined,
      };
      
      if (form.id) {
        await adminApi.updateDocumentType(form.id, payload);
        toast.success('Belge türü güncellendi.');
      } else {
        await adminApi.createDocumentType(payload);
        toast.success('Yeni belge türü eklendi.');
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10"><span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" /></div>;
  }

  const activeCategories = categories.filter(c => c.isActive);

  const filteredTypes = types.filter(t => {
    if (filterType === 'STATIC') return t.isStatic === true;
    if (filterType === 'PERIODIC') return t.isStatic !== true;
    return true;
  });

  const staticCount = types.filter(t => t.isStatic === true).length;
  const periodicCount = types.filter(t => t.isStatic !== true).length;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gray-900">Tanımlı Belge Türleri</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sisteme yeni kaydedilen bursiyerler için ilk kayıt evraklarını, ekstra soruları ve her yarıyıl istenecek dönemsel belgeleri yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInitStandard}
            disabled={syncing}
            className="btn-secondary btn-sm flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100"
            title="13 ilk kayıt evrakını ve 2 dönemsel belgeyi otomatik yükler"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            {syncing ? 'Yükleniyor...' : 'Standart Belgeleri Eşitle'}
          </button>
          <button onClick={handleAdd} className="btn-primary btn-sm flex items-center gap-1.5 text-xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Belge Türü
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterType === 'ALL'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tümü ({types.length})
        </button>
        <button
          onClick={() => setFilterType('STATIC')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            filterType === 'STATIC'
              ? 'bg-purple-600 text-white'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          <span>📋 İlk Kayıt / Statik Belgeler</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{staticCount}</span>
        </button>
        <button
          onClick={() => setFilterType('PERIODIC')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            filterType === 'PERIODIC'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <span>🔄 Dönemsel Belgeler</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{periodicCount}</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTypes.map(t => {
          let catIds: string[] = [];
          try { catIds = t.categoryIds ? JSON.parse(t.categoryIds) : []; } catch (e) {}
          
          let parsedFields: CustomField[] = [];
          try { parsedFields = t.customFields ? JSON.parse(t.customFields) : []; } catch (e) {}

          const isStaticDoc = t.isStatic === true;
          const isRequiredDoc = t.isRequired !== false;

          return (
            <div
              key={t.id}
              className="card p-5 border-l-4 transition-all hover:shadow-md flex flex-col justify-between"
              style={{ borderLeftColor: !t.isActive ? '#9ca3af' : isStaticDoc ? '#8b5cf6' : '#3b82f6' }}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-sm">{t.name}</h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isStaticDoc ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-semibold">
                        İlk Kayıt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">
                        Dönemsel
                      </span>
                    )}
                    {isRequiredDoc ? (
                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-medium">
                        Zorunlu
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-medium">
                        Opsiyonel (Varsa)
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 mb-3 min-h-[2.5rem] line-clamp-2">{t.description || 'Açıklama belirtilmemiş.'}</p>
                
                {t.hasTemplate && (
                  <div className="mb-3 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-1.5">
                    <span>📄</span>
                    <span className="font-medium text-[11px] truncate">İmzalanacak Şablon: {t.templateName || 'Belirtilmedi'}</span>
                  </div>
                )}

                {parsedFields.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Dinamik Sorular:</span>
                    <div className="flex flex-wrap gap-1">
                      {parsedFields.map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded text-[10px]">
                          {f.label} ({f.type === 'number' ? 'Sayı' : f.type === 'textarea' ? 'Uzun Metin' : 'Metin'})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Geçerli Programlar:</span>
                  <div className="flex flex-wrap gap-1">
                    {catIds.length > 0 ? (
                      catIds.map(id => {
                        const cat = categories.find(c => c.id === id);
                        return cat ? (
                          <span key={id} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">
                            {cat.name}
                          </span>
                        ) : null;
                      })
                    ) : (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                        Tüm Bursiyerler
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleEdit(t)} className="btn-secondary btn-sm flex-1 text-xs font-medium">
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Belge Türünü Sil"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">{form.id ? 'Belge Türünü Düzenle' : 'Yeni Belge Türü Ekle'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Belge Adı <span className="text-red-500">*</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Örn: YKS Sonuç Belgesi" required />
                </div>
                <div>
                  <label className="form-label">Belge Kodu (Sistem Kodu)</label>
                  <input className="form-input font-mono text-xs" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Boş bırakılırsa addan üretilir" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Açıklama</label>
                  <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Öğrencilere gösterilecek açıklama..." />
                </div>

                {/* Belge Tipi & Zorunluluk */}
                <div className="col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Belge Kapsamı ve Zorunluluk</h4>
                  
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      checked={form.isStatic}
                      onChange={e => setForm(f => ({ ...f, isStatic: e.target.checked }))}
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">İlk Kayıt / Statik Belge (Tek Seferlik)</span>
                      <p className="text-xs text-gray-500">İşaretlenirse öğrenci bu belgeyi yalnızca ilk kayıtta bir kez yükler (dönemlerden bağımsızdır).</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                      checked={form.isRequired}
                      onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">Yüklenmesi Zorunlu Belge</span>
                      <p className="text-xs text-gray-500">İşareti kaldırırsanız öğrenci panelinde <em>"Opsiyonel (Varsa)"</em> olarak işaretlenir (Yurt belgesi, Kira kontratı gibi).</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      checked={form.hasTemplate}
                      onChange={e => setForm(f => ({ ...f, hasTemplate: e.target.checked }))}
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">İmzalanacak Hazır Şablonu Var</span>
                      <p className="text-xs text-gray-500">Taahhütname ve açık rıza metni gibi öğrencinin indirip imzalayarak yüklemesi gereken evraklarda kullanılır.</p>
                    </div>
                  </label>

                  {form.hasTemplate && (
                    <div className="pl-7 pt-2">
                      <label className="form-label text-xs">Şablon Dosya Adı / Başlığı</label>
                      <input
                        className="form-input text-xs"
                        value={form.templateName}
                        onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))}
                        placeholder="Örn: Bursiyer_Taahhutnamesi.pdf"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 cursor-pointer pt-2 border-t border-gray-200">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      checked={form.isActive}
                      onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800">Aktif Belge Türü</span>
                      <p className="text-[11px] text-gray-400">İşareti kaldırırsanız bu belge türü öğrencilere görünmez.</p>
                    </div>
                  </label>
                </div>

                {/* Dinamik Sorular (Form Alanları) */}
                <div className="col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"/><line x1="3" y1="22" x2="21" y2="22"/></svg>
                      Dinamik Sorular (Form Alanları)
                    </h4>
                    <button type="button" onClick={addField} className="btn-secondary btn-sm flex items-center gap-1 bg-white text-xs">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Soru Ekle
                    </button>
                  </div>

                  {form.customFields.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-3 italic">Ekstra soru eklenmedi. Sadece dosya yükleme alanı çıkacak.</p>
                  ) : (
                    <div className="space-y-3">
                      {form.customFields.map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex-1 grid grid-cols-12 gap-2">
                            <div className="col-span-5">
                              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">Soru Etiketi</label>
                              <input className="form-input py-1.5 text-xs" value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} placeholder="Örn: Sıralama, Not vb." required />
                            </div>
                            <div className="col-span-4">
                              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">Soru Tipi</label>
                              <select className="form-select py-1.5 text-xs" value={field.type} onChange={e => updateField(idx, 'type', e.target.value)}>
                                <option value="text">Kısa Metin</option>
                                <option value="number">Sayı (Örn: Sınıf / Sıralama)</option>
                                <option value="textarea">Uzun Metin (Not / Açıklama)</option>
                              </select>
                            </div>
                            <div className="col-span-3 flex items-center justify-center pt-5">
                              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={field.required} onChange={e => updateField(idx, 'required', e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                Zorunlu
                              </label>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeField(idx)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded mt-4" title="Soruyu Kaldır">
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="form-label mb-1.5">Bursiyer Kategorileri</label>
                  <p className="text-[11px] text-gray-400 mb-2">Bu belge türü hangi kategorilere özel olsun? Hiçbiri seçilmezse tüm kategorilerde geçerli olur.</p>
                  <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-gray-50/50">
                    {activeCategories.length === 0 ? (
                      <p className="text-xs text-gray-400">Henüz kategori tanımlanmamış.</p>
                    ) : (
                      activeCategories.map(cat => (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded transition-colors">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                            checked={form.categoryIds.includes(cat.id)}
                            onChange={() => {
                              setForm(prev => ({
                                ...prev,
                                categoryIds: prev.categoryIds.includes(cat.id)
                                  ? prev.categoryIds.filter(id => id !== cat.id)
                                  : [...prev.categoryIds, cat.id]
                              }));
                            }}
                          />
                          <span className="text-sm text-gray-700">{cat.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
                {form.id ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(form.id!, form.name)}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Bu Belge Türünü Sil
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">İptal</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Delete Confirmation Modal ── */}
      {deleteModalId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Belge Türünü Sil</h3>
            <p className="text-gray-500 text-sm mb-6">
              <span className="font-semibold text-gray-700">{deleteModalLabel}</span> adlı belge türünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => {
                  setDeleteModalId(null);
                  setDeleteModalLabel(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={deleting}
              >
                İptal
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                disabled={deleting}
              >
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
