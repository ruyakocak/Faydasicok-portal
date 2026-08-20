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
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* ── Top Header & Hero Card ────────────────────────────────────── */}
      <div className="card overflow-hidden bg-white shadow-2xs border border-gray-200">
        <div className="p-6 sm:p-7 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with hover upload overlay */}
          <div className="flex-shrink-0">
            <div className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gray-100 border-2 border-primary-200/80 shadow-xs cursor-pointer">
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
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.user?.tcKimlikNo || profile.id}`}
                  alt="Avatar"
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                />
              )}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none p-2 text-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[11px] font-medium text-white leading-tight">Fotoğraf Değiştir</span>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {profile.firstName} {profile.lastName}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
                  {[profile.department, profile.universityName].filter(Boolean).join(' — ')}
                </p>
              </div>

              {hasPending && (
                <span className="badge-pending self-center sm:self-start">
                  {profile.approvableChanges!.length} onay bekleyen değişiklik
                </span>
              )}
            </div>

            {/* Program Badge */}
            {profile.scholarshipCategory?.name && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200/80 mb-3">
                {profile.scholarshipCategory.name === 'Sedefteki İnciler' ? (
                  <img src="/sedefteki-inciler-logo.png" alt="Sedefteki İnciler" className="h-5 object-contain" />
                ) : profile.scholarshipCategory.name === 'İz Bırakanlar' ? (
                  <img src="/izbirakanlar-logo.png" alt="İz Bırakanlar" className="h-5 object-contain" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-primary-600" />
                )}
                <span className="text-xs font-bold text-gray-700">{profile.scholarshipCategory.name} Burs Programı</span>
              </div>
            )}

            {/* Contact Quick Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1.5 gap-x-4 text-xs text-gray-600 pt-2 border-t border-gray-100">
              {profile.phone && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 truncate">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.4 19.79 19.79 0 0 1 1.61 4.74 2 2 0 0 1 3.6 2.54h3a2 2 0 0 1 1.72 2.03z"/></svg>
                  <span>{profile.phone}</span>
                </div>
              )}
              {(profile.email || profile.user?.email) && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 truncate">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span className="truncate">{profile.email || profile.user?.email}</span>
                </div>
              )}
              {profile.user?.tcKimlikNo && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 truncate">
                  <span className="font-semibold text-gray-400">T.C.:</span>
                  <span>{profile.user.tcKimlikNo}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
