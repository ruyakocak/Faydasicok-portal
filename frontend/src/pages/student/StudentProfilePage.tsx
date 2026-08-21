import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../api';
import type { StudentProfile } from '../../types';
import { PersonalTab, EducationTab, FamilyTab } from '../../components/ProfileTabs';
import toast from 'react-hot-toast';

const TABS = ['Kişisel Bilgiler', 'Eğitim Bilgileri', 'Aile Bilgileri'];

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  const profileId = user?.profileId;

  async function loadProfile() {
    if (!profileId) return;
    try {
      const p = await studentApi.getProfile(profileId);
      setProfile(p);
    } catch (err: any) {
      toast.error('Profil bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profileId) return;

    const loadingToast = toast.loading('Fotoğraf yükleniyor...');
    try {
      await studentApi.uploadPhoto(profileId, file);
      toast.success('Profil fotoğrafınız başarıyla güncellendi.', { id: loadingToast });
      await loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Fotoğraf yüklenirken hata oluştu.', { id: loadingToast });
    }
  }

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
        Profil yüklenemedi.
      </div>
    );
  }

  const hasPending = (profile.approvableChanges?.length ?? 0) > 0;

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      
      {/* ── 1. Clean Header ──────────────────────────────────── */}
      <section className="relative pt-10 pb-8 border-b border-gray-200/60 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs font-semibold text-primary-700">
            Kişisel Verileriniz
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Profil Bilgilerim
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Kişisel, eğitim ve aile bilgilerinizi buradan görüntüleyebilir ve güncelleyebilirsiniz.
          </p>
        </div>
      </section>

      {/* ── Hero Card ────────────────────────────────────── */}
      <section className="rounded-3xl bg-white border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8 bg-gradient-to-br from-gray-50 to-white">
          {/* Avatar with hover upload overlay */}
          <div className="flex-shrink-0 relative">
            <div className="group w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden bg-white border-2 border-white shadow-xl cursor-pointer relative z-10">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                title="Profil Fotoğrafını Değiştirmek İçin Tıklayın"
                onChange={handlePhotoUpload}
              />
              {profile.photoPath ? (
                <img
                  src={`/${profile.photoPath}`}
                  alt="Profil"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.user?.tcKimlikNo || profile.id}`}
                  alt="Avatar"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none p-4 text-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold text-white tracking-wide uppercase">Değiştir</span>
              </div>
            </div>
            {hasPending && (
              <div className="absolute -bottom-3 -right-3 z-20 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-700 font-bold text-xs rounded-full shadow-sm">
                {profile.approvableChanges!.length} Onay
              </div>
            )}
          </div>

          {/* User Info Overview */}
          <div className="text-center md:text-left flex-1 mt-2">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight leading-tight">
              {profile.firstName} {profile.lastName}
            </h2>
            <div className="mt-2 text-gray-500 font-medium text-lg">
              {profile.user?.tcKimlikNo}
            </div>

            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
              <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-primary-50 text-primary-700 border border-primary-100/60">
                {profile.scholarshipCategory?.name || 'Bursiyer'}
              </span>
              <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${
                profile.studentStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}>
                {profile.studentStatus === 'ACTIVE' ? 'Aktif Öğrenci' : profile.studentStatus}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs Content (Full Width) ─────────────────────────────────── */}
      <div className="card overflow-hidden bg-white shadow-2xs border border-gray-200">
        <div className="tabs border-b border-gray-200 px-2 bg-gray-50/50">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`tab text-sm py-3.5 px-5 font-semibold transition-all ${
                activeTab === i
                  ? 'tab-active border-b-2 border-primary-600 text-primary-600 bg-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="card-body p-6 sm:p-8">
          {activeTab === 0 && (
            <PersonalTab
              profile={profile}
              onSave={async (data) => {
                await studentApi.updatePersonal(profile.id, data);
                await loadProfile();
              }}
              readOnly={false}
            />
          )}

          {activeTab === 1 && (
            <EducationTab
              profile={profile}
              onSave={async (data) => {
                await studentApi.updateEducation(profile.id, data);
                await loadProfile();
              }}
              readOnly={false}
            />
          )}

          {activeTab === 2 && (
            <FamilyTab
              profile={profile}
              onSave={async (data) => {
                await studentApi.updateFamily(profile.id, data);
                await loadProfile();
              }}
              readOnly={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
