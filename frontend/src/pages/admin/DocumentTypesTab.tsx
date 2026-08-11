import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { DocumentTypeConfig } from '../../types';
import toast from 'react-hot-toast';

interface CustomField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export default function DocumentTypesTab() {
  const [types, setTypes] = useState<DocumentTypeConfig[]>([]);
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
  }>({
    code: '',
    name: '',
    description: '',
    isActive: true,
    customFields: [],
  });

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.listDocumentTypes();
      setTypes(data);
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
    
    setForm({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description || '',
      isActive: item.isActive,
      customFields: parsedFields,
    });
    setShowModal(true);
  }

  function handleAdd() {
    setForm({ code: '', name: '', description: '', isActive: true, customFields: [] });
    setShowModal(true);
  }

  function addField() {
    setForm(prev => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { id: Math.random().toString(36).substring(7), label: '', type: 'text', required: false }
      ]
    }));
  }

  function removeField(index: number) {
    setForm(prev => {
      const newFields = [...prev.customFields];
      newFields.splice(index, 1);
      return { ...prev, customFields: newFields };
    });
  }

  function updateField(index: number, key: keyof CustomField, value: any) {
    setForm(prev => {
      const newFields = [...prev.customFields];
      newFields[index] = { ...newFields[index], [key]: value };
      return { ...prev, customFields: newFields };
    });
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
        {types.map(t => (
          <div key={t.id} className="card p-5 border-l-4" style={{ borderLeftColor: t.isActive ? '#10b981' : '#9ca3af' }}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{t.name}</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {t.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4 h-10 line-clamp-2">{t.description}</p>
            
            <button onClick={() => handleEdit(t)} className="btn-secondary btn-sm w-full text-xs">Düzenle</button>
          </div>
        ))}
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
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Aktif (Yeni açılan dönemlerde otomatik eklensin mi?)</label>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"/><line x1="3" y1="22" x2="21" y2="22"/></svg>
                    Dinamik Sorular (Form Alanları)
                  </h4>
                  <button type="button" onClick={addField} className="btn-secondary btn-sm flex items-center gap-1 bg-white">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Soru Ekle
                  </button>
                </div>

                {form.customFields.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 italic">Ekstra soru eklenmedi. Sadece dosya yükleme alanı çıkacak.</p>
                ) : (
                  <div className="space-y-3">
                    {form.customFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <div className="col-span-5">
                            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">Soru Etiketi</label>
                            <input className="form-input py-1.5 text-sm" value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} placeholder="Örn: Gönüllü Kurum Adı" required />
                          </div>
                          <div className="col-span-4">
                            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">Soru Tipi</label>
                            <select className="form-select py-1.5 text-sm" value={field.type} onChange={e => updateField(idx, 'type', e.target.value)}>
                              <option value="text">Kısa Metin</option>
                              <option value="number">Sayı (Örn: Sınıf)</option>
                              <option value="textarea">Uzun Metin (Not)</option>
                            </select>
                          </div>
                          <div className="col-span-3 flex items-center justify-center pt-5">
                            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={field.required} onChange={e => updateField(idx, 'required', e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                              Zorunlu
                            </label>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeField(idx)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded mt-5">
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
