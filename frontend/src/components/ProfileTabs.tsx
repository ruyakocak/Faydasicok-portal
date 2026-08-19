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
  value: React.ReactNode;
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
        <dd className="text-sm text-gray-900 font-medium">{displayValue}</dd>
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
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [bankFormOpen, setBankFormOpen] = useState(false);
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

      {/* Contact Info Card */}
      <div className="mt-6 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.4 19.79 19.79 0 0 1 1.61 4.74 2 2 0 0 1 3.6 2.54h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/>
            </svg>
            İletişim Bilgileri
          </h4>
          {!readOnly && !contactFormOpen && (
            <button onClick={() => setContactFormOpen(true)} className="btn-secondary btn-sm">İletişim Bilgilerini Düzenle</button>
          )}
        </div>
        {!contactFormOpen ? (
          <dl>
            <FieldRow label="E-posta" value={profile.email || profile.user?.email} />
            <FieldRow label="Telefon" value={profile.phone} />
            <FieldRow label="Adres" value={profile.address} />
          </dl>
        ) : (
          <ContactInfoForm profile={profile} onClose={() => setContactFormOpen(false)} />
        )}
      </div>

      {/* Bank Info Card */}
      {(() => {
        const pendingBankChange = profile.approvableChanges?.find(c => c.entityType === 'BANK_INFO');
        let pendingBankData: { bankName?: string; iban?: string } | null = null;
        if (pendingBankChange?.newValue) {
          try {
            pendingBankData = JSON.parse(pendingBankChange.newValue);
          } catch {
            if (pendingBankChange.fieldName === 'iban') {
              pendingBankData = { iban: pendingBankChange.newValue, bankName: profile.bankName };
            } else if (pendingBankChange.fieldName === 'bankName') {
              pendingBankData = { bankName: pendingBankChange.newValue, iban: profile.iban };
            }
          }
        }

        const effectiveBankName = pendingBankData?.bankName ?? profile.bankName;
        const effectiveIban = pendingBankData?.iban ?? profile.iban;

        return (
          <div className="mt-6 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Banka Bilgisi
              </h4>
              {!readOnly && !bankFormOpen && (
                <button onClick={() => setBankFormOpen(true)} className="btn-secondary btn-sm">
                  {pendingBankData ? 'Talebi Düzenle' : 'Banka Bilgisini Güncelle'}
                </button>
              )}
            </div>

            {pendingBankData && !bankFormOpen && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⏳</span>
                  <span>Güncellediğiniz banka/IBAN bilgisi <strong>yönetici onayında beklemektedir</strong>.</span>
                </div>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[11px] font-semibold tracking-wide">
                  Onay Bekliyor
                </span>
              </div>
            )}

            {!bankFormOpen ? (
              <dl>
                <FieldRow
                  label="Banka"
                  value={
                    pendingBankData ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{effectiveBankName || '—'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                          Onay Bekliyor
                        </span>
                      </div>
                    ) : (
                      effectiveBankName || '—'
                    )
                  }
                />
                <FieldRow
                  label="IBAN"
                  value={
                    pendingBankData ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900">{formatIban(effectiveIban || '')}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold font-sans border border-amber-200">
                          Onay Bekliyor
                        </span>
                      </div>
                    ) : (
                      effectiveIban ? formatIban(effectiveIban) : '—'
                    )
                  }
                />
              </dl>
            ) : (
              <BankInfoForm profile={profile} onClose={() => setBankFormOpen(false)} />
            )}
          </div>
        );
      })()}
    </div>
  );
}

