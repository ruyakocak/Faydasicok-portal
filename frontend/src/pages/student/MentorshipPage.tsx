import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { studentApi, mentorshipApi } from '../../api';

export default function MentorshipPage() {
  const { user } = useAuth();
  const profileId = user?.profileId;

  const [mentor, setMentor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMentor() {
      try {
        if (profileId) {
          const profile = await studentApi.getProfile(profileId);
          if (profile?.mentor) {
            setMentor(profile.mentor);
            setLoading(false);
            return;
          }
        }
        const res = await mentorshipApi.getProfile();
        setMentor(res?.mentor || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadMentor();
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="spinner border-gray-300 border-t-primary-500 w-9 h-9" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      
      {/* ── 1. Clean Header ──────────────────────────────────── */}
      <section className="relative pt-10 pb-8 border-b border-gray-200/60 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs font-semibold text-primary-700">
            Kariyer Gelişimi
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Mentörlük Programı
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Kariyer yolculuğunuzda size rehberlik edecek mentörünüzün bilgileri ve iletişim kanalları.
          </p>
        </div>
      </section>

      {!mentor ? (
        <section className="p-12 text-center rounded-3xl bg-white border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-4 text-gray-400">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Mentör Atama Süreciniz Devam Ediyor</h3>
          <p className="text-gray-500 max-w-lg mt-2 font-medium">
            Vakfımız tarafından kariyer hedefleriniz ve ilgi alanlarınız doğrultusunda mentör eşleştirmeniz tamamlandığında mentörünüzün tüm bilgileri burada yer alacaktır.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl bg-white border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-8 md:p-10 bg-gradient-to-br from-primary-900 to-primary-800 text-white flex flex-col sm:flex-row items-center sm:items-start gap-8">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white/10 p-1 border border-white/20 shadow-xl flex-shrink-0">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-black/50 flex items-center justify-center text-3xl font-semibold text-white uppercase">
                {mentor.photoPath ? (
                  <img src={`/${mentor.photoPath}`} alt={`${mentor.firstName} ${mentor.lastName}`} className="w-full h-full object-cover" />
                ) : (
                  <span>{mentor.firstName?.[0]}{mentor.lastName?.[0]}</span>
                )}
              </div>
            </div>

            <div className="text-center sm:text-left flex-1 mt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/20 mb-3">
                Atanan Mentörünüz
              </div>
              <h2 className="text-3xl font-semibold text-white tracking-tight">{mentor.firstName} {mentor.lastName}</h2>
              <p className="text-primary-100 font-medium mt-1 text-lg">
                {mentor.title || 'Mentör'} {mentor.company ? `@ ${mentor.company}` : ''}
              </p>

              {mentor.expertise && (
                <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
                  {mentor.expertise.split(',').map((exp: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-white/10 rounded-xl text-sm font-medium text-white/90 border border-white/10">
                      {exp.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 tracking-tight mb-4">İletişim Bilgileri</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mentor.email || mentor.user?.email ? (
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-4 hover:border-gray-200 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-white text-gray-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">E-posta</div>
                      <a href={`mailto:${mentor.email || mentor.user?.email}`} className="text-sm font-semibold text-gray-900 hover:text-primary-600 truncate block">
                        {mentor.email || mentor.user?.email}
                      </a>
                    </div>
                  </div>
                ) : null}

                {mentor.phone && (
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-4 hover:border-gray-200 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-white text-gray-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.4 19.79 19.79 0 0 1 1.61 4.74 2 2 0 0 1 3.6 2.54h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/></svg>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Telefon</div>
                      <a href={`tel:${mentor.phone}`} className="text-sm font-semibold text-gray-900 hover:text-primary-600">
                        {mentor.phone}
                      </a>
                    </div>
                  </div>
                )}

                {mentor.linkedin && (
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-4 hover:border-gray-200 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-white text-sky-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">LinkedIn</div>
                      <a href={mentor.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-sky-600 hover:underline truncate block">
                        Profili Görüntüle &rarr;
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Guidance Box */}
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-700 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white text-gray-500 border border-gray-200 flex items-center justify-center flex-shrink-0 text-lg">💡</div>
              <div className="leading-relaxed font-medium pt-0.5">
                <strong className="text-gray-900 block mb-1">Mentörlük Görüşmeleri İpucu</strong>
                Mentörünüzle ilk temasınızı e-posta veya telefon yoluyla kurabilir, aylık periyotlarda kariyer hedeflerinizi, staj ve sektör deneyimlerinizi paylaşacağınız çevrim içi ya da yüz yüze buluşmalar planlayabilirsiniz.
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
