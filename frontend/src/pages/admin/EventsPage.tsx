import { useEffect, useState } from 'react';
import { eventApi, adminApi } from '../../api';
import type { Event, ScholarshipCategory } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [evData, catData] = await Promise.all([
        eventApi.listEvents(),
        adminApi.listScholarshipCategories(),
      ]);
      setEvents(evData);
      setCategories(catData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setDate('');
    setMeetingUrl('');
    setFile(null);
    setRemoveImage(false);
    setSelectedCats([]);
  }

  function handleEditClick(event: Event) {
    setEditingEventId(event.id);
    setTitle(event.title);
    setDescription(event.description || '');
    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    const d = new Date(event.date);
    const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    setDate(localISOTime);
    setMeetingUrl(event.meetingUrl || '');
    setFile(null);
    setRemoveImage(false);
    
    if (event.categoryIds) {
      try {
        const parsed = JSON.parse(event.categoryIds);
        setSelectedCats(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSelectedCats([]);
      }
    } else {
      setSelectedCats([]);
    }
    
    setShowCreate(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !date) {
      toast.error('Başlık ve tarih zorunludur.');
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('date', new Date(date).toISOString());
      if (meetingUrl) fd.append('meetingUrl', meetingUrl);
      if (file) fd.append('file', file);
      if (removeImage) fd.append('removeImage', 'true');
      // pass categoryIds as JSON string
      fd.append('categoryIds', JSON.stringify(selectedCats));

      if (editingEventId) {
        await eventApi.updateEvent(editingEventId, fd);
        toast.success('Eğitim/Etkinlik güncellendi.');
      } else {
        await eventApi.createEvent(fd);
        toast.success('Eğitim/Etkinlik başarıyla oluşturuldu.');
      }
      
      setShowCreate(false);
      resetForm();
      load();
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!eventToDelete) return;
    try {
      await eventApi.deleteEvent(eventToDelete);
      toast.success('Etkinlik silindi.');
      setEventToDelete(null);
      load();
    } catch (e) {
      // Error handled by interceptor
    }
  }

  const toggleCategory = (catId: string) => {
    setSelectedCats(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const getCategoryNames = (categoryIdsStr?: string | null) => {
    if (!categoryIdsStr) return 'Tüm Bursiyerler';
    try {
      const ids: string[] = JSON.parse(categoryIdsStr);
      if (ids.length === 0) return 'Tüm Bursiyerler';
      return ids.map(id => categories.find(c => c.id === id)?.name || 'Bilinmeyen').join(', ');
    } catch {
      return 'Tüm Bursiyerler';
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Eğitim ve Etkinlik Yönetimi</h1>
          <p className="page-subtitle">Bursiyerler için yaklaşan eğitim ve etkinlikleri düzenleyin</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="btn-primary flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Eğitim/Etkinlik Ekle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
        </div>
      ) : events.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Henüz oluşturulmuş bir eğitim veya etkinlik bulunmamaktadır.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <div key={event.id} className="card flex flex-col justify-between overflow-hidden">
              <div>
                {event.imagePath ? (
                  <img src={`/${event.imagePath}`} alt={event.title} className="w-full h-44 object-cover border-b border-gray-100" />
                ) : (
                  <div className="w-full h-44 bg-gray-100 flex items-center justify-center text-gray-400 text-sm border-b border-gray-100">
                    Afiş Görseli Yok
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold mb-1">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {format(new Date(event.date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base mb-1">{event.title}</h3>
                  <p className="text-xs text-gray-500 break-words line-clamp-1 mb-2" title={event.description || undefined}>{event.description || 'Açıklama belirtilmemiş.'}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${event.categoryIds && JSON.parse(event.categoryIds).length > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                    {getCategoryNames(event.categoryIds)}
                  </span>
                </div>
              </div>
              <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-gray-50 mt-2">
                {event.meetingUrl ? (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline truncate max-w-[150px]"
                  >
                    Toplantı Linki ➔
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">Link yok</span>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleEditClick(event)}
                    className="btn-secondary btn-sm text-gray-600 hover:text-gray-900 border-gray-200 py-1 px-2.5 text-xs font-medium"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => setEventToDelete(event.id)}
                    className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 py-1 px-2.5 text-xs font-medium"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Etkinliği Sil</h3>
              <p className="text-sm text-gray-500">Bu etkinliği silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            </div>
            <div className="p-4 bg-gray-50 flex gap-3">
              <button onClick={() => setEventToDelete(null)} className="btn-secondary flex-1">İptal</button>
              <button onClick={confirmDelete} className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 flex-1 border-transparent text-white">Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900">
                {editingEventId ? 'Eğitim / Etkinlik Düzenle' : 'Yeni Eğitim veya Etkinlik Ekle'}
              </h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="form-label mb-1">Eğitim/Etkinlik Adı</label>
                <input
                  className="form-input text-sm p-2.5"
                  placeholder="Örn: Python Programlamaya Giriş"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label mb-1">Açıklama / Detaylar</label>
                <textarea
                  className="form-textarea text-sm p-2.5 h-20 resize-none"
                  placeholder="Eğitim içeriği ve gereksinimleri..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label mb-1">Tarih ve Saat</label>
                <input
                  type="datetime-local"
                  className="form-input text-sm p-2.5"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label mb-1">Toplantı Linki (Zoom, Teams vb.)</label>
                <input
                  type="url"
                  className="form-input text-sm p-2.5"
                  placeholder="https://zoom.us/j/..."
                  value={meetingUrl}
                  onChange={e => setMeetingUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label mb-1">Afiş Görseli (JPG, PNG)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input text-sm py-1.5"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                {editingEventId && !file && (
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="form-checkbox text-red-500 rounded" 
                      checked={removeImage}
                      onChange={e => setRemoveImage(e.target.checked)}
                    />
                    Mevcut görseli kaldır
                  </label>
                )}
              </div>

              {/* Category Selection */}
              <div>
                <label className="form-label font-semibold text-gray-700 mb-1">Hedef Kitle</label>
                <p className="text-xs text-gray-500 mb-2">Hiçbiri seçilmezse <strong>tüm bursiyerlere</strong> gösterilir.</p>
                <div className="space-y-2 max-h-36 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-200">
                  {categories.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-2">Kayıtlı kategori bulunamadı.</div>
                  ) : (
                    categories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="form-checkbox text-primary-600 rounded cursor-pointer"
                          checked={selectedCats.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                        />
                        <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>
                  {creating ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : (editingEventId ? 'Güncelle' : 'Oluştur')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
