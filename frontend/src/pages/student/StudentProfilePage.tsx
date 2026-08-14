import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { studentApi, documentApi, eventApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod, Event } from '../../types';
import { PersonalTab, EducationTab, DocumentsTab } from '../../components/ProfileTabs';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const TABS = ['Kişisel Bilgiler', 'Eğitim Bilgileri', 'Dokümanlar'];

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Slider & Calendar states
  const [slideIndex, setSlideIndex] = useState(0);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<Event | null>(null);

  const profileId = user?.profileId;

  async function loadAll() {
    if (!profileId) return;
    try {
      const [p, d, periods, evs, types] = await Promise.all([
        studentApi.getProfile(profileId),
        studentApi.getDocuments(profileId),
        documentApi.getPeriods(),
        eventApi.listEvents(),
        documentApi.getActiveTypes().catch(() => []),
      ]);
      setProfile(p);
      setDocuments(d);
      setPeriods(periods);
      setEvents(evs);
      setDocTypes(types);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [profileId]);



  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-gray-500">Profil yüklenemedi.</div>
    );
  }

  const hasPending = (profile.approvableChanges?.length ?? 0) > 0;

  const activeDeadlines = periods.filter(p => {
    if (!p.isOpen) return false;

    // Fallback: If for some reason we still need to check period categories, we ignore it here
    // as the single source of truth is now the DocumentType (Belge Türü) categoryIds.

    const docTypeObj = docTypes.find(dt => dt.code === p.type);
    if (docTypeObj) {
      let dtCatIds: string[] = [];
      try {
        dtCatIds = docTypeObj.categoryIds ? JSON.parse(docTypeObj.categoryIds) : [];
        if (!Array.isArray(dtCatIds)) dtCatIds = [];
      } catch {}

      if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
        return false;
      }
      if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
        return false;
      }
    }

    const isUploaded = documents.some(d => d.periodId === p.id && d.status !== 'REJECTED');
    return !isUploaded;
  });

  return (
    <div className="animate-fade-in">
      {/* Top Banner (removed for current scholars) */}
      {/* Events & Calendar Widget */}
      {(() => {
        if (events.length === 0) return null;
        
        // Calendar days calculation
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const calendarDays = [];
        for (let i = 0; i < emptyDays; i++) {
          calendarDays.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
          calendarDays.push(i);
        }

        const currentEvent = events[slideIndex] || events[0];

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Event Banner Slider (2/3 width) */}
            <div className="lg:col-span-2 card flex flex-col justify-between overflow-hidden relative min-h-[300px]">
              {/* Header */}
              <div className="card-header border-b border-gray-150 flex items-center justify-between z-10 py-3.5 px-5">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-approved animate-pulse" />
                  Yaklaşan Eğitim ve Etkinlikler
                </h2>
                {events.length > 1 && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSlideIndex(prev => (prev === 0 ? events.length - 1 : prev - 1))}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <button
                      onClick={() => setSlideIndex(prev => (prev === events.length - 1 ? 0 : prev + 1))}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Slide Content */}
              {currentEvent && (
                <div className="flex-1 flex flex-col md:flex-row min-h-[220px]">
                  {currentEvent.imagePath ? (
                    <div className="w-full md:w-2/5 h-48 md:h-full relative overflow-hidden flex-shrink-0">
                      <img
                        src={`/${currentEvent.imagePath}`}
                        alt={currentEvent.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full md:w-2/5 h-48 md:h-full bg-gradient-to-br from-red-50 to-red-100/50 flex items-center justify-center text-primary-600 flex-shrink-0 border-r border-gray-100">
                      <svg viewBox="0 0 24 24" className="w-12 h-12 stroke-current opacity-80" fill="none" strokeWidth="1.5"><path d="M19 4h-1V3c0-.55-.45-1-1-1s-1 .45-1 1v1H8V3c0-.55-.45-1-1-1s-1 .45-1 1v1H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/></svg>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-primary-600 mb-1 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {format(new Date(currentEvent.date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                      </div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight mb-2">{currentEvent.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed line-clamp-4">
                        {currentEvent.description || 'Bu eğitime dair ek bir detay paylaşılmamıştır.'}
                      </p>
                    </div>
                    {currentEvent.meetingUrl && (
                      <a
                        href={currentEvent.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary py-1.5 px-4 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white mt-4 self-start shadow-sm"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        Toplantıya Katıl
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Event Calendar (1/3 width) */}
            <div className="card overflow-hidden flex flex-col justify-between min-h-[300px]">
              <div className="card-header border-b border-gray-150 py-3.5 px-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Eğitim Takvimi</h2>
                <div className="flex gap-1 items-center">
                  <button
                    onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="text-xs font-bold text-gray-700 px-1">
                    {format(calendarDate, 'MMMM yyyy', { locale: tr })}
                  </span>
                  <button
                    onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
              
              {/* Grid */}
              <div className="p-4 flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
                  <span>Pt</span><span>Sa</span><span>Ça</span><span>Pe</span><span>Cu</span><span>Ct</span><span>Pz</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((dayNum, idx) => {
                    if (dayNum === null) {
                      return <div key={`empty-${idx}`} className="h-8" />;
                    }

                    const dayEvents = events.filter(e => {
                      const d = new Date(e.date);
                      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
                    });
                    const hasEvent = dayEvents.length > 0;

                    return (
                      <button
                        key={`day-${dayNum}`}
                        type="button"
                        onClick={() => hasEvent && setSelectedCalendarEvent(dayEvents[0])}
                        disabled={!hasEvent}
                        className={`h-8 w-8 rounded-full flex flex-col items-center justify-center text-xs font-medium relative transition-colors ${
                          hasEvent
                            ? 'bg-red-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 cursor-pointer font-bold border border-primary-200 shadow-sm'
                            : 'text-gray-700 cursor-default'
                        }`}
                      >
                        {dayNum}
                        {hasEvent && (
                          <span className="w-1 h-1 rounded-full bg-primary-600 absolute bottom-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Selected Calendar Event Detail Modal */}
      {selectedCalendarEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-base text-gray-900">Eğitim Detayı</h3>
              <button onClick={() => setSelectedCalendarEvent(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            {selectedCalendarEvent.imagePath && (
              <img
                src={`/${selectedCalendarEvent.imagePath}`}
                alt={selectedCalendarEvent.title}
                className="w-full h-44 object-cover"
              />
            )}
            
            <div className="p-5">
              <div className="text-xs font-semibold text-primary-600 mb-1 flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {format(new Date(selectedCalendarEvent.date), 'dd MMMM yyyy HH:mm', { locale: tr })}
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-2">{selectedCalendarEvent.title}</h4>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                {selectedCalendarEvent.description || 'Bu eğitime dair ek bir detay paylaşılmamıştır.'}
              </p>
              
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {selectedCalendarEvent.meetingUrl ? (
                  <a
                    href={selectedCalendarEvent.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary py-2 px-4 rounded-lg flex-1 text-center text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    Toplantıya Katıl
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 block text-center flex-1 py-2">Bu etkinlik için toplantı linki eklenmemiş.</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCalendarEvent(null)}
                  className="btn-secondary py-2 px-4 rounded-lg text-xs font-semibold"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-start gap-5">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-2xl font-bold overflow-hidden">
                {profile.photoPath ? (
                  <img src={`/${profile.photoPath}`} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.user?.tcKimlikNo || profile.id}`} alt="Avatar" className="w-full h-full object-cover" />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {profile.firstName} {profile.lastName}
                  </h1>
                  {(profile.department || profile.universityName) && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {[profile.department, profile.universityName].filter(Boolean).join(' — ')}
                    </p>
                  )}
                  {(profile.scholarshipCategory?.name) && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {(profile.scholarshipCategory?.name) === 'Sedefteki İnciler' ? (
                        <img src="/sedefteki-inciler-logo.png" alt="Sedefteki İnciler" className="h-6 object-contain" />
                      ) : (profile.scholarshipCategory?.name) === 'İz Bırakanlar' ? (
                        <img src="/izbirakanlar-logo.png" alt="İz Bırakanlar" className="h-6 object-contain" />
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                      )}
                      <span className="text-[11px] font-semibold text-gray-500">{profile.scholarshipCategory?.name} Programı</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {hasPending && (
                    <span className="badge-pending flex-shrink-0">
                      {profile.approvableChanges!.length} onay bekliyor
                    </span>
                  )}
                  
                  {/* Notifications Bell */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} 
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors relative text-gray-600 hover:text-gray-900"
                    >
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {activeDeadlines.length > 0 && (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold border-2 border-white">
                          {activeDeadlines.length}
                        </span>
                      )}
                    </button>

                    {isNotificationsOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                        <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="font-semibold text-gray-800 text-sm">Bildirimler</h3>
                          <span className="text-xs text-gray-500">{activeDeadlines.length} yeni bildirim</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {activeDeadlines.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">
                              Yeni bildiriminiz yok.
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {activeDeadlines.map(period => {
                                const docTypeObj = docTypes.find(dt => dt.code === period.type);
                                let labelText = docTypeObj ? docTypeObj.name : period.type;
                                if (!docTypeObj) {
                                  if (period.type === 'TRANSCRIPT') labelText = 'Transkripti';
                                  else if (period.type === 'STUDENT_CERTIFICATE') labelText = 'Öğrenci Belgesi';
                                  else if (period.type === 'VOLUNTEER_REPORT') labelText = 'STK Gönüllülük Raporu';
                                }

                                return (
                                  <div key={period.id} className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-start gap-3">
                                    <div className="mt-0.5 flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full" />
                                    <div>
                                      <p className="text-sm text-gray-800 font-medium">
                                        <span className="font-bold text-primary-600">{labelText}</span> yüklemeye açıldı!
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Lütfen {period.label} dönemi için belgenizi yükleyiniz.
                                      </p>
                                      <button
                                        onClick={() => {
                                          setIsNotificationsOpen(false);
                                          setActiveTab(2);
                                        }}
                                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 mt-2 flex items-center gap-1"
                                      >
                                        Hemen Yükle
                                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3">
                {profile.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.4 19.79 19.79 0 0 1 1.61 4.74 2 2 0 0 1 3.6 2.54h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/></svg>
                    {profile.phone}
                  </div>
                )}
                {profile.email && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    {profile.email}
                  </div>
                )}
                {profile.address && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {profile.address}
                  </div>
                )}
              </div>

              {/* Contact edit */}
              <div className="mt-3">
                <ContactEditButton profile={profile} onSaved={loadAll} />
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Profile Tabs (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="tabs border-b border-gray-200">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`tab ${activeTab === i ? 'tab-active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="card-body">
              {activeTab === 0 && (
                <PersonalTab
                  profile={profile}
                  onSave={async (data) => {
                    await studentApi.updatePersonal(profile.id, data);
                    await loadAll();
                  }}
                  readOnly={false}
                />
              )}
              {activeTab === 1 && (
                <EducationTab
                  profile={profile}
                  onSave={async (data) => {
                    await studentApi.updateEducation(profile.id, data);
                    await loadAll();
                  }}
                  readOnly={false}
                />
              )}
              {activeTab === 2 && (
                <DocumentsTab
                  profile={profile}
                  documents={documents}
                  periods={periods}
                  onUpload={loadAll}
                  readOnly={false}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Mentor Card (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="card shadow-sm border border-gray-150 overflow-hidden">
            <div className="card-header bg-gray-50/50 py-3.5 px-4 border-b border-gray-150 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-800">Mentörünüz</h2>
            </div>
            <div className="card-body p-5">
              {profile.mentor ? (
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden mx-auto bg-gray-100 border-2 border-primary-200 shadow-sm mb-4">
                    {profile.mentor.photoPath ? (
                      <img src={`/${profile.mentor.photoPath}`} alt={`${profile.mentor.firstName} ${profile.mentor.lastName}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 font-bold text-2xl uppercase">
                        {profile.mentor.firstName[0]}{profile.mentor.lastName[0]}
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1">
                    {profile.mentor.firstName} {profile.mentor.lastName}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium mb-4">
                    {profile.mentor.title || 'Mentör'}
                    {profile.mentor.company ? ` @ ${profile.mentor.company}` : ''}
                  </p>
                  
                  <div className="space-y-2.5 text-sm text-gray-600 text-left border-t border-gray-100 pt-4">
                    {profile.mentor.email && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        <span className="truncate">{profile.mentor.email}</span>
                      </div>
                    )}
                    {profile.mentor.phone && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        <span>{profile.mentor.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center border border-dashed border-gray-200">
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096L9 21zm0 0h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">Mentörünüz henüz atanmadı</h3>
                  <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                    Eşleştirme işlemleri tamamlandığında mentör bilgilerinizi burada görebilirsiniz.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactEditButton({ profile, onSaved }: { profile: StudentProfile; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: profile.phone || '', email: profile.email || '', address: profile.address || '' });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await studentApi.updateContact(profile.id, form);
      toast.success('İletişim bilgileri güncellendi.');
      setOpen(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        İletişim Bilgilerini Düzenle
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-modal w-full max-w-sm">
        <div className="p-5 border-b border-gray-200">
          <h3 className="font-semibold">İletişim Bilgilerini Güncelle</h3>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="form-label">Telefon</label>
            <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">E-posta</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Adres</label>
            <textarea className="form-textarea" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">İptal</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
