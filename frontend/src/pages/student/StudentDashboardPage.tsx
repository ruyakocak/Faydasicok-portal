import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentApi, documentApi, eventApi, announcementApi, volunteerApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod, Event, Announcement } from '../../types';
import { format, isToday, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const profileId = user?.profileId;

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [myVolunteerForms, setMyVolunteerForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Announcement modal state
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);

  // Events slider state
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    async function loadDashboardData() {
      if (!profileId) return;
      try {
        const [p, d, pers, types, anns, evs, vForms] = await Promise.all([
          studentApi.getProfile(profileId).catch(() => null),
          studentApi.getDocuments(profileId).catch(() => []),
          documentApi.getPeriods().catch(() => []),
          documentApi.getActiveTypes().catch(() => []),
          announcementApi.getStudentAnnouncements(profileId).catch(() => []),
          eventApi.listEvents().catch(() => []),
          volunteerApi.getMyForms().catch(() => []),
        ]);

        setProfile(p);
        setDocuments(d);
        setPeriods(pers);
        setDocTypes(types);
        setAnnouncements(anns);
        setEvents(evs);
        setMyVolunteerForms(Array.isArray(vForms) ? vForms : []);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="spinner border-gray-300 border-t-primary-500 w-9 h-9" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card p-12 text-center text-gray-500">
        Profil bilgisi yüklenemedi. Lütfen sayfayı yenileyiniz.
      </div>
    );
  }

  // Calculate pending / required document deadlines
  const activeDeadlines = periods.filter(p => {
    if (!p.isOpen) return false;

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

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const eventsToday = events.filter(e => isToday(new Date(e.date)) && new Date(e.date) >= oneHourAgo);
  const currentEvent = eventsToday[slideIndex] || eventsToday[0];

  const hasVolunteerFormSubmitted = myVolunteerForms.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── 1. Hero Greeting Banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 sm:p-8 text-white shadow-md border border-gray-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-primary-500 to-rose-400 p-0.5 shadow-lg flex-shrink-0">
              <div className="w-full h-full bg-gray-900 rounded-[14px] overflow-hidden flex items-center justify-center">
                {profile.photoPath ? (
                  <img
                    src={`/${profile.photoPath}`}
                    alt={`${profile.firstName} ${profile.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-xl sm:text-2xl text-white">
                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Merhaba, {profile.firstName} {profile.lastName} 👋
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Aktif Bursiyer
                </span>
              </div>
              <p className="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
                <span>{profile.universityName || 'Üniversite belirtilmemiş'}</span>
                {profile.faculty && <span>• {profile.faculty}</span>}
                {profile.grade && <span>• {profile.grade}. Sınıf</span>}
              </p>
            </div>
          </div>

          {/* Program Logo & Badge */}
          {profile.scholarshipCategory?.name && (
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 self-start md:self-auto">
              {profile.scholarshipCategory.name === 'Sedefteki İnciler' ? (
                <img src="/sedefteki-inciler-logo.png" alt="Sedefteki İnciler" className="h-8 object-contain drop-shadow" />
              ) : profile.scholarshipCategory.name === 'İz Bırakanlar' ? (
                <img src="/izbirakanlar-logo.png" alt="İz Bırakanlar" className="h-8 object-contain drop-shadow" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary-500/30 flex items-center justify-center text-primary-300 font-bold text-sm">
                  ★
                </div>
              )}
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Burs Programı</div>
                <div className="text-sm font-bold text-white">{profile.scholarshipCategory.name}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Bento KPI Metric Cards (4 Grid) ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Burs Durumu */}
        <div className="card p-5 bg-white border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Burs Durumu</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{profile.scholarshipCategory?.name || 'Bursiyer'}</div>
            <div className="text-xs text-gray-500 mt-0.5">{profile.department || 'Lisans'}</div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Kayıt: <strong>{profile.studentStatus === 'ACTIVE' ? 'Aktif' : profile.studentStatus || 'Aktif'}</strong></span>
            <Link to="/student/profile" className="text-primary-600 font-semibold hover:underline">Profil &rarr;</Link>
          </div>
        </div>

        {/* Card 2: Bekleyen Evraklar */}
        <div className={`card p-5 border shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between ${
          activeDeadlines.length > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-gray-200/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bekleyen Evraklar</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              activeDeadlines.length > 0 ? 'bg-amber-500 text-white shadow-xs' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {activeDeadlines.length > 0 ? (
                <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {activeDeadlines.length > 0 ? (
                <span className="text-amber-700">{activeDeadlines.length} Belge Bekliyor</span>
              ) : (
                <span className="text-emerald-700 text-base">Tüm Belgeler Güncel</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {activeDeadlines.length > 0 
                ? `${activeDeadlines[0].label} için teslim bekleniyor`
                : 'Yüklenmesi gereken açık evrak yok'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between text-xs">
            <span className="text-gray-500">Belge Merkezi</span>
            <Link to="/student/documents" className="text-primary-600 font-bold hover:underline">
              {activeDeadlines.length > 0 ? 'Hemen Yükle ➔' : 'Görüntüle →'}
            </Link>
          </div>
        </div>

        {/* Card 3: Mentörünüz */}
        <div className="card p-5 bg-white border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mentörünüz</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div>
            {profile.mentor ? (
              <>
                <div className="text-base font-bold text-gray-900 truncate">
                  {profile.mentor.firstName} {profile.mentor.lastName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {profile.mentor.title || 'Mentör'} {profile.mentor.company ? `@ ${profile.mentor.company}` : ''}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-gray-700">Atama Bekleniyor</div>
                <div className="text-xs text-gray-400 mt-0.5">Mentörünüz yakında atanacak</div>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Mentörlük Programı</span>
            <Link to="/student/mentor" className="text-primary-600 font-semibold hover:underline">Detaylar &rarr;</Link>
          </div>
        </div>

        {/* Card 4: Gönüllülük Formu */}
        <div className="card p-5 bg-white border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gönüllülük Formu</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
          </div>
          <div>
            <div className="text-base font-bold text-gray-900">
              {hasVolunteerFormSubmitted ? 'Form Gönderildi' : 'Form Bekleniyor'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {hasVolunteerFormSubmitted ? `${myVolunteerForms.length} başvuru kayıtlı` : 'Bu dönem için formu doldurun'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Sosyal Sorumluluk</span>
            <Link to="/student/volunteer-form" className="text-primary-600 font-semibold hover:underline">
              {hasVolunteerFormSubmitted ? 'Görüntüle →' : 'Doldur ➔'}
            </Link>
          </div>
        </div>
      </div>

      {/* ── 3. Events & Training Banner (If available) ────────────────── */}
      {eventsToday.length > 0 && currentEvent && (
        <div className="card overflow-hidden border border-rose-200 bg-gradient-to-r from-rose-50/70 via-white to-white shadow-sm p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 font-semibold text-[11px] rounded-md">Bugünün Etkinliği</span>
                  <span className="text-xs text-gray-500 font-medium">
                    {format(new Date(currentEvent.date), 'HH:mm', { locale: tr })}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{currentEvent.title}</h3>
              </div>
            </div>

            {eventsToday.length > 1 && (
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => setSlideIndex(prev => (prev === 0 ? eventsToday.length - 1 : prev - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center justify-center"
                >
                  &larr;
                </button>
                <button
                  onClick={() => setSlideIndex(prev => (prev === eventsToday.length - 1 ? 0 : prev + 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center justify-center"
                >
                  &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. Main 2-Column Content Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left (2/3 width): Latest Announcements Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              Son Duyurular
            </h2>
            <Link to="/student/announcements" className="text-xs font-semibold text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1">
              Tümünü Gör ({announcements.length}) &rarr;
            </Link>
          </div>

          {announcements.length === 0 ? (
            <div className="card p-8 text-center bg-white border border-gray-200">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800">Henüz yayınlanmış duyuru yok</h3>
              <p className="text-xs text-gray-400 mt-0.5">Yeni duyurular paylaşıldığında burada listelenecektir.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => setSelectedAnn(ann)}
                  className="card p-5 bg-white border border-gray-200 hover:border-primary-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-primary-600 transition-colors line-clamp-1">
                      {ann.title}
                    </h3>
                    <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                      {format(new Date(ann.createdAt), 'dd MMMM yyyy', { locale: tr })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="mt-2 text-[11px] font-semibold text-primary-600 opacity-80 group-hover:opacity-100 flex items-center gap-1">
                    Devamını Oku &rarr;
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (1/3 width): Process Calendar & Deadlines */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Teslim Takvimi
            </h2>
            <Link to="/student/documents" className="text-xs font-semibold text-gray-500 hover:text-gray-900">
              Belgelerim &rarr;
            </Link>
          </div>

          <div className="card p-5 bg-white border border-gray-200 shadow-2xs space-y-4">
            {activeDeadlines.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="text-xs font-bold text-gray-800">Harika! Bekleyen evrak yok</div>
                <p className="text-[11px] text-gray-400 mt-0.5">Tüm dönemlik ve zorunlu evraklarınız teslim edilmiştir.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDeadlines.map((period) => {
                  const type = docTypes.find(t => t.code === period.type)?.name || period.type;
                  const daysLeft = period.endDate ? differenceInDays(new Date(period.endDate), new Date()) : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 5;

                  return (
                    <div key={period.id} className="p-3 rounded-xl border border-gray-150 bg-gray-50/50 hover:bg-white transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-xs text-gray-900 truncate">{period.label}</span>
                        {daysLeft !== null ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isUrgent ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' : 'bg-amber-100 text-amber-800'
                          }`}>
                            Son {daysLeft} Gün
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Devam Ediyor</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 font-medium truncate">{type}</div>
                      <div className="mt-2 pt-2 border-t border-gray-150 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                          {period.endDate ? format(new Date(period.endDate), 'dd MMM yyyy', { locale: tr }) : 'Tarih belirtilmedi'}
                        </span>
                        <Link to="/student/documents" className="text-xs font-bold text-primary-600 hover:underline">
                          Yükle ➔
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Hızlı İşlemler</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/student/profile')}
                  className="btn-secondary btn-sm text-xs justify-center"
                >
                  Profilimi Düzenle
                </button>
                <button
                  onClick={() => navigate('/student/volunteer-form')}
                  className="btn-secondary btn-sm text-xs justify-center"
                >
                  Gönüllülük Formu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Announcement Detail Modal ─────────────────────────────── */}
      {selectedAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="card max-w-lg w-full bg-white shadow-2xl overflow-hidden animate-scale-in">
            <div className="card-header bg-gray-50/80 px-6 py-4 border-b border-gray-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-600" />
                <span className="text-xs font-semibold text-gray-500">
                  {format(new Date(selectedAnn.createdAt), 'dd MMMM yyyy', { locale: tr })}
                </span>
              </div>
              <button
                onClick={() => setSelectedAnn(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                &times;
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              <h3 className="text-lg font-bold text-gray-900 leading-snug">{selectedAnn.title}</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedAnn.content}
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-150 flex justify-end">
              <button
                onClick={() => setSelectedAnn(null)}
                className="btn-secondary btn-sm text-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