function ContactInfoForm({ profile, onClose }: { profile: StudentProfile; onClose: () => void }) {
  const [form, setForm] = useState({ phone: profile.phone || '', email: profile.email || profile.user?.email || '', address: profile.address || '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'REVIEWER';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isAdmin) {
        await adminApi.updateStudentProfile(profile.id, form);
        toast.success('İletişim bilgileri güncellendi.');
        window.location.reload();
      } else {
        const res = await studentApi.updateContact(profile.id, form) as any;
        toast.success(res.message || 'Güncelleme talebi gönderildi.');
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="form-label">E-posta</label>
        <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div>
        <label className="form-label">Telefon</label>
        <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      </div>
      <div>
        <label className="form-label">Adres</label>
        <textarea className="form-textarea" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary btn-sm flex-1">İptal</button>
        <button type="submit" className="btn-primary btn-sm flex-1" disabled={saving}>
          {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}

function formatIban(val: string): string {
  let raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw.startsWith('TR')) {
    if (raw.startsWith('T')) {
      // allow typing T
    } else if (raw.startsWith('R')) {
      raw = 'TR' + raw.slice(1);
    } else if (raw.length > 0) {
      raw = 'TR' + raw;
    }
  }
  if (raw.length > 2) {
    const prefix = raw.slice(0, 2);
    const digits = raw.slice(2).replace(/\D/g, '').slice(0, 24);
    raw = prefix + digits;
  }
  const parts = [];
  for (let i = 0; i < raw.length; i += 4) {
    parts.push(raw.slice(i, i + 4));
  }
  return parts.join(' ');
}

function BankInfoForm({ profile, onClose }: { profile: StudentProfile; onClose: () => void }) {
  const pendingBankChange = profile.approvableChanges?.find(c => c.entityType === 'BANK_INFO');
  let pendingBankData: { bankName?: string; iban?: string } | null = null;
  if (pendingBankChange?.newValue) {
    try {
      pendingBankData = JSON.parse(pendingBankChange.newValue);
    } catch {
      if (pendingBankChange.fieldName === 'iban') {
        pendingBankData = { iban: pendingBankChange.newValue, bankName: profile.bankName };
      } else if (pendingBankChange.fieldName === 'bankName') {
        pendingBankData = { bankName: pendingBankChange.newValue, iban: profile.iban };
      }
    }
  }

  const initialIban = pendingBankData?.iban || profile.iban;
  const initialBankName = pendingBankData?.bankName || profile.bankName;

  const [iban, setIban] = useState(initialIban ? formatIban(initialIban) : 'TR');
  const [bankName, setBankName] = useState(initialBankName || '');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'REVIEWER';

  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  const isIbanComplete = cleanIban.startsWith('TR') && cleanIban.length === 26 && /^TR\d{24}$/.test(cleanIban);

  function handleIbanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatIban(e.target.value);
    setIban(formatted);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isIbanComplete) {
      toast.error('Geçerli bir Türkiye IBAN numarası giriniz. (TR ile başlamalı ve 24 haneli rakam içermelidir.)');
      return;
    }
    if (!bankName.trim()) {
      toast.error('Lütfen banka adını giriniz.');
      return;
    }

    setSaving(true);
    try {
      if (isAdmin) {
        await adminApi.updateStudentProfile(profile.id, { iban: cleanIban, bankName: bankName.trim() });
        toast.success('Banka bilgisi güncellendi.');
        window.location.reload(); 
      } else {
        await studentApi.updateBankInfo(profile.id, cleanIban, bankName.trim());
        toast.success('Banka bilgisi güncelleme talebi gönderildi.');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      {!isAdmin && (
        <div className="text-xs text-status-pending-text bg-status-pending-bg rounded p-2.5 flex items-start gap-2">
          <span className="text-sm">ℹ️</span>
          <span>Banka ve IBAN bilgisi değişikliği güvenlik nedeniyle her zaman yönetici onayına sunulur.</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="form-label font-medium text-xs text-gray-700">Banka Adı</label>
          <input
            className="form-input text-sm"
            placeholder="Örn: Ziraat Bankası, İş Bankası"
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label font-medium text-xs text-gray-700 flex items-center justify-between">
            <span>IBAN Numarası</span>
            <span className="text-[11px] text-gray-400 font-mono">
              {cleanIban.length}/26 karakter
            </span>
          </label>
          <input
            className={`form-input font-mono text-sm tracking-wide ${cleanIban.length > 2 && !isIbanComplete ? 'border-amber-400 focus:border-amber-500' : ''}`}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            value={iban}
            onChange={handleIbanChange}
            maxLength={32}
            required
          />
        </div>
      </div>

      {cleanIban.length > 2 && !isIbanComplete && (
        <p className="text-xs text-amber-600">
          ⚠️ IBAN 'TR' ile başlamalı ve tam 24 haneli rakam içermelidir. (Kalan: {26 - cleanIban.length} hane)
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary btn-sm flex-1">İptal</button>
        <button
          type="submit"
          className="btn-primary btn-sm flex-1"
          disabled={saving || !isIbanComplete || !bankName.trim()}
        >
          {saving ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Güncelleme Talebi Gönder'}
        </button>
      </div>
    </form>
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
  const [activeUploadDocType, setActiveUploadDocType] = useState<any | null>(null);

  useEffect(() => {
    documentApi.getActiveTypes().then(types => {
      setDocTypes(types);
    }).catch(() => {
      // Ignore
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-10 text-center"><span className="spinner w-8 h-8" /></div>;
  }

  // Filter doc types by student's category if restricted
  const applicableDocTypes = docTypes.filter(docType => {
    let dtCatIds: string[] = [];
    try {
      dtCatIds = docType.categoryIds ? JSON.parse(docType.categoryIds) : [];
      if (!Array.isArray(dtCatIds)) dtCatIds = [];
    } catch {}

    if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
      return false;
    }
    if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
      return false;
    }
    return true;
  });

  const staticDocTypes = applicableDocTypes.filter(d => d.isStatic === true);
  const periodicDocTypes = applicableDocTypes.filter(d => d.isStatic !== true);

  // Calculate static docs completion
  const requiredStaticTypes = staticDocTypes.filter(d => d.isRequired !== false);
  const uploadedRequiredCount = requiredStaticTypes.filter(dt => {
    const doc = documents.find(d => d.type === dt.code);
    return doc && doc.status !== 'REJECTED';
  }).length;
  
  const completionPercentage = requiredStaticTypes.length > 0
    ? Math.round((uploadedRequiredCount / requiredStaticTypes.length) * 100)
    : 100;

  function handleDownloadTemplate(dt: any) {
    const isTaahhut = dt.code === 'TAAHHUTNAME';
    const isAydinlatma = dt.code === 'AYDINLATMA_METNI';
    
    let textContent = '';
    const dateStr = format(new Date(), 'dd.MM.yyyy');
    const studentFullName = `${profile.firstName} ${profile.lastName}`.trim();
    const tcNo = profile.user?.tcKimlikNo || '___________________';

    if (isTaahhut) {
      textContent = `FAYDASICOK EGITIM VAKFI BURSİYER TAAHHÜTNAMESİ

Tarih: ${dateStr}
Bursiyer Adı Soyadı: ${studentFullName}
T.C. Kimlik No: ${tcNo}
Üniversite / Bölüm: ${profile.universityName || ''} - ${profile.department || ''}

FAYDASICOK EGITIM VAKFI YÖNETİMİNE,

Vakfınız tarafından tarafıma tahsis edilen burs kapsamında;
1. Burs başvurusunda ve sistemde beyan ettiğim tüm bilgi ve belgelerin doğru ve eksiksiz olduğunu,
2. Öğrenim durumum, iletişim veya banka bilgilerimdeki değişiklikleri zamanında vakfa bildireceğimi,
3. Her yarıyıl başında ve sonunda istenen Transkript, Öğrenci Belgesi ve Gönüllülük Formlarını eksiksiz yükleyeceğimi,
4. Vakfın belirlediği bursiyer kurallarına, ahlaki ve etik değerlere uygun davranacağımı,
aksi takdirde bursumun kesilmesini kabul ve taahhüt ederim.

Bursiyer İmzası:

_____________________________
`;
    } else if (isAydinlatma) {
      textContent = `FAYDASICOK EGITIM VAKFI
KVKK AYDINLATMA VE AÇIK RIZA METNİ

Tarih: ${dateStr}
Bursiyer Adı Soyadı: ${studentFullName}
T.C. Kimlik No: ${tcNo}

6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, Faydasıçok Eğitim Vakfı tarafından burs süreçlerimin yürütülmesi, değerlendirilmesi, iletişimin sağlanması ve kanuni yükümlülüklerin yerine getirilmesi amacıyla paylaştığım kimlik, iletişim, eğitim, aile ve finansal verilerimin işlenmesine, arşivlenmesine ve ilgili mevzuat çerçevesinde yetkili kurumlarla paylaşılmasına açık rıza gösteriyorum.

Bursiyer İmzası:

_____________________________
`;
    } else {
      textContent = `${dt.name.toUpperCase()} ŞABLONU\n\nBursiyer: ${studentFullName} (TC: ${tcNo})\nTarih: ${dateStr}\n\nBu belgeyi imzalayarak taratıp sisteme yükleyiniz.\n\nİmza: _______________________`;
    }

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dt.templateName || `${dt.code}_Sablonu.txt`}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Şablon belgesi indirildi.');
  }

  return (
    <div className="space-y-10">
      {/* ── 1. STATİK / İLK KAYIT BELGELERİ ── */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-gradient-to-r from-purple-50 via-white to-blue-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="p-2 bg-purple-600 text-white rounded-lg shadow-sm">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </span>
                <h3 className="text-lg font-bold text-gray-900">İlk Kayıt & Başvuru Belgeleri</h3>
              </div>
              <p className="text-xs text-gray-600">
                Sisteme yeni kaydedilen bursiyerlerin yalnızca ilk kayıtta bir defaya mahsus yüklemesi gereken evraklar.
              </p>
            </div>

            {/* Muafiyet / İlerleme Durumu */}
            {profile.isInitialDocsExempt ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-900 rounded-xl border border-emerald-300 flex items-center gap-2 text-xs font-semibold shadow-xs">
                <span>🛡️</span>
                <span>Mevcut Bursiyer (Arşivde Kayıtlı / Muaf)</span>
              </div>
            ) : (
              <div className="min-w-[200px] bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-gray-700">Tamamlanma</span>
                  <span className="font-bold text-purple-700">{uploadedRequiredCount} / {requiredStaticTypes.length} Zorunlu</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      completionPercentage === 100 ? 'bg-emerald-500' : 'bg-purple-600'
                    }`}
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {profile.isInitialDocsExempt && (
            <div className="mt-4 p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
              <span className="text-base leading-none">ℹ️</span>
              <p>
                <strong>Muafiyet Bilgisi:</strong> Vakfımızın mevcut bursiyeri olduğunuz için ilk kayıt evraklarınız vakıf arşivimizde mevcuttur. Sistem tarafından onaylı kabul edilmiştir; yalnızca her dönem yenilenen dönemsel evraklarınızı yüklemeniz gerekmektedir.
              </p>
            </div>
          )}
        </div>

        {/* Static Document Items */}
        <div className="p-6 divide-y divide-gray-100">
          {staticDocTypes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Tanımlı ilk kayıt belgesi bulunmuyor.</p>
          ) : (
            staticDocTypes.map((dt) => {
              const uploadedDoc = documents.find(d => d.type === dt.code);
              const isRequired = dt.isRequired !== false;
              const isUploaded = !!uploadedDoc;

              return (
                <div key={dt.code} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 p-2.5 rounded-xl transition-colors">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{dt.name}</span>
                      {isRequired ? (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10px] font-semibold">
                          Zorunlu
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-semibold">
                          Opsiyonel (Varsa)
                        </span>
                      )}
                      {uploadedDoc && (
                        <StatusBadge status={uploadedDoc.status} note={uploadedDoc.rejectionNote} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{dt.description || 'Açıklama belirtilmemiş.'}</p>
                    
                    {uploadedDoc && (
                      <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                        <a
                          href={`/${uploadedDoc.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1 font-medium truncate max-w-xs"
                        >
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          {uploadedDoc.originalFileName}
                        </a>
                        <span>•</span>
                        <span>{format(new Date(uploadedDoc.uploadedAt), 'dd.MM.yyyy HH:mm')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {dt.hasTemplate && (
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate(dt)}
                        className="btn-secondary btn-sm text-xs flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                        title="İmzalanacak boş şablonu indirir"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        Şablonu İndir
                      </button>
                    )}

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setActiveUploadDocType(dt)}
                        className={`btn-sm text-xs flex items-center gap-1.5 ${
                          isUploaded
                            ? 'btn-secondary text-gray-700'
                            : isRequired
                            ? 'btn-primary'
                            : 'btn-secondary text-primary-700 bg-primary-50 border-primary-200'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        {isUploaded ? 'Yeniden Yükle' : 'Belge Yükle'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── 2. DÖNEMSEL BELGELER (Transkript, Öğrenci Belgesi vb.) ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 text-white rounded-md shadow-xs">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              Dönemsel Belgeler
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Her yarıyıl aktif dönemlerde yüklenmesi gereken güncel belgeler (Transkript, Öğrenci Belgesi vb.).
            </p>
          </div>
        </div>

        {periodicDocTypes.map(docType => {
          const typeDocs = documents.filter(d => d.type === docType.code);
          const typePeriods = periods.filter(p => p.type === docType.code);
          const hasOpenPeriod = typePeriods.some(p => p.isOpen);
          const hasUploadedDocs = typeDocs.length > 0;

          if (!hasOpenPeriod && !hasUploadedDocs) {
            return null;
          }
          
          return (
            <div key={docType.code} className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{docType.name}</h4>
                  {docType.description && <p className="text-xs text-gray-500 mt-0.5">{docType.description}</p>}
                </div>
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
            </div>
          );
        })}
      </section>

      {/* Static Document Upload Modal */}
      {activeUploadDocType && (
        <StaticUploadModal
          docType={activeUploadDocType}
          profileId={profile.id}
          onClose={() => setActiveUploadDocType(null)}
          onUploaded={() => {
            setActiveUploadDocType(null);
            onUpload?.();
          }}
        />
      )}
    </div>
  );
}

function StaticUploadModal({ docType, profileId, onClose, onUploaded }: {
  docType: any;
  profileId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, any>>({});

  let customFields: any[] = [];
  try {
    customFields = docType.customFields ? JSON.parse(docType.customFields) : [];
  } catch (e) {}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Lütfen yüklenecek bir dosya seçiniz.');
      return;
    }
    setLoading(true);
    try {
      await documentApi.uploadStatic(profileId, docType.code, file, dynamicAnswers);
      toast.success(`${docType.name} başarıyla yüklendi, onay bekliyor.`);
      onUploaded();
    } catch (err: any) {
      // Handled by axios response interceptor
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{docType.name} Yükle</h3>
            <p className="text-xs text-gray-500 mt-0.5">İlk Kayıt / Başvuru Evrakı</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {docType.description && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900">
              {docType.description}
            </div>
          )}

          {customFields.map(field => (
            <div key={field.id}>
              <label className="form-label text-xs">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
              {field.type === 'textarea' ? (
                <textarea
                  className="form-input text-xs"
                  required={field.required}
                  value={dynamicAnswers[field.id] || ''}
                  onChange={e => setDynamicAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  className="form-input text-xs"
                  required={field.required}
                  value={dynamicAnswers[field.id] || ''}
                  onChange={e => setDynamicAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                />
              )}
            </div>
          ))}

          <div>
            <label className="form-label text-xs">Dosya Seçin (PDF, JPG, PNG) <span className="text-red-500">*</span></label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="form-input py-2 text-xs"
              onChange={e => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Maksimum dosya boyutu 10MB olmalıdır.</p>
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs">İptal</button>
            <button type="submit" className="btn-primary flex-1 text-xs" disabled={loading}>
              {loading ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Yükle ve Gönder'}
            </button>
          </div>
        </form>
      </div>
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
    } catch (err: any) {
      // Handled by axios response interceptor
    } finally {
      setLoading(false);
    }
  }

  if (openPeriods.length === 0) {
    return <button disabled className="btn-secondary btn-sm opacity-50 cursor-not-allowed text-xs">Yükleme Kapalı</button>;
  }

  if (open) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-modal w-full max-w-md">
          <div className="p-5 border-b border-gray-200">
            <h3 className="font-semibold text-sm">{docType.name} Yükle</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="form-label text-xs">Yüklenecek Dönem <span className="text-primary-500">*</span></label>
              <select className="form-select text-xs" value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} required>
                {openPeriods.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            
            {customFields.map(field => (
              <div key={field.id}>
                <label className="form-label text-xs">{field.label} {field.required && <span className="text-primary-500">*</span>}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="form-input text-xs"
                    required={field.required}
                    value={dynamicAnswers[field.id] || ''}
                    onChange={e => setDynamicAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="form-input text-xs"
                    required={field.required}
                    value={dynamicAnswers[field.id] || ''}
                    onChange={e => setDynamicAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            <div>
              <label className="form-label text-xs">Dosya (PDF, JPG, PNG) <span className="text-primary-500">*</span></label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input py-1.5 text-xs" onChange={e => setFile(e.target.files?.[0] || null)} required />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 text-xs">İptal</button>
              <button type="submit" className="btn-primary flex-1 text-xs" disabled={loading}>
                {loading ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Yükle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setOpen(true)} className="btn-primary btn-sm text-xs flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
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
