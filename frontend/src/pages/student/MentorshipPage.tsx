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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Mentörlük Programı
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Kariyer yolculuğunuzda size rehberlik edecek mentörünüzün bilgileri ve iletişim kanalları.
        </p>
      </div>

      {!mentor ? (
        <div className="card p-12 bg-white border border-gray-200 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Mentör Atama Süreciniz Devam Ediyor</h3>
          <p className="text-sm text-gray-500 max-w-md mt-1 leading-relaxed">
            Vakfımız tarafından kariyer hedefleriniz ve ilgi alanlarınız doğrultusunda mentör eşleştirmeniz tamamlandığında mentörünüzün tüm bilgileri burada yer alacaktır.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden bg-white shadow-xs border border-gray-200">
          <div className="p-6 sm:p-8 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/10 p-1 border border-white/20 shadow-lg flex-shrink-0">
              <div className="w-full h-full rounded-[12px] overflow-hidden bg-gray-800 flex items-center justify-center text-2xl font-bold text-white uppercase">
                {mentor.photoPath ? (
                  <img src={`/${mentor.photoPath}`} alt={`${mentor.firstName} ${mentor.lastName}`} className="w-full h-full object-cover" />
                ) : (
                  <span>{mentor.firstName?.[0]}{mentor.lastName?.[0]}</span>
                )}
              </div>
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30 mb-2">
                Atanan Mentörünüz
              </div>
              <h2 className="text-2xl font-bold text-white">{mentor.firstName} {mentor.lastName}</h2>
              <p className="text-sm text-gray-300 font-medium mt-0.5">
                {mentor.title || 'Mentör'} {mentor.company ? `@ ${mentor.company}` : ''}
              </p>

              {mentor.expertise && (
                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-1.5">
                  {mentor.expertise.split(',').map((exp: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-0.5 bg-white/10 rounded-md text-xs text-gray-200 border border-white/10">
                      {exp.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">İletişim Bilgileri</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mentor.email || mentor.user?.email ? (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-150 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs text-gray-400 font-semibold">E-posta</div>
                      <a href={`mailto:${mentor.email || mentor.user?.email}`} className="text-sm font-bold text-gray-900 hover:text-primary-600 truncate block">
                        {mentor.email || mentor.user?.email}
                      </a>
                    </div>
                  </div>
                ) : null}

                {mentor.phone && (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-150 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.4 19.79 19.79 0 0 1 1.61 4.74 2 2 0 0 1 3.6 2.54h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/></svg>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-semibold">Telefon</div>
                      <a href={`tel:${mentor.phone}`} className="text-sm font-bold text-gray-900 hover:text-primary-600">
                        {mentor.phone}
                      </a>
                    </div>
                  </div>
                )}

                {mentor.linkedin && (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-150 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs text-gray-400 font-semibold">LinkedIn</div>
                      <a href={mentor.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-sky-600 hover:underline truncate block">
                        Profili Görüntüle &rarr;
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Guidance Box */}
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
              <span className="text-base leading-none">💡</span>
              <div className="leading-relaxed">
                <strong>Mentörlük Görüşmeleri İpucu:</strong> Mentörünüzle ilk temasınızı e-posta veya telefon yoluyla kurabilir, aylık periyotlarda kariyer hedeflerinizi, staj ve sektör deneyimlerinizi paylaşacağınız çevrim içi ya da yüz yüze buluşmalar planlayabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
