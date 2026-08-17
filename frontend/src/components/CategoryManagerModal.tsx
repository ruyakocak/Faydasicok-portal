import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { ScholarshipCategory } from '../types';
import toast from 'react-hot-toast';
import EmptyState from './EmptyState';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

export default function CategoryManagerModal({ isOpen, onClose, onCategoriesChanged }: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<ScholarshipCategory | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.listScholarshipCategories();
      setCategories(data);
    } catch (err: any) {
      toast.error('Kategoriler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      load();
      setEditingCategory(null);
    }
  }, [isOpen]);

  function startEditing(cat?: ScholarshipCategory) {
    if (cat) {
      setEditingCategory(cat);
      setName(cat.name);
      setDescription(cat.description || '');
      setIsActive(cat.isActive);
    } else {
      setEditingCategory(null);
      setName('');
      setDescription('');
      setIsActive(true);
    }
  }

  function cancelEditing() {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setIsActive(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      if (editingCategory) {
        await adminApi.updateScholarshipCategory(editingCategory.id, { name, description, isActive });
        toast.success('Kategori güncellendi.');
      } else {
        await adminApi.createScholarshipCategory({ name, description });
        toast.success('Kategori oluşturuldu.');
      }
      setEditingCategory(null);
      setName('');
      setDescription('');
      await load();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;
    try {
      await adminApi.deleteScholarshipCategory(id);
      toast.success('Kategori silindi.');
      await load();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Silinirken bir hata oluştu.');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-xl shadow-modal w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg tracking-tight">Kategorileri Yönet</h3>
            <p className="text-sm text-gray-500 mt-0.5">Bursiyer kategorilerini (örn. İz Bırakanlar) düzenleyin.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          {/* Create / Edit Form */}
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
            <h4 className="font-medium text-gray-900 mb-4">{editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Kategori Adı *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="örn. İz Bırakanlar"
                  />
                </div>
                <div>
                  <label className="form-label">Açıklama</label>
                  <input
                    type="text"
                    className="form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Opsiyonel kısa bilgi"
                  />
                </div>
              </div>

              {editingCategory && (
                <div className="flex items-center pt-2">
                  <input
                    type="checkbox"
                    id="isActiveCat"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 cursor-pointer"
                  />
                  <label htmlFor="isActiveCat" className="ml-2 block text-sm font-medium text-gray-700 cursor-pointer">
                    Aktif Kategori (Listelerde göster)
                  </label>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                {editingCategory && (
                  <button type="button" onClick={cancelEditing} className="btn-ghost">
                    İptal
                  </button>
                )}
                <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
                  {saving ? 'Kaydediliyor...' : (editingCategory ? 'Güncelle' : 'Ekle')}
                </button>
              </div>
            </form>
          </div>

          {/* List */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <span className="spinner border-gray-300 border-t-primary-500 w-6 h-6" />
              </div>
            ) : categories.length === 0 ? (
              <EmptyState 
                title="Kategori yok" 
                description="Sistemde tanımlı hiçbir kategori bulunmuyor. Yukarıdan yeni ekleyebilirsiniz." 
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kategori Adı</th>
                      <th>Açıklama</th>
                      <th>Durum</th>
                      <th className="text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td className="font-medium text-gray-900">{cat.name}</td>
                        <td className="text-gray-500">{cat.description || '-'}</td>
                        <td>
                          {cat.isActive ? (
                            <span className="badge-approved">Aktif</span>
                          ) : (
                            <span className="badge-gray">Pasif</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => startEditing(cat)}
                            className="text-primary-600 hover:text-primary-800 font-medium text-sm mr-3"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
