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
  
  const [form, setForm] = useState<{
    id?: string;
    code: string;
    name: string;
    description: string;
    isActive: boolean;
    customFields: CustomField[];
    categoryIds: string[];
  }>({
    code: '',
    name: '',
    description: '',
    isActive: true,
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
      customFields: parsedFields,
      categoryIds: parsedCatIds,
    });
    setShowModal(true);
  }

  function handleAdd() {
    setForm({ code: '', name: '', description: '', isActive: true, customFields: [], categoryIds: [] });
    setShowModal(true);
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
      const generatedCode = form.id ? form.code : generateCode(form.name);
      
      const payload = {
        code: generatedCode,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Tanımlı Belge Türleri</h2>
          <p className="text-sm text-gray-500">Sistemde istenecek belge türlerini ve bu belgelere ait ekstra soruları yönetin.</p>
        </div>
        <button onClick={handleAdd} className="btn-primary btn-sm flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Belge Türü
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(t => {
          let catIds: string[] = [];
          try { catIds = t.categoryIds ? JSON.parse(t.categoryIds) : []; } catch (e) {}
          
          return (
            <div key={t.id} className="card p-5 border-l-4" style={{ borderLeftColor: t.isActive ? '#10b981' : '#9ca3af' }}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2 h-10 line-clamp-2">{t.description}</p>
              
              <div className="mb-4">
                <span className="text-[10px] font-medium text-gray-500 block mb-1">Kategoriler:</span>
                <div className="flex flex-wrap gap-1">
                  {catIds.length > 0 ? (
                    catIds.map(id => {
                      const cat = categories.find(c => c.id === id);
                      return cat ? (
                        <span key={id} className="px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded text-[10px]">
                          {cat.name}
                        </span>
                      ) : null;
                    })
                  ) : (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                      Tüm Kategoriler
                    </span>
                  )}
                </div>
              </div>
              
              <button onClick={() => handleEdit(t)} className="btn-secondary btn-sm w-full text-xs">Düzenle</button>
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
                <div className="col-span-2">
                  <label className="form-label">Belge Adı <span className="text-red-500">*</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Örn: Özel Gelir Belgesi" required />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Açıklama</label>
                  <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Öğrencilere gösterilecek açıklama..." />
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
                  {form.categoryIds.length === 0 && activeCategories.length > 0 && (
                    <span className="text-[11px] text-blue-500 mt-1.5 block">
                      ℹ️ Hiçbir kategori seçilmedi — belge türü tüm bursiyerlere açık olacak.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">İptal</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
