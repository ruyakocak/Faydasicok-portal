import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { volunteerApi, studentApi } from '../../api';
import toast from 'react-hot-toast';
import type { StudentProfile } from '../../types';

// ── Constants ────────────────────────────────────────────────────────

const TARGET_GROUPS = [
  'Eğitim & Gençlik (burslar, özel ders, mentorluk, kariyer gelişimi, liderlik, girişimcilik)',
  'İnsani Yardım & Sosyal Destek (gıda yardımı, afet desteği, temel ihtiyaçlar, aile ve çocuk destekleri)',
  'Dezavantajlı Gruplar (engelliler, dezavantajlı bireyler, kadınlar, gençler, mülteciler)',
  'Çevre, Doğa & Sürdürülebilirlik (iklim değişikliği, geri dönüşüm, sıfır atık, enerji verimliliği)',
  'Teknoloji, Bilim & İnovasyon (yapay zekâ, kodlama, STEM, girişimcilik, dijital dönüşüm)',
  'Toplumsal Gelişim (gönüllülük, sosyal sorumluluk, sosyal girişimcilik, toplumsal dayanışma)',
  'Diğer',
];

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_PROJECT_DESC = 100;

// ── File Drop Zone ───────────────────────────────────────────────────
function FileDropZone({ label, file, onFile, onRemove, required }: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }, []);

  function validateAndSet(f: File) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Sadece PDF, JPG veya PNG dosyaları kabul edilmektedir.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error('Dosya boyutu 5MB\'ı geçemez.');
      return;
    }
    onFile(f);
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
            ${dragOver
              ? 'border-primary-400 bg-primary-50 scale-[1.01]'
              : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/40'
            }
          `}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${dragOver ? 'bg-primary-100' : 'bg-gray-100'}`}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 text-center">
            <span className="font-medium text-primary-600">Dosya seçin</span> veya sürükleyip bırakın
          </p>
          <p className="text-xs text-gray-400">PDF, JPG, PNG (maks. 5MB)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) validateAndSet(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1 8.618 3.04A12.02 12.02 0 0 1 12 21.944a12.02 12.02 0 0 1-8.618-3.04" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function VolunteerFormPage({ initialProfile }: { isEmbedded?: boolean; initialProfile?: StudentProfile }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [scholarshipCategoryId, setScholarshipCategoryId] = useState('');
  const [schoolAndDepartment, setSchoolAndDepartment] = useState('');
  const [ngoOrProjectName, setNgoOrProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [targetGroupOther, setTargetGroupOther] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [personalImpactEvaluation, setPersonalImpactEvaluation] = useState('');

  // Files
  const [doc1, setDoc1] = useState<File | null>(null);
  const [doc2, setDoc2] = useState<File | null>(null);
  const [doc3, setDoc3] = useState<File | null>(null);

  // Load profile to pre-fill name/email
  useEffect(() => {
    import('../../api/client').then(({ default: api }) => {
      api.get('/students/scholarship-categories').then(r => {
        setCategories(r.data);
      }).catch(console.error);
    });

    if (initialProfile) {
      setFullName(`${initialProfile.firstName} ${initialProfile.lastName}`.trim());
      setEmail(initialProfile.email || initialProfile.user?.email || '');
      setSchoolAndDepartment(
        [initialProfile.universityName, initialProfile.department].filter(Boolean).join(' - ')
      );
      if (initialProfile.scholarshipCategoryId) {
        setScholarshipCategoryId(initialProfile.scholarshipCategoryId);
      }
      setLoading(false);
      return;
    }

    if (!user?.profileId) return;
    studentApi.getProfile(user.profileId).then(p => {
      setProfile(p);
      setFullName(`${p.firstName} ${p.lastName}`.trim());
      setEmail(p.email || p.user?.email || '');
      setSchoolAndDepartment(
        [p.universityName, p.department].filter(Boolean).join(' - ')
      );
      if (p.scholarshipCategoryId) {
        setScholarshipCategoryId(p.scholarshipCategoryId);
      }
    }).finally(() => setLoading(false));

  }, [user?.profileId, initialProfile]);

  // Validation state
  const projectDescValid = projectDescription.trim().length >= MIN_PROJECT_DESC;
  const hoursValid = /^\d+$/.test(totalHours) && parseInt(totalHours) > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const canSubmit =
    fullName.trim() &&
    emailValid &&
    scholarshipCategoryId &&
    schoolAndDepartment.trim() &&
    ngoOrProjectName.trim() &&
    projectDescValid &&
    targetGroup &&
    (targetGroup !== 'Diğer' || targetGroupOther.trim()) &&
    hoursValid &&
    personalImpactEvaluation.trim() &&
    doc1 !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('fullName', fullName.trim());
      fd.append('email', email.trim());
      fd.append('scholarshipCategoryId', scholarshipCategoryId);
      fd.append('schoolAndDepartment', schoolAndDepartment.trim());
      fd.append('ngoOrProjectName', ngoOrProjectName.trim());
      fd.append('projectDescription', projectDescription.trim());
      fd.append('targetGroup', targetGroup);
      if (targetGroup === 'Diğer') fd.append('targetGroupOther', targetGroupOther.trim());
      fd.append('totalHours', totalHours);
      fd.append('personalImpactEvaluation', personalImpactEvaluation.trim());
      fd.append('document1', doc1!);
      if (doc2) fd.append('document2', doc2);
      if (doc3) fd.append('document3', doc3);

      await volunteerApi.submit(fd);
      setSubmitted(true);
      toast.success('Gönüllülük formu başarıyla gönderildi!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
      </div>
    );
  }

  // ── Success State ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1 8.618 3.04A12.02 12.02 0 0 1 12 21.944a12.02 12.02 0 0 1-8.618-3.04" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Formunuz Gönderildi!</h2>
        <p className="text-gray-500 mb-8">
          Gönüllülük - STK Çalışmaları formunuz başarıyla alınmıştır.<br />
          Teşekkür ederiz.
        </p>
        <button onClick={() => setSubmitted(false)} className="btn-secondary">
          Yeni Form Gönder
        </button>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gönüllülük - STK Çalışmaları</h1>
            <p className="text-sm text-gray-500">2025-2026 Bahar Dönemi</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Form Hakkında Bilgilendirme</p>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-700">
              <li>Tüm alanları eksiksiz doldurunuz.</li>
              <li>Proje detayı en az 100 karakter olmalıdır.</li>
              <li>En az 1, en fazla 3 belge/fotoğraf yükleyebilirsiniz (PDF, JPG, PNG — maks. 5MB).</li>
              <li className="text-red-600 font-medium">Lütfen WhatsApp ekran görüntüsü yüklemeyiniz.</li>
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Kişisel Bilgiler ── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span>
            Kişisel Bilgiler
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Ad Soyad <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Adınız Soyadınız"
              />
            </div>
            <div>
              <label className="form-label">Mail Adresi <span className="text-red-500">*</span></label>
              <input
                type="email"
                className={`form-input ${email && !emailValid ? 'border-red-300 focus:ring-red-500' : ''}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
              />
              {email && !emailValid && (
                <p className="text-xs text-red-500 mt-1">Geçerli bir e-posta adresi giriniz.</p>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">Okul ve Bölüm <span className="text-red-500">*</span></label>
            <input
              className="form-input"
              value={schoolAndDepartment}
              onChange={e => setSchoolAndDepartment(e.target.value)}
              placeholder="Üniversite - Bölüm"
            />
          </div>
        </fieldset>

        {/* ── Gelişim Programı ── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">2</span>
            Gelişim Programı Seçimi <span className="text-red-500">*</span>
          </legend>

          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500">Yükleniyor...</p>
            ) : (
              categories.map(cat => (
                <label
                  key={cat.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    scholarshipCategoryId === cat.id
                      ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${(profile?.scholarshipCategoryId && profile.scholarshipCategoryId !== cat.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="scholarshipCategoryId"
                    value={cat.id}
                    checked={scholarshipCategoryId === cat.id}
                    onChange={e => setScholarshipCategoryId(e.target.value)}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    disabled={!!profile?.scholarshipCategoryId}
                  />
                  <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        {/* ── STK / Proje Bilgileri ── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">3</span>
            STK / Proje Bilgileri
          </legend>

          <div>
            <label className="form-label">STK veya Proje Adı <span className="text-red-500">*</span></label>
            <input
              className="form-input"
              value={ngoOrProjectName}
              onChange={e => setNgoOrProjectName(e.target.value)}
              placeholder="Gönüllü olduğunuz STK veya proje adını yazınız"
            />
          </div>

          <div>
            <label className="form-label">
              Proje Detayı <span className="text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-gray-400">(en az {MIN_PROJECT_DESC} karakter)</span>
            </label>
            <textarea
              className={`form-textarea ${projectDescription && !projectDescValid ? 'border-red-300 focus:ring-red-500' : ''}`}
              rows={5}
              value={projectDescription}
              onChange={e => setProjectDescription(e.target.value)}
              placeholder="Proje hakkında detaylı bilgi veriniz. En az 3 cümle / 100 karakter yazmanız gerekmektedir."
            />
            <div className="flex justify-between mt-1">
              {projectDescription && !projectDescValid ? (
                <p className="text-xs text-red-500">
                  {MIN_PROJECT_DESC - projectDescription.trim().length} karakter daha yazmalısınız.
                </p>
              ) : (
                <span />
              )}
              <p className={`text-xs ${projectDescValid ? 'text-green-600' : 'text-gray-400'}`}>
                {projectDescription.trim().length} / {MIN_PROJECT_DESC}
              </p>
            </div>
          </div>

          <div>
            <label className="form-label">İlgili Dezavantajlı Grup / Kategori <span className="text-red-500">*</span></label>
            <select
              className="form-select"
              value={targetGroup}
              onChange={e => setTargetGroup(e.target.value)}
            >
              <option value="">Seçiniz...</option>
              {TARGET_GROUPS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {targetGroup === 'Diğer' && (
            <div>
              <label className="form-label">Lütfen belirtiniz <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                value={targetGroupOther}
                onChange={e => setTargetGroupOther(e.target.value)}
                placeholder="Hedef grubu açıklayınız"
              />
            </div>
          )}

          <div>
            <label className="form-label">Dönem Boyunca Ayrılan Toplam Saat <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="1"
              className={`form-input w-40 ${totalHours && !hoursValid ? 'border-red-300' : ''}`}
              value={totalHours}
              onChange={e => setTotalHours(e.target.value)}
              placeholder="Örn: 40"
            />
            {totalHours && !hoursValid && (
              <p className="text-xs text-red-500 mt-1">Pozitif bir tamsayı giriniz.</p>
            )}
          </div>
        </fieldset>

        {/* ── Kişisel Etki Değerlendirmesi ── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">4</span>
            Kişisel Etki ve Değişim Değerlendirmesi
          </legend>

          <div>
            <label className="form-label">
              Değerlendirmeniz <span className="text-red-500">*</span>
            </label>
            <textarea
              className="form-textarea"
              rows={4}
              value={personalImpactEvaluation}
              onChange={e => setPersonalImpactEvaluation(e.target.value)}
              placeholder="Bu gönüllülük deneyiminin size kişisel olarak nasıl bir etki ve değişim yarattığını değerlendiriniz."
            />
          </div>
        </fieldset>

        {/* ── Dosya Yükleme ── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">5</span>
            Belgeler / Fotoğraflar
          </legend>

          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Lütfen <strong>WhatsApp ekran görüntüsü yüklemeyiniz</strong>. Resmi belge, sertifika veya etkinlik fotoğrafları yükleyiniz.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FileDropZone
              label="Belge 1"
              file={doc1}
              onFile={setDoc1}
              onRemove={() => setDoc1(null)}
              required
            />
            <FileDropZone
              label="Belge 2"
              file={doc2}
              onFile={setDoc2}
              onRemove={() => setDoc2(null)}
            />
            <FileDropZone
              label="Belge 3"
              file={doc3}
              onFile={setDoc3}
              onRemove={() => setDoc3(null)}
            />
          </div>
        </fieldset>

        {/* ── Submit ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary px-8 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="spinner border-white/30 border-t-white w-4 h-4" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                Formu Gönder
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
