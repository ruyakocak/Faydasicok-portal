import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { volunteerApi } from '../api';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string;
  isDefault?: boolean;
}

interface FormDocument {
  id: string;
  label: string;
  required: boolean;
  isDefault?: boolean;
}

export default function VolunteerFormSettingsModal({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [documents, setDocuments] = useState<FormDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    volunteerApi.getSettingsSchema()
      .then(data => {
        setFields(data.fields || []);
        setDocuments(data.documents || []);
      })
      .catch(() => toast.error('Ayarlar yüklenirken hata oluştu.'))
      .finally(() => setLoading(false));
  }, []);

  function addField() {
    setFields([...fields, {
      id: 'field_' + Math.random().toString(36).substr(2, 9),
      label: '',
      type: 'text',
      required: false,
      isDefault: false
    }]);
  }

  function addDocument() {
    setDocuments([...documents, {
      id: 'doc_' + Math.random().toString(36).substr(2, 9),
      label: '',
      required: false,
      isDefault: false
    }]);
  }

  function updateField(index: number, key: keyof FormField, value: any) {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  }

  function updateDocument(index: number, key: keyof FormDocument, value: any) {
    const newDocs = [...documents];
    newDocs[index] = { ...newDocs[index], [key]: value };
    setDocuments(newDocs);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  function removeDocument(index: number) {
    setDocuments(documents.filter((_, i) => i !== index));
  }

  async function handleSave() {
    // Validate
    for (const f of fields) {
      if (!f.label.trim()) {
        toast.error('Tüm soruların bir başlığı olmalıdır.');
        return;
      }
      if (f.type === 'select' && (!f.options || !f.options.trim())) {
        toast.error('Seçmeli sorular için en az bir seçenek belirtmelisiniz.');
        return;
      }
    }
    for (const d of documents) {
      if (!d.label.trim()) {
        toast.error('Tüm belgelerin bir başlığı olmalıdır.');
        return;
      }
    }

    setSaving(true);
    try {
      await volunteerApi.saveSettingsSchema({ fields, documents });
      toast.success('Form ayarları başarıyla kaydedildi.');
      onClose();
    } catch (e) {
      toast.error('Kaydedilirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Form Ayarları (Dinamik Şema)</h3>
            <p className="text-sm text-gray-500 mt-1">Gönüllülük formunda yer alacak tüm soruları ve istenen belgeleri buradan düzenleyebilirsiniz.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-50 rounded-full transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          {loading ? (
            <div className="flex justify-center py-8"><span className="spinner w-6 h-6 border-gray-300 border-t-primary-500" /></div>
          ) : (
            <>
              {/* Fields Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Sorular</h4>
                {fields.map((field, idx) => (
                  <div key={field.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 relative group">
                    <button
                      onClick={() => removeField(idx)}
                      className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Soru Sil"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-10">
                      <div>
                        <label className="form-label text-xs">Soru Başlığı</label>
                        <input
                          className="form-input text-sm"
                          value={field.label}
                          onChange={e => updateField(idx, 'label', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label text-xs">Soru Tipi</label>
                        <select
                          className="form-select text-sm"
                          value={field.type}
                          onChange={e => updateField(idx, 'type', e.target.value)}
                          disabled={field.isDefault && field.type === 'number'} // Don't allow changing totalHours type easily
                        >
                          <option value="text">Kısa Metin</option>
                          <option value="textarea">Uzun Metin</option>
                          <option value="email">E-posta</option>
                          <option value="number">Sayı</option>
                          <option value="select">Seçmeli (Açılır Kutu)</option>
                          <option value="date">Tarih</option>
                        </select>
                      </div>
                    </div>

                    {field.type === 'select' && (
                      <div>
                        <label className="form-label text-xs">Seçenekler (Virgülle ayırın)</label>
                        <input
                          className="form-input text-sm"
                          value={field.options || ''}
                          onChange={e => updateField(idx, 'options', e.target.value)}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded text-primary-600 focus:ring-primary-500"
                          checked={field.required}
                          onChange={e => updateField(idx, 'required', e.target.checked)}
                        />
                        <span className="text-sm font-medium text-gray-700">Zorunlu Alan</span>
                      </label>
                      {field.isDefault && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Sistem Varsayılanı</span>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={addField}
                  className="w-full py-3 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                  Yeni Soru Ekle
                </button>
              </div>

              {/* Documents Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">İstenen Belgeler / Fotoğraflar</h4>
                {documents.map((doc, idx) => (
                  <div key={doc.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-4 relative group">
                    <div className="flex-1">
                      <label className="form-label text-xs">Belge Başlığı</label>
                      <input
                        className="form-input text-sm"
                        value={doc.label}
                        onChange={e => updateDocument(idx, 'label', e.target.value)}
                      />
                    </div>
                    <div className="pt-5 flex-shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded text-primary-600 focus:ring-primary-500"
                          checked={doc.required}
                          onChange={e => updateDocument(idx, 'required', e.target.checked)}
                        />
                        <span className="text-sm font-medium text-gray-700">Zorunlu</span>
                      </label>
                    </div>
                    <div className="pt-5">
                      <button
                        onClick={() => removeDocument(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Belgeyi Sil"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addDocument}
                  className="w-full py-3 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                  Yeni Belge İste
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary">İptal</button>
          <button onClick={handleSave} disabled={saving || loading} className="btn-primary">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
