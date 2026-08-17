import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { announcementApi, adminApi } from '../../api';
import type { Announcement, ScholarshipCategory } from '../../types';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [anns, cats] = await Promise.all([
        announcementApi.listAnnouncements(),
        adminApi.listScholarshipCategories(),
      ]);
      setAnnouncements(anns);
      setCategories(cats);
    } catch (err: any) {
      toast.error('Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  function openModal(ann?: Announcement) {
    if (ann) {
      setEditingAnn(ann);
      setTitle(ann.title);
      setContent(ann.content);
      setIsActive(ann.isActive);
      try {
        setSelectedCats(ann.categoryIds ? JSON.parse(ann.categoryIds) : []);
      } catch {
        setSelectedCats([]);
      }
    } else {
      setEditingAnn(null);
      setTitle('');
      setContent('');
      setIsActive(true);
      setSelectedCats([]);
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingAnn(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      return toast.error('Lütfen başlık ve içerik alanlarını doldurun.');
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        categoryIds: selectedCats.length > 0 ? selectedCats : [],
        isActive,
      };

      if (editingAnn) {
        await announcementApi.updateAnnouncement(editingAnn.id, payload);
        toast.success('Duyuru başarıyla güncellendi.');
      } else {
        await announcementApi.createAnnouncement(payload);
        toast.success('Yeni duyuru başarıyla oluşturuldu.');
      }
      closeModal();
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    try {
      await announcementApi.deleteAnnouncement(id);
      toast.success('Duyuru silindi.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Silinirken bir hata oluştu.');
    }
  }

  const toggleCategory = (catId: string) => {
    setSelectedCats(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Duyurular</h1>
          <p className="text-sm text-gray-500 mt-1">
            Öğrencilerinize özel veya genel duyurular oluşturun ve yönetin.
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-primary py-2.5 px-4 shadow-sm flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Duyuru Ekle
        </button>
      </div>

      <div className="card overflow-hidden">
        {announcements.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">Henüz duyuru bulunmuyor</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Yeni bir duyuru oluşturarak öğrencilerinize anında ulaşabilirsiniz.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-500 bg-gray-50/50 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Başlık</th>
                  <th className="px-6 py-4 font-semibold">Hedef Kitle</th>
                  <th className="px-6 py-4 font-semibold">Durum</th>
                  <th className="px-6 py-4 font-semibold">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {announcements.map((ann) => {
                  let catNames = 'Tüm Öğrenciler';
                  if (ann.categoryIds) {
                    try {
                      const cIds: string[] = JSON.parse(ann.categoryIds);
                      if (cIds.length > 0) {
                        catNames = cIds.map(id => categories.find(c => c.id === id)?.name || 'Bilinmeyen').join(', ');
                      }
                    } catch {}
                  }

                  return (
                    <tr key={ann.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => openModal(ann)}>
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-semibold text-gray-900 break-words line-clamp-1" title={ann.title}>{ann.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5 break-words line-clamp-2" title={ann.content}>{ann.content}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${ann.categoryIds && JSON.parse(ann.categoryIds).length > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                          {catNames}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {ann.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Pasif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        {format(new Date(ann.createdAt), 'dd MMM yyyy', { locale: tr })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingAnn ? 'Duyuruyu Düzenle' : 'Yeni Duyuru Ekle'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="announcementForm" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="form-label font-semibold text-gray-700">Duyuru Başlığı</label>
                  <input
                    type="text"
                    required
                    className="form-input rounded-xl"
                    placeholder="Örn: 2026 Bahar Dönemi Evrakları Hakkında"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="form-label font-semibold text-gray-700">İçerik</label>
                  <textarea
                    required
                    rows={4}
                    className="form-textarea rounded-xl resize-none"
                    placeholder="Duyuru detaylarını buraya yazın..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label font-semibold text-gray-700 mb-1.5">Hedef Kitle (Öğrenci Grubu)</label>
                  <p className="text-xs text-gray-500 mb-3">Hiçbiri seçilmezse duyuru <strong>tüm öğrencilere</strong> gösterilir.</p>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-200">
                    {categories.length === 0 ? (
                      <div className="text-xs text-gray-500 text-center py-2">Kayıtlı kategori bulunamadı.</div>
                    ) : (
                      categories.map(cat => (
                        <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="form-checkbox text-primary-600 rounded cursor-pointer border-gray-300 focus:ring-primary-500"
                            checked={selectedCats.includes(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                          />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                            {cat.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-150">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <div>
                    <label htmlFor="isActive" className="text-sm font-bold text-gray-800 cursor-pointer">Duyuru Aktif Mi?</label>
                    <p className="text-xs text-gray-500">Kapalı olduğunda öğrencilere gösterilmez.</p>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-gray-150 bg-gray-50 flex justify-between gap-3">
              {editingAnn ? (
                <button type="button" onClick={() => { handleDelete(editingAnn.id); closeModal(); }} className="btn-secondary py-2.5 px-5 rounded-xl font-semibold text-red-600 hover:bg-red-50 hover:border-red-200">
                  Sil
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button type="button" onClick={closeModal} className="btn-secondary py-2.5 px-5 rounded-xl font-semibold">
                  İptal
                </button>
                <button type="submit" form="announcementForm" className="btn-primary py-2.5 px-6 rounded-xl font-semibold flex items-center gap-2" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner border-white/30 border-t-white w-4 h-4" />
                      Kaydediliyor...
                    </>
                  ) : (
                    editingAnn ? 'Değişiklikleri Kaydet' : 'Oluştur'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
