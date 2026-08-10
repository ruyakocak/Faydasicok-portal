import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { StudentProfile, Document as DocFile, DocumentPeriod, AuditLog } from '../types';
import { studentApi, documentApi, auditApi } from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UNIVERSITIES } from '../constants/universities';

// ── Status Badge ──────────────────────────────────────────────────────
export function StatusBadge({ status, note }: { status: string; note?: string | null }) {
  const cls = status === 'APPROVED' ? 'badge-approved' : status === 'PENDING' ? 'badge-pending' : 'badge-rejected';
  const label = status === 'APPROVED' ? 'Onaylandı' : status === 'PENDING' ? 'Onay Bekliyor' : 'Reddedildi';
  return (
    <span title={note || undefined} className={`badge ${cls} cursor-default`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${status === 'APPROVED' ? 'bg-status-approved' : status === 'PENDING' ? 'bg-status-pending' : 'bg-status-rejected'}`} />
      {label}
      {note && status === 'REJECTED' && <span className="ml-1 text-xs">({note})</span>}
    </span>
  );
}

// ── Form field row ─────────────────────────────────────────────────────
function FieldRow({ label, value, editing, name, onChange, type = 'text', options }: {
  label: string;
  value: string | number | boolean | null | undefined;
  editing?: boolean;
  name?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string;
  options?: { value: string; label: string }[];
}) {
  const displayValue = value === true ? 'Evet' : value === false ? 'Hayır' : value ?? '—';
  if (!editing) {
    return (
      <div className="py-2.5 border-b border-gray-100 last:border-0 grid grid-cols-[180px_1fr] gap-4 items-start">
        <dt className="text-sm text-gray-500">{label}</dt>
        <dd className="text-sm text-gray-900 font-medium">{String(displayValue)}</dd>
      </div>
    );
  }
  if (options) {
    return (
      <div className="py-2 border-b border-gray-100 last:border-0 grid grid-cols-[180px_1fr] gap-4 items-center">
        <label className="text-sm text-gray-500">{label}</label>
        <select name={name} className="form-select text-sm" defaultValue={String(value)} onChange={onChange as any}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  if (type === 'textarea') {
    return (
      <div className="py-2 border-b border-gray-100 last:border-0 grid grid-cols-[180px_1fr] gap-4 items-start">
        <label className="text-sm text-gray-500 mt-2">{label}</label>
        <textarea name={name} className="form-textarea text-sm" rows={3} defaultValue={String(value ?? '')} onChange={onChange as any} />
      </div>
    );
  }
  return (
    <div className="py-2 border-b border-gray-100 last:border-0 grid grid-cols-[180px_1fr] gap-4 items-center">
      <label className="text-sm text-gray-500">{label}</label>
      <input name={name} type={type} className="form-input text-sm" defaultValue={String(value ?? '')} onChange={onChange} />
    </div>
  );
}

const studentStatusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  INCOMPLETE: 'Tamamlanmadı',
  PASSIVE: 'Pasif',
  GRADUATED: 'Mezun',
};

const enrollmentStatusLabels: Record<string, string> = {
  ENROLLED: 'Kayıtlı',
  ON_LEAVE: 'İzinli',
  GRADUATED: 'Mezun',
  DROPPED: 'Ayrıldı',
};

// ── Personal Info Tab ─────────────────────────────────────────────────
export function PersonalTab({ profile, onSave, readOnly }: {
  profile: StudentProfile;
  onSave?: (data: Partial<StudentProfile>) => Promise<void>;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'REVIEWER';
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<StudentProfile>>({});
  const [saving, setSaving] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(formData);
      toast.success('Kişisel bilgileriniz güncellendi.');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Kişisel Bilgiler</h3>
        {!readOnly && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Düzenle
          </button>
        )}
        {!readOnly && editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">İptal</button>
            <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Gönder'}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mb-4 bg-blue-50 text-blue-700 rounded p-3 text-sm flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          <span>Değişiklikler doğrudan kaydedilir ve değişiklik geçmişinde loglanır.</span>
        </div>
      )}

      <dl>
        <FieldRow label="TC Kimlik No" value={profile.user?.tcKimlikNo} />
        <FieldRow label="Ad" value={profile.firstName} editing={editing} name="firstName" onChange={handleChange} />
        <FieldRow label="Soyad" value={profile.lastName} editing={editing} name="lastName" onChange={handleChange} />
        <FieldRow label="Cinsiyet" value={profile.gender} editing={editing} name="gender" onChange={handleChange}
          options={[{ value: '', label: 'Seçiniz' }, { value: 'Erkek', label: 'Erkek' }, { value: 'Kadın', label: 'Kadın' }]} />
        <FieldRow label="Doğum Tarihi" value={profile.birthDate ? format(new Date(profile.birthDate), 'dd.MM.yyyy') : null}
          editing={editing} name="birthDate" type="date" onChange={handleChange} />
        <FieldRow label="Doğum Yeri" value={profile.birthPlace} editing={editing} name="birthPlace" onChange={handleChange} />
        <FieldRow label="Nüfusa Kayıtlı Şehir" value={profile.registeredCity} editing={editing} name="registeredCity" onChange={handleChange} />
        <FieldRow label="Burs Talep Tarihi" value={profile.scholarshipDate ? format(new Date(profile.scholarshipDate), 'dd.MM.yyyy') : null}
          editing={editing} name="scholarshipDate" type="date" onChange={handleChange} />
        {isAdmin ? (
          <FieldRow label="Kayıt Durumu" value={profile.studentStatus} editing={editing} name="studentStatus" onChange={handleChange}
            options={[{ value: 'INCOMPLETE', label: 'Tamamlanmadı' }, { value: 'ACTIVE', label: 'Aktif' }, { value: 'PASSIVE', label: 'Pasif' }, { value: 'GRADUATED', label: 'Mezun' }]} />
        ) : (
          <FieldRow label="Kayıt Durumu" value={studentStatusLabels[profile.studentStatus] || profile.studentStatus} />
        )}
        <FieldRow label="Öğrenci Durumu" value={enrollmentStatusLabels[profile.enrollmentStatus] || profile.enrollmentStatus} />
      </dl>

      {/* Bank Info Card */}
      <div className="mt-6 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Banka Bilgisi
        </h4>
        <dl>
          <FieldRow label="Banka" value={profile.bankName} />
          <FieldRow label="IBAN" value={profile.iban ? `TR***${profile.iban.slice(-4)}` : '—'} />
        </dl>
        {!readOnly && (
          <BankInfoForm profileId={profile.id} />
        )}
      </div>
    </div>
  );
}

function BankInfoForm({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await studentApi.updateBankInfo(profileId, iban, bankName);
      toast.success('Banka bilgisi güncelleme talebi gönderildi.');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return open ? (
    <form onSubmit={handleSave} className="mt-3 space-y-3 border-t border-gray-200 pt-3">
      <div className="text-xs text-status-pending-text bg-status-pending-bg rounded p-2">
        Banka bilgisi değişikliği her zaman admin onayına gönderilir.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Banka Adı</label>
          <input className="form-input" value={bankName} onChange={e => setBankName(e.target.value)} required />
        </div>
        <div>
          <label className="form-label">IBAN</label>
          <input className="form-input font-mono" placeholder="TR00 0000 0000 0000 0000 0000 00" value={iban} onChange={e => setIban(e.target.value)} required />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">İptal</button>
        <button type="submit" className="btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Güncelleme Talebi Gönder'}
        </button>
      </div>
    </form>
  ) : (
    <button onClick={() => setOpen(true)} className="btn-secondary btn-sm mt-3">Banka Bilgisini Güncelle</button>
  );
}

// ── Family Tab ────────────────────────────────────────────────────────
export function FamilyTab({ profile, onSave, readOnly }: {
  profile: StudentProfile;
  onSave?: (data: Partial<StudentProfile>) => Promise<void>;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<StudentProfile>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const val = e.target.type === 'number' ? e.target.value : e.target.value;
    setFormData((prev: any) => ({ ...prev, [e.target.name]: val }));
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(formData);
      toast.success('Aile bilgileriniz güncellendi.');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Aile Bilgileri</h3>
        {!readOnly && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">Düzenle</button>
        )}
        {!readOnly && editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">İptal</button>
            <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Gönder'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Father */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">Baba Bilgileri</h4>
          <dl>
            <FieldRow label="Ad" value={profile.fatherName} editing={editing} name="fatherName" onChange={handleChange} />
            <FieldRow label="Yaş" value={profile.fatherAge} editing={editing} name="fatherAge" type="number" onChange={handleChange} />
            <FieldRow label="Sağ Mı?" value={profile.fatherAlive} editing={editing} name="fatherAlive" onChange={handleChange}
              options={[{ value: 'true', label: 'Evet' }, { value: 'false', label: 'Hayır' }]} />
            <FieldRow label="Meslek" value={profile.fatherOccupation} editing={editing} name="fatherOccupation" onChange={handleChange} />
            <FieldRow label="Gelir (₺)" value={profile.fatherIncome} editing={editing} name="fatherIncome" type="number" onChange={handleChange} />
          </dl>
        </div>

        {/* Mother */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">Anne Bilgileri</h4>
          <dl>
            <FieldRow label="Ad" value={profile.motherName} editing={editing} name="motherName" onChange={handleChange} />
            <FieldRow label="Yaş" value={profile.motherAge} editing={editing} name="motherAge" type="number" onChange={handleChange} />
            <FieldRow label="Sağ Mı?" value={profile.motherAlive} editing={editing} name="motherAlive" onChange={handleChange}
              options={[{ value: 'true', label: 'Evet' }, { value: 'false', label: 'Hayır' }]} />
            <FieldRow label="Meslek" value={profile.motherOccupation} editing={editing} name="motherOccupation" onChange={handleChange} />
            <FieldRow label="Gelir (₺)" value={profile.motherIncome} editing={editing} name="motherIncome" type="number" onChange={handleChange} />
          </dl>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">Aile Genel Bilgileri</h4>
        <dl>
          <FieldRow label="Aile Birey Sayısı" value={profile.familyMemberCount} editing={editing} name="familyMemberCount" type="number" onChange={handleChange} />
          <FieldRow label="Kardeş Sayısı" value={profile.siblingCount} editing={editing} name="siblingCount" type="number" onChange={handleChange} />
          <FieldRow label="Öğrenimdeki Kardeş" value={profile.siblingsInEducation} editing={editing} name="siblingsInEducation" type="number" onChange={handleChange} />
          <FieldRow label="Sosyal Güvence" value={profile.socialSecurity} editing={editing} name="socialSecurity" onChange={handleChange} />
          <FieldRow label="Ev Durumu" value={profile.homeOwnership} editing={editing} name="homeOwnership" onChange={handleChange}
            options={[{ value: '', label: 'Seçiniz' }, { value: 'Kira', label: 'Kira' }, { value: 'Mülk', label: 'Mülk' }, { value: 'Diğer', label: 'Diğer' }]} />
          <FieldRow label="Ev Adresi" value={profile.homeAddress} editing={editing} name="homeAddress" onChange={handleChange} />
          <FieldRow label="Açıklama" value={profile.familyDescription} editing={editing} name="familyDescription" type="textarea" onChange={handleChange} />
        </dl>
      </div>
    </div>
  );
}

// ── Education Tab ─────────────────────────────────────────────────────
export function EducationTab({ profile, onSave, readOnly }: {
  profile: StudentProfile;
  onSave?: (data: Partial<StudentProfile>) => Promise<void>;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<StudentProfile>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(formData);
      toast.success('Eğitim bilgileriniz güncellendi.');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Eğitim Bilgileri</h3>
        {!readOnly && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">Düzenle</button>
        )}
        {!readOnly && editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">İptal</button>
            <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Gönder'}
            </button>
          </div>
        )}
      </div>

      <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">Üniversite</h4>
      <dl>
        <FieldRow label="Üniversite" value={profile.universityName} editing={editing} name="universityName" onChange={handleChange} options={UNIVERSITIES} />
        <FieldRow label="Fakülte" value={profile.faculty} editing={editing} name="faculty" onChange={handleChange} />
        <FieldRow label="Bölüm" value={profile.department} editing={editing} name="department" onChange={handleChange} />
        <FieldRow label="Sınıf" value={profile.grade ? `${profile.grade}. Sınıf` : null} editing={editing} name="grade" onChange={handleChange}
          options={[1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n}. Sınıf` }))} />
        <FieldRow label="Üniversite Türü" value={profile.universityType} editing={editing} name="universityType" onChange={handleChange}
          options={[{ value: '', label: 'Seçiniz' }, { value: 'Devlet', label: 'Devlet' }, { value: 'Vakıf', label: 'Vakıf' }]} />
      </dl>
    </div>
  );
}

