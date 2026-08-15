import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { StudentProfile, Document as DocFile, DocumentPeriod, AuditLog } from '../types';
import { studentApi, documentApi, auditApi, adminApi } from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
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
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (editing) {
      if (isAdmin) {
        adminApi.listScholarshipCategories().then(setCategories).catch(console.error);
      } else {
        studentApi.listScholarshipCategories().then(setCategories).catch(console.error);
      }
    }
  }, [isAdmin, editing]);

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
        {editing ? (
          <FieldRow 
            label="Bursiyer Kategorisi" 
            value={formData.scholarshipCategoryId || profile.scholarshipCategoryId || ''} 
            editing={true} 
            name="scholarshipCategoryId" 
            onChange={handleChange}
            options={[
              { value: '', label: 'Seçiniz' },
              ...categories.map(c => ({ value: c.id, label: c.name }))
            ]}
          />
        ) : (
          <FieldRow label="Bursiyer Kategorisi" value={profile.scholarshipCategory?.name || 'Belirtilmemiş'} />
        )}
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
          <FieldRow label="IBAN" value={profile.iban || '—'} />
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'REVIEWER';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isAdmin) {
        // Admin updates directly
        await adminApi.updateStudentProfile(profileId, { iban, bankName });
        toast.success('Banka bilgisi güncellendi.');
        // Notify parent to reload (if possible, else they can just refresh)
        window.location.reload(); 
      } else {
        // Student goes through approval
        await studentApi.updateBankInfo(profileId, iban, bankName);
        toast.success('Banka bilgisi güncelleme talebi gönderildi.');
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return open ? (
    <form onSubmit={handleSave} className="mt-3 space-y-3 border-t border-gray-200 pt-3">
      {!isAdmin && (
        <div className="text-xs text-status-pending-text bg-status-pending-bg rounded p-2">
          Banka bilgisi değişikliği her zaman admin onayına gönderilir.
        </div>
      )}
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

// ── Documents Tab ─────────────────────────────────────────────────────
export function DocumentsTab({ profile, documents, periods, onUpload, readOnly }: {
  profile: StudentProfile;
  documents: DocFile[];
  periods: DocumentPeriod[];
  onUpload?: () => void;
  readOnly?: boolean;
}) {
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from public authenticated endpoint
    documentApi.getActiveTypes().then(types => {
      setDocTypes(types);
    }).catch(() => {
      // Ignore errors or show toast
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-10 text-center"><span className="spinner w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-8">
      {docTypes.filter(docType => {
        let dtCatIds: string[] = [];
        try {
          dtCatIds = docType.categoryIds ? JSON.parse(docType.categoryIds) : [];
          if (!Array.isArray(dtCatIds)) dtCatIds = [];
        } catch {}

        // Eğer belge türünün bir kategori kısıtlaması varsa ve öğrencinin kategorisi buna uymuyorsa, gösterme
        if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
          return false;
        }
        if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
          // Belge türü kısıtlı ama öğrencinin kategorisi yoksa, yine gösterme
          return false;
        }

        return true;
      }).map(docType => {
        const typeDocs = documents.filter(d => d.type === docType.code);
        // Öğrencinin kategorisine açık olan dönemleri filtrele
        const typePeriods = periods.filter(p => {
          if (p.type !== docType.code) return false;
          // Fallback: If for some reason we still need to check period categories, we ignore it here
          // as the single source of truth is now the DocumentType (Belge Türü) categoryIds.return true;
          return true;
        });

        const hasOpenPeriod = typePeriods.some(p => p.isOpen);
        const hasUploadedDocs = typeDocs.length > 0;

        // Kullanıcının talebi: 'yüklemeye açık olmayan belgeler ekranda gözükmesin'
        // Eğer bu belge türü o anda yüklemeye açık değilse ve daha önce yüklenmiş belge de yoksa tamamen gizleyelim.
        if (!hasOpenPeriod && !hasUploadedDocs) {
          return null;
        }
        
        return (
          <section key={docType.code}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">{docType.name}</h3>
              {!readOnly && (
                <PeriodUploadButton
                  periods={typePeriods}
                  profileId={profile.id}
                  docType={docType}
                  onUploaded={onUpload}
                />
              )}
            </div>
            <DocumentTable docs={typeDocs} docType={docType} />
          </section>
        );
      })}
    </div>
  );
}



function DocumentTable({ docs, docType }: { docs: DocFile[]; docType: any }) {
  if (!docs.length) {
    return <p className="text-sm text-gray-400 text-center py-4">Henüz belge yüklenmedi.</p>;
  }
  
  let customFields: any[] = [];
  try {
    customFields = docType.customFields ? JSON.parse(docType.customFields) : [];
  } catch (e) {}

  return (
    <div className="overflow-x-auto">
      <table className="data-table table-fixed w-full min-w-[850px]">
        <thead>
          <tr>
            <th className="w-56">Dönem</th>
            <th className="w-36">Yüklenme Tarihi</th>
            {customFields.map(f => (
              <th key={f.id} className="w-56 whitespace-normal break-words">{f.label}</th>
            ))}
            <th className="w-40">Durum</th>
            <th className="w-auto">Dosya</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(doc => {
            let answers: any = {};
            try { answers = doc.dynamicFields ? JSON.parse(doc.dynamicFields) : {}; } catch (e) {}
            // Backwards compatibility for legacy fields
            if (docType.code === 'TRANSCRIPT' && doc.grade) answers['Sınıf'] = doc.grade;
            if (docType.code === 'VOLUNTEER_REPORT' && doc.volunteerOrg) answers['Kurum'] = doc.volunteerOrg;
            
            return (
              <tr key={doc.id}>
                <td>{doc.period?.label || (doc.academicYear ? `${doc.academicYear} ${doc.semester === 'GUZ' ? 'Güz' : doc.semester === 'BAHAR' ? 'Bahar' : ''}` : '—')}</td>
                <td className="text-gray-500 text-xs">{format(new Date(doc.uploadedAt), 'dd.MM.yyyy HH:mm')}</td>
                {customFields.map(f => (
                  <td key={f.id} className="truncate" title={answers[f.id]}>{answers[f.id] || '—'}</td>
                ))}
                <td><StatusBadge status={doc.status} note={doc.rejectionNote} /></td>
                <td>
                  <a href={`/${doc.filePath}`} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline text-xs truncate max-w-32 inline-block">
                    {doc.originalFileName}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Removed StaticUploadButton as it is unused

function PeriodUploadButton({ periods = [], profileId, docType, onUploaded }: {
  periods?: DocumentPeriod[];
  profileId: string;
  docType: any;
  onUploaded?: () => void;
}) {
  const openPeriods = periods.filter(p => p.isOpen);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState(openPeriods[0]?.id || '');
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, any>>({});
  const [file, setFile] = useState<File | null>(null);

  let customFields: any[] = [];
  try { customFields = docType.customFields ? JSON.parse(docType.customFields) : []; } catch(e) {}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error('Dosya seçiniz.'); return; }
    if (!selectedPeriodId) { toast.error('Lütfen bir dönem seçiniz.'); return; }
    setLoading(true);
    try {
      await documentApi.uploadDynamicDocument(profileId, selectedPeriodId, docType.code, dynamicAnswers, file);
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
            <h3 className="font-semibold">{docType.name} Yükle</h3>
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
            
            {customFields.map(field => (
              <div key={field.id}>
                <label className="form-label">{field.label} {field.required && <span className="text-primary-500">*</span>}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="form-input"
                    required={field.required}
                    value={dynamicAnswers[field.id] || ''}
                    onChange={e => setDynamicAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="form-input"
                    required={field.required}
                    value={dynamicAnswers[field.id] || ''}
                    onChange={e => setDynamicAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}

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
