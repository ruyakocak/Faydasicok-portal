import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentApi, documentApi, approvalApi, adminApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod, ApprovableChange } from '../../types';
import { PersonalTab, FamilyTab, EducationTab, DocumentsTab, ActivityTab } from '../../components/ProfileTabs';
import toast from 'react-hot-toast';

const TABS = ['Kişisel Bilgiler', 'Aile Bilgileri', 'Eğitim Bilgileri', 'Dokümanlar', 'Aktivite Geçmişi'];

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
      const [p, d, per, changes] = await Promise.all([
        studentApi.getProfile(profileId),
        studentApi.getDocuments(profileId),
        documentApi.getPeriods(),
        approvalApi.getQueue({ studentId: profileId, status: 'PENDING', limit: '50' }),
      ]);
      setProfile(p);
      setDocuments(d);
      setPeriods(per);
      setPendingChanges(changes.data);
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
            {profile.scholarshipGroup && (
              <div className="mt-2 flex items-center gap-1.5">
                {profile.scholarshipGroup === 'Sedefteki İnciler' ? (
                  <img src="/sedefteki-inciler-logo.png" alt="Sedefteki İnciler" className="h-6 object-contain" />
                ) : (
                  <img src="/izbirakanlar-logo.png" alt="İz Bırakanlar" className="h-6 object-contain" />
                )}
                <span className="text-[11px] font-semibold text-gray-500">{profile.scholarshipGroup} Programı</span>
              </div>
            )}
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
              <div className="text-center bg-amber-50 border border-amber-200 rounded px-3 py-1">
                <span className="badge-pending text-base font-bold block">{pendingChanges.length}</span>
                <span className="text-[10px] text-gray-500 font-medium">Onay Bekliyor</span>
              </div>
            )}
            <div className="flex flex-col items-end gap-1.5">
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
          {activeTab === 1 && <FamilyTab profile={profile} readOnly />}
          {activeTab === 2 && <EducationTab profile={profile} readOnly />}
          {activeTab === 3 && (
            <DocumentsTab profile={profile} documents={documents} periods={periods} onUpload={loadAll} readOnly />
          )}
          {activeTab === 4 && (
            <ActivityTab profileId={profile.id} />
          )}
        </div>
      </div>
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