// ── Static Document Types ─────────────────────────────────────────────
const STATIC_DOC_TYPES = [
  { type: 'APPLICATION_FORM', label: 'Başvuru Formu' },
  { type: 'YKS_RESULT', label: 'YKS Sonuç Belgesi' },
  { type: 'UNIVERSITY_PLACEMENT', label: 'Üniversite Yerleşme Belgesi' },
  { type: 'MOTHER_INCOME', label: 'Anne Gelir Belgesi' },
  { type: 'FATHER_INCOME', label: 'Baba Gelir Belgesi' },
  { type: 'ID_PHOTOCOPY', label: 'Kimlik Fotokopisi' },
  { type: 'CRIMINAL_RECORD', label: 'Adli Sicil Kaydı' },
  { type: 'GRADUATION_CERTIFICATE', label: 'Üniversite Mezuniyet Belgesi' },
];

// ── Documents Tab ─────────────────────────────────────────────────────
export function DocumentsTab({ profile, documents, periods, onUpload, readOnly }: {
  profile: StudentProfile;
  documents: DocFile[];
  periods: DocumentPeriod[];
  onUpload?: () => void;
  readOnly?: boolean;
}) {
  const staticDocs = documents.filter(d => d.isStatic);
  const transcripts = documents.filter(d => d.type === 'TRANSCRIPT');
  const certificates = documents.filter(d => d.type === 'STUDENT_CERTIFICATE');
  const volunteerReports = documents.filter(d => d.type === 'VOLUNTEER_REPORT');

  const transcriptPeriods = periods.filter(p => p.type === 'TRANSCRIPT');
  const certPeriods = periods.filter(p => p.type === 'STUDENT_CERTIFICATE');
  const volunteerPeriods = periods.filter(p => p.type === 'VOLUNTEER_REPORT');

  return (
    <div className="space-y-8">
      {/* Transcripts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Transkriptler</h3>
          {!readOnly && (
            <PeriodUploadButton
              periods={transcriptPeriods}
              profileId={profile.id}
              docType="transcript"
              onUploaded={onUpload}
            />
          )}
        </div>
        <DocumentTable docs={transcripts} showGrade />
      </section>

      {/* Student Certificates */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Öğrenci Belgeleri</h3>
          {!readOnly && (
            <PeriodUploadButton
              periods={certPeriods}
              profileId={profile.id}
              docType="student-certificate"
              onUploaded={onUpload}
            />
          )}
        </div>
        <DocumentTable docs={certificates} />
      </section>

      {/* Volunteer Reports */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">STK Gönüllülük Raporları</h3>
          {!readOnly && (
            <PeriodUploadButton
              periods={volunteerPeriods}
              profileId={profile.id}
              docType="volunteer-report"
              onUploaded={onUpload}
            />
          )}
        </div>
        <DocumentTable docs={volunteerReports} showVolunteer />
      </section>
    </div>
  );
}



function DocumentTable({ docs, showVolunteer, showGrade }: { docs: DocFile[]; showVolunteer?: boolean; showGrade?: boolean }) {
  if (!docs.length) {
    return <p className="text-sm text-gray-400 text-center py-4">Henüz belge yüklenmedi.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="data-table table-fixed w-full min-w-[850px]">
        <thead>
          <tr>
            <th className={showGrade ? 'w-64' : 'w-[352px]'}>Dönem</th>
            {showGrade && <th className="w-24">Sınıf</th>}
            <th className={showVolunteer ? 'w-40' : 'w-[352px]'}>Yüklenme Tarihi</th>
            {showVolunteer && <th className="w-48">Kurum</th>}
            <th className="w-32">Durum</th>
            <th className="w-auto">Dosya</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(doc => (
            <tr key={doc.id}>
              <td>{doc.period?.label || (doc.academicYear ? `${doc.academicYear} ${doc.semester === 'GUZ' ? 'Güz' : doc.semester === 'BAHAR' ? 'Bahar' : ''}` : '—')}</td>
              {showGrade && <td>{doc.grade ? `${doc.grade}. Sınıf` : '—'}</td>}
              <td className="text-gray-500 text-xs">{format(new Date(doc.uploadedAt), 'dd.MM.yyyy HH:mm')}</td>
              {showVolunteer && <td>{doc.volunteerOrg || '—'}</td>}
              <td><StatusBadge status={doc.status} note={doc.rejectionNote} /></td>
              <td>
                <a href={`/${doc.filePath}`} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline text-xs truncate max-w-32 inline-block">
                  {doc.originalFileName}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaticUploadButton({ profileId, type, onUploaded }: { profileId: string; type: string; onUploaded?: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await documentApi.uploadStatic(profileId, type, file);
      toast.success('Belge yüklendi, onay bekleniyor.');
      onUploaded?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <label className={`btn-secondary btn-sm cursor-pointer flex-shrink-0 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
      {loading ? <span className="spinner border-gray-300 border-t-gray-700 w-3 h-3" /> : (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
      )}
      Yükle
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={handle} />
    </label>
  );
}

function PeriodUploadButton({ periods = [], profileId, docType, onUploaded }: {
  periods?: DocumentPeriod[];
  profileId: string;
  docType: string;
  onUploaded?: () => void;
}) {
  const openPeriods = periods.filter(p => p.isOpen);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState(openPeriods[0]?.id || '');
  const [form, setForm] = useState({ grade: '', semester: '', academicYear: '', volunteerOrg: '', note: '' });
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error('Dosya seçiniz.'); return; }
    if (!selectedPeriodId) { toast.error('Lütfen bir dönem seçiniz.'); return; }
    setLoading(true);
    try {
      const data: Record<string, string> = {
        grade: form.grade,
        semester: form.semester,
        academicYear: form.academicYear,
        note: form.note,
        volunteerOrg: form.volunteerOrg,
        periodId: selectedPeriodId,
      };
      if (docType === 'transcript') await documentApi.uploadTranscript(profileId, data, file);
      else if (docType === 'student-certificate') await documentApi.uploadStudentCertificate(profileId, data, file);
      else await documentApi.uploadVolunteerReport(profileId, data, file);
      toast.success('Belge yüklendi, onay bekleniyor.');
      setOpen(false);
      onUploaded?.();
    } finally {
      setLoading(false);
    }
  }

  if (openPeriods.length === 0) {
    return <button disabled className="btn-secondary btn-sm opacity-50 cursor-not-allowed">Yükleme Kapalı</button>;
  }

  if (open) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-modal w-full max-w-md">
          <div className="p-5 border-b border-gray-200">
            <h3 className="font-semibold">Belge Yükle</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="form-label">Yüklenecek Dönem <span className="text-primary-500">*</span></label>
              <select className="form-select" value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} required>
                {openPeriods.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            {docType === 'transcript' && (
              <div>
                <label className="form-label">Sınıf</label>
                <select className="form-select" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                  <option value="">Seçiniz</option>
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}. Sınıf</option>)}
                </select>
              </div>
            )}
            {docType === 'volunteer-report' && (
              <div>
                <label className="form-label">Gönüllülük Yapılan Kurum <span className="text-primary-500">*</span></label>
                <input className="form-input" value={form.volunteerOrg} onChange={e => setForm(f => ({ ...f, volunteerOrg: e.target.value }))} required />
              </div>
            )}
            <div>
              <label className="form-label">Not / Açıklama</label>
              <input className="form-input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Dosya (PDF, JPG, PNG) <span className="text-primary-500">*</span></label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input py-1.5" onChange={e => setFile(e.target.files?.[0] || null)} required />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">İptal</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Yükle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setOpen(true)} className="btn-primary btn-sm">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
      Belge Yükle
    </button>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────
interface ActivityTabProps {
  profileId: string;
}

export function ActivityTab({ profileId }: ActivityTabProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditApi.getLogs({ studentProfileId: profileId, limit: '100' })
      .then(res => setLogs(res.data))
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) {
    return <div className="flex items-center justify-center py-10"><span className="spinner border-gray-300 border-t-primary-500 w-7 h-7" /></div>;
  }

  if (!logs.length) {
    return <p className="text-sm text-gray-400 text-center py-4">Henüz bir işlem geçmişi bulunmamaktadır.</p>;
  }

  const actionLabels: Record<string, string> = {
    CREATE: 'Oluşturuldu',
    UPDATE: 'Güncellendi',
    DELETE: 'Silindi',
    APPROVE: 'Onaylandı',
    REJECT: 'Reddedildi',
    UPLOAD: 'Belge Yüklendi',
  };

  const moduleLabels: Record<string, string> = {
    PERSONAL_INFO: 'Kişisel Bilgiler',
    FAMILY_INFO: 'Aile Bilgileri',
    EDUCATION_INFO: 'Eğitim Bilgileri',
    BANK_INFO: 'Banka Bilgisi',
    Document: 'Belge',
    DocumentPeriod: 'Dönem',
  };

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Modül</th>
            <th>İşlem</th>
            <th>Detay</th>
            <th>Eski Değer</th>
            <th>Yeni Değer</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td className="text-xs text-gray-500 font-mono whitespace-nowrap">
                {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm')}
              </td>
              <td className="text-sm font-medium text-gray-700">
                {moduleLabels[log.module] || log.module}
              </td>
              <td>
                <span className={`badge ${log.action === 'APPROVE' ? 'badge-approved' :
                  log.action === 'REJECT' ? 'badge-rejected' :
                    log.action === 'UPLOAD' ? 'badge-primary' :
                      'badge-gray'
                  } text-xs`}>
                  {actionLabels[log.action] || log.action}
                </span>
              </td>
              <td className="text-sm text-gray-600 font-mono">
                {log.entityId === log.newValue || log.entityId === log.oldValue || !log.entityId ? '—' : log.entityId}
              </td>
              <td className="text-xs text-gray-500 max-w-32 truncate" title={log.oldValue || undefined}>
                {log.oldValue || '—'}
              </td>
              <td className="text-xs text-gray-700 max-w-32 truncate" title={log.newValue || undefined}>
                {log.newValue || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
