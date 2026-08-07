import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentApi, documentApi, approvalApi, adminApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod, ApprovableChange } from '../../types';
import { PersonalTab, FamilyTab, EducationTab, DocumentsTab, ActivityTab } from '../../components/ProfileTabs';
import toast from 'react-hot-toast';

const TABS = ['Kişisel Bilgiler', 'Eğitim Bilgileri', 'Dokümanlar', 'Aktivite Geçmişi', 'Mentör'];

export default function StudentDetailPage() {
  const { profileId } = useParams<{ profileId: string }>();
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

  async function handleResetPassword() {
    if (!window.confirm('Bu öğrencinin şifresini sıfırlamak istediğinizden emin misiniz?')) return;
    setResetting(true);
    try {
      const res = await adminApi.resetPassword(profileId!);
      setNewPass(res.password);
      toast.success('Şifre sıfırlandı!');
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
          <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold overflow-hidden flex-shrink-0">
            {profile.photoPath ? (
              <img src={`/${profile.photoPath}`} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.user?.tcKimlikNo || profile.id}`} alt="Avatar" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{profile.firstName} {profile.lastName}</h1>
            <div className="text-sm text-gray-500">{profile.department} — {profile.universityName}</div>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
              <span>TC: <span className="font-mono">{profile.user?.tcKimlikNo || '—'}</span></span>
              {profile.grade && <span>{profile.grade}. Sınıf</span>}
              <span className={`badge ${profile.studentStatus === 'ACTIVE' ? 'badge-approved' : 'badge-pending'}`}>
                {profile.studentStatus === 'ACTIVE' ? 'Aktif' : profile.studentStatus === 'INCOMPLETE' ? 'Tamamlanmadı' : profile.studentStatus}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            {pendingChanges.length > 0 && (
              <div className="text-center bg-amber-50 border border-amber-200 rounded px-3 py-1 w-full">
                <span className="badge-pending text-base font-bold block">{pendingChanges.length}</span>
                <span className="text-[10px] text-gray-500 font-medium">Onay Bekliyor</span>
              </div>
            )}

            <div className="flex flex-col items-end gap-1.5 w-full">
              <button
                onClick={handleResetPassword}
                disabled={resetting}
                className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 py-1 px-2.5 text-xs"
              >
                {resetting ? <span className="spinner border-red-600/30 border-t-red-600 w-4 h-4" /> : 'Şifreyi Sıfırla'}
              </button>
              {newPass && (
                <div className="bg-red-50 text-red-800 border border-red-200 rounded p-2 text-xs font-mono mt-1 text-right max-w-[200px]">
                  Yeni Şifre: <span className="font-bold text-sm bg-white px-1.5 py-0.5 rounded border border-red-300 select-all">{newPass}</span>
                </div>
              )}
            </div>
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
          {activeTab === 0 && <PersonalTab profile={profile} readOnly />}
          {activeTab === 1 && <EducationTab profile={profile} readOnly />}
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
                  <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 text-3xl font-bold flex-shrink-0">
                    {((profile as any).mentor.firstName?.[0] || '') + ((profile as any).mentor.lastName?.[0] || '')}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900 mb-1">
                      {(profile as any).mentor.firstName} {(profile as any).mentor.lastName}
                    </h4>
                    <p className="text-primary-600 font-medium mb-3">
                      {(profile as any).mentor.title || 'Mentör'}
                      {(profile as any).mentor.expertise && ` • ${(profile as any).mentor.expertise}`}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {/* E-posta is fetched via User relation */}
                      {(profile as any).mentor.user?.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                          <a href={`mailto:${(profile as any).mentor.user.email}`} className="hover:text-primary-600 hover:underline">
                            {(profile as any).mentor.user.email}
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
                      {(profile as any).mentor.linkedin && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"></path><circle cx="4" cy="4" r="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></circle></svg>
                          <a href={(profile as any).mentor.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 hover:underline truncate">
                            {(profile as any).mentor.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}
                          </a>
                        </div>
                      )}
                      {(profile as any).mentor.company && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                          <span>{(profile as any).mentor.company}</span>
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
    </div>
  );
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
        {isDoc ? change.document?.type : change.fieldName}
      </td>
      <td className="text-gray-500 text-sm max-w-32 truncate">
        {change.oldValue || '—'}
      </td>
      <td className="text-sm">
        {isDoc && change.document?.filePath ? (
          <a href={`/${change.document.filePath}`} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline text-xs">
            {change.document.originalFileName}
          </a>
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
