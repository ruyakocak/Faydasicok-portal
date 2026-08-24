import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { studentApi, documentApi, approvalApi, adminApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod, ApprovableChange } from '../../types';
import { PersonalTab, EducationTab, DocumentsTab, ActivityTab } from '../../components/ProfileTabs';
import toast from 'react-hot-toast';

const TABS = ['Kişisel Bilgiler', 'Eğitim Bilgileri', 'Dokümanlar', 'Aktivite Geçmişi', 'Mentör'];

export default function StudentDetailPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<ApprovableChange[]>([]);
  const [resetting, setResetting] = useState(false);
  const [newPass, setNewPass] = useState('');
  
  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [mentorsList, setMentorsList] = useState<any[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [assigningMentor, setAssigningMentor] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteStudent() {
    if (!profile) return;
    setDeleting(true);
    try {
      await adminApi.deleteStudent(profile.id);
      toast.success('Bursiyer ve tüm verileri başarıyla silindi.');
      navigate('/admin/students');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bursiyer silinirken hata oluştu.');
      setDeleting(false);
    }
  }

  async function handleResetPasswordClick() {
    setShowResetModal(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Yükleme sırasında basit bir toast ile bildir
    const loadingToast = toast.loading('Fotoğraf yükleniyor...');
    try {
      await adminApi.uploadStudentPhoto(profileId!, file);
      toast.success('Fotoğraf başarıyla yüklendi.', { id: loadingToast });
      loadAll();
    } catch (err) {
      toast.error('Fotoğraf yüklenirken hata oluştu.', { id: loadingToast });
    }
  }

  async function confirmResetPassword() {
    setResetting(true);
    try {
      const res = await adminApi.resetPassword(profileId!);
      setNewPass(res.password);
      toast.success('Şifre sıfırlandı!');
      setShowResetModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Şifre sıfırlanırken bir hata oluştu.');
    } finally {
      setResetting(false);
    }
  }

  async function loadAll() {
    if (!profileId) return;
    try {
      const [p, d, per, changes, mList] = await Promise.all([
        studentApi.getProfile(profileId),
        studentApi.getDocuments(profileId),
        documentApi.getPeriods(),
        approvalApi.getQueue({ studentId: profileId, status: 'PENDING', limit: '50' }),
        adminApi.listMentors(),
      ]);
      setProfile(p);
      setDocuments(d);
      setPeriods(per);
      setPendingChanges(changes.data);
      setMentorsList(mList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [profileId]);

  async function handleApprove(id: string) {
    await approvalApi.approve(id);
    toast.success('Onaylandı.');
    loadAll();
  }

  async function handleReject(id: string, note: string) {
    await approvalApi.reject(id, note);
    toast.success('Reddedildi.');
    loadAll();
  }

  function openMentorModal() {
    setSelectedMentorId((profile as any).mentor?.id || '');
    setMentorModalOpen(true);
  }

  async function handleAssignMentor(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setAssigningMentor(true);
    try {
      await adminApi.assignMentor(profile.id, selectedMentorId || null);
      toast.success('Mentör ataması güncellendi.');
      setMentorModalOpen(false);
      loadAll();
    } catch (err) {
      // handled by interceptor
    } finally {
      setAssigningMentor(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" /></div>;
  }
  if (!profile) {
    return <div className="text-center py-16 text-gray-500">Profil bulunamadı.</div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <Link to="/admin/students" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Bursiyer Listesi
      </Link>

      {/* Profile header */}
      <div className="card mb-6">
        <div className="card-body flex items-start gap-5">
          <div className="relative group w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-primary-50 border-2 border-gray-100 shadow-sm flex items-center justify-center text-primary-600 text-3xl font-bold overflow-hidden flex-shrink-0 cursor-pointer transition-all hover:shadow-md">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              title="Fotoğrafı Değiştirmek İçin Tıklayın"
              onChange={handlePhotoUpload}
            />
            {profile.photoPath ? (
              <img src={`/${profile.photoPath}`} alt="Profil" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
            ) : (
              <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.user?.tcKimlikNo || profile.id}`} alt="Avatar" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
            )}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none p-2 text-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[11px] font-medium text-white leading-tight">Fotoğraf Değiştir</span>
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{profile.firstName} {profile.lastName}</h1>
            <div className="text-sm text-gray-500">{profile.department} — {profile.universityName}</div>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600 flex-wrap">
              <span>TC: <span className="font-mono">{profile.user?.tcKimlikNo || '—'}</span></span>
              {profile.grade && <span>{profile.grade}. Sınıf</span>}
              <span className={`badge ${
                profile.studentStatus === 'ACTIVE' ? 'badge-approved' : 
                profile.studentStatus === 'GRADUATED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold' : 
                'badge-pending'
              }`}>
                {profile.studentStatus === 'ACTIVE' ? 'Aktif' : 
                 profile.studentStatus === 'GRADUATED' ? (profile.graduationYear ? `🎓 ${profile.graduationYear} Mezunu` : '🎓 Mezun') : 
                 profile.studentStatus === 'INCOMPLETE' ? 'Tamamlanmadı' : 
                 profile.studentStatus}
              </span>
              {profile.studentStatus !== 'GRADUATED' && (
                profile.isInitialDocsExempt ? (
                  <span className="badge bg-purple-50 text-purple-700 border border-purple-200">
                    🛡️ İlk Kayıt Belgelerinden Muaf
                  </span>
                ) : (
                  <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                    📋 İlk Kayıt Belgeleri Zorunlu
                  </span>
                )
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 w-full max-w-[200px]">
            {pendingChanges.length > 0 && (
              <div className="text-center bg-amber-50 border border-amber-200 rounded px-3 py-1 w-full">
                <span className="badge-pending text-base font-bold block">{pendingChanges.length}</span>
                <span className="text-[10px] text-gray-500 font-medium">Onay Bekliyor</span>
              </div>
            )}
            <button
              onClick={handleResetPasswordClick}
              disabled={resetting}
              className="btn-secondary btn-sm text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200 py-1 px-2.5 text-xs w-full justify-center"
            >
              {resetting ? <span className="spinner border-amber-600/30 border-t-amber-600 w-4 h-4" /> : 'Şifreyi Sıfırla'}
            </button>
            {profile.studentStatus !== 'GRADUATED' && (
              <button
                onClick={async () => {
                  try {
                    const newVal = !profile.isInitialDocsExempt;
                    await adminApi.updateStudentProfile(profile.id, { isInitialDocsExempt: newVal });
                    toast.success(`İlk kayıt muafiyeti ${newVal ? 'aktif edildi' : 'kaldırıldı'}.`);
                    loadAll();
                  } catch (e: any) {
                    toast.error(e?.response?.data?.error || 'Güncellenemedi');
                  }
                }}
                className="btn-secondary btn-sm text-purple-700 hover:text-purple-800 hover:bg-purple-50 border-purple-200 py-1 px-2.5 text-xs w-full justify-center"
              >
                {profile.isInitialDocsExempt ? 'Muafiyeti Kaldır' : 'Muaf Olarak İşaretle'}
              </button>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn-secondary btn-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 py-1 px-2.5 text-xs w-full justify-center"
            >
              Bursiyeri Sil
            </button>
            {newPass && (
              <div className="bg-green-50 text-green-800 border border-green-200 rounded p-2 text-xs font-mono mt-1 text-center w-full">
                Yeni: <span className="font-bold text-sm bg-white px-1.5 py-0.5 rounded border border-green-300 select-all">{newPass}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending changes panel */}
      {pendingChanges.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-base font-semibold text-status-pending">⏳ Onay Bekleyen Değişiklikler</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tür</th>
                  <th>Alan / Belge</th>
                  <th>Eski Değer</th>
                  <th>Yeni Değer / Dosya</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pendingChanges.map(change => (
                  <PendingChangeRow
                    key={change.id}
                    change={change}
                    onApprove={() => handleApprove(change.id)}
                    onReject={(note) => handleReject(change.id, note)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile tabs */}
      <div className="card overflow-hidden">
        <div className="tabs">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} className={`tab ${activeTab === i ? 'tab-active' : ''}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="card-body">
          {activeTab === 0 && <PersonalTab profile={profile} readOnly={false} onSave={async (data) => {
            await adminApi.updateStudentProfile(profile.id, data);
            loadAll();
          }} />}
          {activeTab === 1 && <EducationTab profile={profile} readOnly={false} onSave={async (data) => {
            await adminApi.updateStudentProfile(profile.id, data);
            loadAll();
          }} />}
          {activeTab === 2 && (
            <DocumentsTab profile={profile} documents={documents} periods={periods} onUpload={loadAll} readOnly />
          )}
          {activeTab === 3 && (
            <ActivityTab profileId={profile.id} />
          )}
          {activeTab === 4 && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Mentör Bilgileri</h3>
                <button onClick={openMentorModal} className="btn-primary btn-sm">
                  {(profile as any).mentor ? 'Mentörü Değiştir' : 'Mentör Ata'}
                </button>
              </div>

              {(profile as any).mentor ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm">
                  <div className="w-20 h-20 bg-primary-50 rounded-full overflow-hidden flex items-center justify-center text-primary-600 text-3xl font-bold flex-shrink-0">
                    {(profile as any).mentor.photoPath ? (
                      <img src={`/${(profile as any).mentor.photoPath}`} alt="Mentör" className="w-full h-full object-cover" />
                    ) : (
                      ((profile as any).mentor.firstName?.[0] || '') + ((profile as any).mentor.lastName?.[0] || '')
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900 mb-1">
                      {(profile as any).mentor.firstName} {(profile as any).mentor.lastName}
                    </h4>
                    <p className="text-primary-600 font-medium mb-3">
                      {(profile as any).mentor.title || 'Mentör'}
                      {(profile as any).mentor.company && ` @ ${(profile as any).mentor.company}`}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {(profile as any).mentor.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                          <a href={`mailto:${(profile as any).mentor.email}`} className="hover:text-primary-600 hover:underline">
                            {(profile as any).mentor.email}
                          </a>
                        </div>
                      )}
                      {(profile as any).mentor.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                          <a href={`tel:${(profile as any).mentor.phone}`} className="hover:text-primary-600 hover:underline">
                            {(profile as any).mentor.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center">
                  <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                  </div>
                  <h4 className="text-gray-900 font-medium mb-1">Henüz Mentör Atanmamış</h4>
                  <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">Bu öğrenciye henüz bir mentör ataması yapılmamış. Atama yapmak için aşağıdaki butonu kullanabilirsiniz.</p>
                  <button onClick={openMentorModal} className="btn-primary">
                    Mentör Ata
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Mentor Modal */}
      {mentorModalOpen && profile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Mentör Ata</h3>
              <button onClick={() => setMentorModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAssignMentor} className="p-5">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-4">
                  <span className="font-medium text-gray-900">{profile.firstName} {profile.lastName}</span> isimli öğrenci için mentör ataması yapıyorsunuz.
                </p>
                <label className="form-label mb-1">Mentör Seçin</label>
                <select
                  className="form-select w-full"
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                >
                  <option value="">-- Mentör Yok (Kaldır) --</option>
                  {mentorsList.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.firstName} {mentor.lastName} {mentor.title ? `(${mentor.title})` : ''} - {mentor._count?.students || 0} öğrenci atanmış
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setMentorModalOpen(false)} className="btn-secondary">İptal</button>
                <button type="submit" className="btn-primary" disabled={assigningMentor}>
                  {assigningMentor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-amber-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-amber-900">Şifreyi Sıfırla</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-amber-400 hover:text-amber-600 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                <strong>{profile.firstName} {profile.lastName}</strong> isimli öğrencinin sistem giriş şifresini sıfırlamak istediğinize emin misiniz?
              </p>
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="font-semibold text-amber-600 block mb-1">BİLGİLENDİRME:</span>
                Sıfırlama işlemi sonrasında sistem 6 haneli rastgele bir şifre üretecektir. Bu şifreyi öğrenciyle paylaşmanız gerekmektedir.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowResetModal(false)} className="btn-secondary px-5">
                İptal
              </button>
              <button onClick={confirmResetPassword} className="btn-primary bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 px-5" disabled={resetting}>
                {resetting ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Evet, Sıfırla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {showDeleteModal && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Bursiyeri Silmek İstiyor musunuz?</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                <span className="font-semibold text-gray-800">
                  {profile.firstName} {profile.lastName}
                </span>
                {profile.user?.tcKimlikNo ? ` (TC: ${profile.user.tcKimlikNo})` : ''} adlı bursiyer, giriş hesabı, belgeleri ve tüm profil verileriyle birlikte kalıcı olarak silinecektir. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteStudent}
                  disabled={deleting}
                  className="btn-danger flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 text-xs shadow-xs"
                >
                  {deleting ? <span className="spinner border-white/30 border-t-white w-4 h-4 mx-auto" /> : 'Evet, Kalıcı Olarak Sil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatIbanDisplay(iban?: string | null): string {
  if (!iban) return '—';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  const parts = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join(' ');
}

function renderBankInfo(val?: string | null) {
  if (!val) return <span className="text-gray-400">—</span>;
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object') {
      return (
        <div className="space-y-0.5 text-xs">
          <div>
            <span className="text-gray-500 font-medium">Banka:</span>{' '}
            <span className="font-semibold text-gray-900">{parsed.bankName || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">IBAN:</span>{' '}
            <span className="font-mono font-medium text-gray-900 tracking-wider">{formatIbanDisplay(parsed.iban)}</span>
          </div>
        </div>
      );
    }
  } catch {
    // Fallback for legacy strings
  }
  return <span className="text-gray-700 text-xs font-medium">{val}</span>;
}

function PendingChangeRow({ change, onApprove, onReject }: {
  change: ApprovableChange;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const isDoc = change.entityType === 'DOCUMENT';

  return (
    <tr>
      <td>
        <span className="badge-gray capitalize text-xs">
          {change.entityType === 'DOCUMENT' ? 'Belge' :
           change.entityType === 'BANK_INFO' ? 'Banka Bilgisi' :
           change.entityType === 'PERSONAL_INFO' ? 'Kişisel Bilgi' :
           change.entityType === 'FAMILY_INFO' ? 'Aile Bilgisi' :
           change.entityType === 'EDUCATION_INFO' ? 'Eğitim Bilgisi' :
           change.entityType}
        </span>
      </td>
      <td className="text-sm font-medium">
        {isDoc ? (
          <div className="flex flex-col">
            <span>{change.document?.type}</span>
            {change.document?.period?.label && (
              <span className="text-xs text-gray-500 font-normal mt-0.5">{change.document.period.label}</span>
            )}
          </div>
        ) : (
          change.fieldName === 'bankInfo' ? 'Banka & IBAN' : change.fieldName
        )}
      </td>
      <td className="text-sm">
        {change.entityType === 'BANK_INFO' ? (
          renderBankInfo(change.oldValue)
        ) : (
          <span className="text-gray-500 text-sm max-w-32 truncate">{change.oldValue || '—'}</span>
        )}
      </td>
      <td className="text-sm">
        {isDoc && change.document?.filePath ? (
          <a href={`/${change.document.filePath}`} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline text-xs">
            {change.document.originalFileName}
          </a>
        ) : change.entityType === 'BANK_INFO' ? (
          renderBankInfo(change.newValue)
        ) : (
          <span className="font-medium">{change.newValue || '—'}</span>
        )}
      </td>
      <td className="text-xs text-gray-500 whitespace-nowrap">
        {new Date(change.createdAt).toLocaleDateString('tr-TR')}
      </td>
      <td>
        {rejecting ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="form-input text-xs py-1 w-36"
              placeholder="Red sebebi..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <button
              onClick={() => { if (note.trim()) { onReject(note); setRejecting(false); } else toast.error('Red sebebi giriniz.'); }}
              className="btn-danger btn-sm"
            >
              Reddet
            </button>
            <button onClick={() => setRejecting(false)} className="btn-ghost btn-sm">İptal</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={onApprove} className="btn-sm bg-status-approved-bg text-status-approved-text hover:bg-green-100 rounded px-3 py-1 text-xs font-medium transition-colors">
              ✓ Onayla
            </button>
            <button onClick={() => setRejecting(true)} className="btn-sm bg-status-rejected-bg text-status-rejected-text hover:bg-red-100 rounded px-3 py-1 text-xs font-medium transition-colors">
              ✗ Reddet
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
