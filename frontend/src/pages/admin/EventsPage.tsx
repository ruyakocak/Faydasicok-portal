import { useEffect, useState } from 'react';
import { eventApi } from '../../api';
import type { Event } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await eventApi.listEvents();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
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

      await eventApi.createEvent(fd);
      toast.success('Eğitim/Etkinlik başarıyla oluşturuldu.');
      setShowCreate(false);
      // Reset form
      setTitle('');
      setDescription('');
      setDate('');
      setMeetingUrl('');
      setFile(null);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Bu etkinliği silmek istediğinizden emin misiniz?')) return;
    try {
      await eventApi.deleteEvent(id);
      toast.success('Etkinlik silindi.');
      load();
    } catch (e) {
      // Error handled by interceptor
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Eğitim ve Etkinlik Yönetimi</h1>
          <p className="page-subtitle">Bursiyerler için yaklaşan eğitim ve etkinlikleri düzenleyin</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
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
                  <p className="text-xs text-gray-500 line-clamp-3">{event.description || 'Açıklama belirtilmemiş.'}</p>
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
                <button
                  onClick={() => handleDelete(event.id)}
                  className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 py-1 px-2.5 text-xs font-medium"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900">Yeni Eğitim veya Etkinlik Ekle</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
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
              <div className="grid grid-cols-1 gap-4">
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
              </div>
              <div>
                <label className="form-label mb-1">Afiş Görseli (JPG, PNG)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input text-sm py-1.5"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>
                  {creating ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
