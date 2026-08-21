import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentApi, documentApi, eventApi, announcementApi, volunteerApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod, Event, Announcement } from '../../types';
import { format, isToday, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function StudentDashboardPage() {
  const { user } = useAuth();
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Yükleniyor...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-12 bg-white rounded-3xl border border-gray-200/60 shadow-sm max-w-md">
          <p className="text-gray-500 font-medium">Profil bilgisi yüklenemedi. Lütfen sayfayı yenileyiniz.</p>
        </div>
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profileId) return;

    const loadingToast = toast.loading('Fotoğraf yükleniyor...');
    try {
      await studentApi.uploadPhoto(profileId, file);
      toast.success('Profil fotoğrafınız başarıyla güncellendi.', { id: loadingToast });
      const updatedProfile = await studentApi.getProfile(profileId);
      setProfile(updatedProfile);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Fotoğraf yüklenirken hata oluştu.', { id: loadingToast });
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      
      {/* ── 1. Clean Hero Section ──────────────────────────────────── */}
      <section className="relative pt-10 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200/60">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-xs font-semibold text-gray-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Aktif Bursiyer
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Hoş geldin,<br className="hidden md:block" /> {profile.firstName}
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            {profile.universityName || 'Üniversite belirtilmemiş'} 
            {profile.faculty && `, ${profile.faculty}`} 
            {profile.grade && ` · ${profile.grade}. Sınıf`}
          </p>
        </div>
        
        {/* Profile / Program Chip */}
        <div className="flex flex-row md:flex-col items-center md:items-end gap-4 shrink-0">
          <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-white border-2 border-white shadow-xl cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              title="Profil Fotoğrafını Değiştirmek İçin Tıklayın"
              onChange={handlePhotoUpload}
            />
            {profile.photoPath ? (
              <img src={`/${profile.photoPath}`} alt={profile.firstName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <img 
                src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.user?.tcKimlikNo || profile.id}`} 
                alt="Avatar" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
            )}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none text-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          {profile.scholarshipCategory?.name && (
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">{profile.scholarshipCategory.name}</div>
              <div className="text-xs text-gray-500">Burs Programı</div>
            </div>
          )}
        </div>
      </section>

      {/* ── 2. Bento Metrics Grid ───────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Burs Durumu */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between aspect-square group">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
            </div>
            <Link to="/student/profile" className="text-gray-400 hover:text-black transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Burs Durumu</div>
            <div className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight">{profile.scholarshipCategory?.name || 'Bursiyer'}</div>
            <div className="text-sm text-gray-500 mt-1">{profile.department || 'Lisans'}</div>
          </div>
        </div>

        {/* Card 2: Bekleyen Evraklar */}
        <div className={`rounded-3xl p-6 border shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between aspect-square group ${
          activeDeadlines.length > 0 ? 'bg-primary-500 text-white border-primary-600' : 'bg-white border-gray-200/60'
        }`}>
          <div className="flex justify-between items-start">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border group-hover:scale-105 transition-transform ${activeDeadlines.length > 0 ? 'bg-white/15 border-white/20' : 'bg-gray-50 border-gray-100'}`}>
              <svg className={`w-5 h-5 ${activeDeadlines.length > 0 ? 'text-white' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <Link to="/student/documents" className={`${activeDeadlines.length > 0 ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-black'} transition-colors`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>
          <div>
            <div className={`text-xs font-semibold tracking-wider uppercase mb-2 ${activeDeadlines.length > 0 ? 'text-white/80' : 'text-gray-500'}`}>Belgelerim</div>
            <div className={`text-2xl font-semibold tracking-tight leading-tight ${activeDeadlines.length > 0 ? 'text-white' : 'text-gray-900'}`}>
              {activeDeadlines.length > 0 ? `${activeDeadlines.length} Belge Bekliyor` : 'Eksik Belge Yok'}
            </div>
            <div className={`text-sm mt-1 ${activeDeadlines.length > 0 ? 'text-white/90' : 'text-gray-500'}`}>
              {activeDeadlines.length > 0 ? 'Yükleme yapmanız gerekiyor' : 'Tüm evraklarınız tamam'}
            </div>
          </div>
        </div>

        {/* Card 3: Mentörünüz */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between aspect-square group">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <Link to="/student/mentor" className="text-gray-400 hover:text-black transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Mentörünüz</div>
            <div className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight">
              {profile.mentor ? `${profile.mentor.firstName} ${profile.mentor.lastName}` : 'Atama Bekleniyor'}
            </div>
            <div className="text-sm text-gray-500 mt-1 truncate">
              {profile.mentor ? `${profile.mentor.title || 'Mentör'}` : 'Süreç devam ediyor'}
            </div>
          </div>
        </div>

        {/* Card 4: Gönüllülük */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between aspect-square group">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </div>
            <Link to="/student/volunteer-form" className="text-gray-400 hover:text-black transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2">Sosyal Sorumluluk</div>
            <div className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight">
              {hasVolunteerFormSubmitted ? 'Gönderildi' : 'Bekleniyor'}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {hasVolunteerFormSubmitted ? `${myVolunteerForms.length} kayıtlı form` : 'Formunuzu doldurun'}
            </div>
          </div>
        </div>

      </section>

      {/* ── 3. Events Banner ────────────────── */}
      {eventsToday.length > 0 && currentEvent && (
        <section className="bg-gradient-to-br from-primary-900 to-primary-800 rounded-3xl p-8 md:p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90">
              Bugünün Etkinliği
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">{currentEvent.title}</h2>
            <p className="text-primary-100 font-medium">Saat {format(new Date(currentEvent.date), 'HH:mm', { locale: tr })}'de başlıyor.</p>
          </div>
          {eventsToday.length > 1 && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setSlideIndex(prev => (prev === 0 ? eventsToday.length - 1 : prev - 1))} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button onClick={() => setSlideIndex(prev => (prev === eventsToday.length - 1 ? 0 : prev + 1))} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── 4. Grid Content (Announcements & Deadlines) ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left (2/3 width): Announcements */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200/60 pb-4">
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Duyurular</h2>
            <Link to="/student/announcements" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">Tümünü gör →</Link>
          </div>

          {announcements.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-gray-50/50 border border-gray-100">
              <p className="text-gray-500 font-medium">Yeni duyuru bulunmuyor.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {announcements.slice(0, 4).map((ann) => (
                <div key={ann.id} onClick={() => setSelectedAnn(ann)} className="group cursor-pointer p-6 rounded-3xl bg-white border border-gray-200/60 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 tracking-tight group-hover:text-black transition-colors line-clamp-1">{ann.title}</h3>
                    <span className="text-xs font-medium text-gray-400 shrink-0 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                      {format(new Date(ann.createdAt), 'dd MMM yyyy', { locale: tr })}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (1/3 width): Deadlines */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200/60 pb-4">
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Yaklaşan Tarihler</h2>
            <Link to="/student/documents" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">Belgelerim →</Link>
          </div>

          {activeDeadlines.length === 0 ? (
            <div className="p-8 rounded-3xl bg-gray-50/50 border border-gray-100 flex flex-col items-center justify-center text-center h-48">
              <svg className="w-8 h-8 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7"/></svg>
              <p className="text-gray-500 font-medium text-sm">Bekleyen evrak yok.<br/>Her şey yolunda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeDeadlines.map((period) => {
                const daysLeft = period.endDate ? differenceInDays(new Date(period.endDate), new Date()) : null;
                const isUrgent = daysLeft !== null && daysLeft <= 5;
                
                return (
                  <div key={period.id} className="p-5 rounded-3xl bg-white border border-gray-200/60 shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-gray-900 text-sm tracking-tight truncate">{period.label}</span>
                      {daysLeft !== null && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${isUrgent ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
                          Son {daysLeft} gün
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-4">{period.endDate ? format(new Date(period.endDate), 'dd MMM yyyy', { locale: tr }) : 'Tarih belirtilmedi'}</div>
                    <Link to="/student/documents" className="mt-auto w-full text-center py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-900 text-sm font-medium transition-colors border border-gray-200/60">
                      Yükle
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Modal ─────────────────────────────── */}
      {selectedAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-200/60 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-10 border-b border-gray-100 flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2 block">
                  {format(new Date(selectedAnn.createdAt), 'dd MMMM yyyy', { locale: tr })}
                </span>
                <h3 className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight">{selectedAnn.title}</h3>
              </div>
              <button onClick={() => setSelectedAnn(null)} className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-8 md:p-10 max-h-[60vh] overflow-y-auto">
              <div className="text-gray-600 leading-relaxed whitespace-pre-wrap font-medium">
                {selectedAnn.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
