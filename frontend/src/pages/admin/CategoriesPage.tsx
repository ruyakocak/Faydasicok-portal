import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { ScholarshipCategory } from '../../types';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  useEffect(() => { load(); }, []);

  function openModal(cat?: ScholarshipCategory) {
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
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingCategory(null);
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
      closeModal();
      await load();
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Silinirken bir hata oluştu.');
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Bursiyer Kategorileri</h1>
          <p className="page-subtitle">Öğrencilerin atanabileceği burs kategorilerini (örn. İz Bırakanlar, Sedefteki İnciler) yönetin</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Kategori
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Henüz kategori bulunmuyor. Yeni bir kategori ekleyebilirsiniz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Kategori Adı</th>
                  <th className="py-3 px-4">Açıklama</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-900">{cat.name}</td>
                    <td className="py-3 px-4 text-gray-500">{cat.description || '-'}</td>
                    <td className="py-3 px-4">
                      {cat.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openModal(cat)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-3"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-xs"
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg">
                {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                <textarea
                  className="form-input"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Kategori hakkında kısa bilgi (opsiyonel)"
                />
              </div>

              {editingCategory && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                    Aktif Kategori (Seçilebilir durumda)
                  </label>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  İptal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
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
