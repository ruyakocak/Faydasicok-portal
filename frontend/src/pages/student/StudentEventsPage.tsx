import { useEffect, useState } from 'react';
import { eventApi } from '../../api';
import type { Event } from '../../types';
import toast from 'react-hot-toast';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function StudentEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const data = await eventApi.listEvents();
      setEvents(data);
    } catch (err: any) {
      toast.error('Etkinlikler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  const todayEvents = events.filter(e => isToday(new Date(e.date)));
  const upcomingEvents = events.filter(e => isFuture(new Date(e.date)) && !isToday(new Date(e.date)));
  const pastEvents = events.filter(e => isPast(new Date(e.date)) && !isToday(new Date(e.date)));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Eğitim ve Etkinlikler
        </h1>
        <p className="text-sm text-gray-500 mt-1">Sizin için planlanmış eğitim ve etkinlikleri takip edin.</p>
      </div>

      {events.length === 0 && (
        <div className="card p-16 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3 className="font-semibold text-gray-900">Planlanmış etkinlik bulunmuyor</h3>
          <p className="text-sm text-gray-500 mt-1">Yeni bir etkinlik eklendiğinde burada görünecektir.</p>
        </div>
      )}

      {/* Today's Events — Big Banner */}
      {todayEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Bugünkü Etkinlikler
          </h2>
          <div className="space-y-4">
            {todayEvents.map(event => (
              <div key={event.id} className="card overflow-hidden border-2 border-primary-200 shadow-md">
                <div className="flex flex-col md:flex-row min-h-[220px]">
                  {event.imagePath ? (
                    <div className="w-full md:w-2/5 h-52 md:h-auto relative overflow-hidden flex-shrink-0">
                      <img src={`/${event.imagePath}`} alt={event.title} className="w-full h-full object-cover" />
                      <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                        🟢 Bugün
                      </div>
                    </div>
                  ) : (
                    <div className="w-full md:w-2/5 h-52 md:h-auto bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col items-center justify-center text-primary-600 flex-shrink-0 border-r border-gray-100 relative">
                      <svg viewBox="0 0 24 24" className="w-16 h-16 stroke-current opacity-60" fill="none" strokeWidth="1"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                        🟢 Bugün
                      </div>
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-primary-600 mb-2">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {format(new Date(event.date), "dd MMMM yyyy · HH:mm", { locale: tr })}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{event.description || 'Bu eğitime dair ek bir detay paylaşılmamıştır.'}</p>
                    </div>
                    {event.meetingUrl && (
                      <a
                        href={event.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 btn-primary inline-flex items-center gap-2 self-start py-2 px-5 rounded-xl"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        Toplantıya Katıl
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            Yaklaşan Etkinlikler
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingEvents.map(event => (
              <div key={event.id} className="card overflow-hidden flex hover:shadow-md transition-shadow border border-gray-150">
                {event.imagePath ? (
                  <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
                    <img src={`/${event.imagePath}`} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-24 flex-shrink-0 bg-primary-50 flex items-center justify-center border-r border-gray-100">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary-300" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0">
                  <div className="text-xs font-semibold text-primary-600 mb-1">
                    {format(new Date(event.date), 'dd MMMM yyyy · HH:mm', { locale: tr })}
                  </div>
                  <h3 className="font-bold text-gray-900 line-clamp-1 mb-1">{event.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{event.description || 'Açıklama yok.'}</p>
                  {event.meetingUrl && (
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      Linke Git
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 8 14"/></svg>
            Geçmiş Etkinlikler
          </h2>
          <div className="space-y-2">
            {pastEvents.map(event => (
              <div key={event.id} className="card p-4 flex items-center gap-4 opacity-60 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {event.imagePath ? (
                    <img src={`/${event.imagePath}`} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">{format(new Date(event.date), 'dd MMMM yyyy', { locale: tr })}</div>
                  <div className="font-medium text-gray-600 line-clamp-1">{event.title}</div>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">Geçti</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
