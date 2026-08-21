import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { volunteerApi, studentApi } from '../../api';
import toast from 'react-hot-toast';
import type { StudentProfile } from '../../types';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
      toast.error("Dosya boyutu 5MB'ı geçemez.");
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
    <div className="space-y-1.5 w-full">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${dragOver ? 'border-primary-400 bg-primary-50 scale-[1.01]' : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/40'}`}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
          </div>
          <p className="text-xs text-gray-500 text-center"><span className="font-medium text-primary-600">Dosya seçin</span></p>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { if (e.target.files?.[0]) validateAndSet(e.target.files[0]); }} />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1 8.618 3.04A12.02 12.02 0 0 1 12 21.944a12.02 12.02 0 0 1-8.618-3.04" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
          </div>
          <button type="button" onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function VolunteerFormPage({ initialProfile }: { isEmbedded?: boolean; initialProfile?: StudentProfile }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [schema, setSchema] = useState<any>(null);
  
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  
  const [scholarshipCategoryId, setScholarshipCategoryId] = useState('');

  useEffect(() => {
    Promise.all([
      import('../../api/client').then(({ default: api }) => api.get('/students/scholarship-categories').then(r => r.data)),
      volunteerApi.getSettingsSchema()
    ]).then(([cats, schemaData]) => {
      setCategories(cats);
      setSchema(schemaData);
      
      const p = initialProfile || null;
      if (p || user?.profileId) {
        if (!p) {
          studentApi.getProfile(user!.profileId!).then(prof => {
            initValues(prof, schemaData);
            setLoading(false);
          }).catch(() => setLoading(false));
        } else {
          initValues(p, schemaData);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }).catch(console.error);
  }, [initialProfile, user?.profileId]);

  function initValues(p: StudentProfile, s: any) {
    const vals: Record<string, string> = {};
    if (s && s.fields) {
      const fn = s.fields.find((f: any) => f.id === 'fullName');
      if (fn) vals.fullName = `${p.firstName} ${p.lastName}`.trim();
      
      const em = s.fields.find((f: any) => f.id === 'email');
      if (em) vals.email = p.email || p.user?.email || '';
      
      const sd = s.fields.find((f: any) => f.id === 'schoolAndDepartment');
      if (sd) vals.schoolAndDepartment = [p.universityName, p.department].filter(Boolean).join(' - ');
    }
    setValues(vals);
    if (p.scholarshipCategoryId) setScholarshipCategoryId(p.scholarshipCategoryId);
  }

  function handleFieldChange(id: string, val: string) {
    setValues(prev => ({ ...prev, [id]: val }));
  }

  function handleFileChange(id: string, file: File | null) {
    setFiles(prev => {
      const next = { ...prev };
      if (file) next[id] = file;
      else delete next[id];
      return next;
    });
  }

  if (loading) {
    return <div className="flex justify-center py-20"><span className="spinner w-8 h-8 border-primary-500" /></div>;
  }

  if (schema && schema.isOpen === false && user?.role === 'STUDENT') {
    return (
      <div className="max-w-[1200px] mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
        <section className="relative pt-10 pb-8 border-b border-gray-200/60 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
              STK Gönüllülük Formu
            </h1>
          </div>
        </section>
        <section className="p-12 text-center rounded-3xl bg-white border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-4 text-gray-400">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Form Şu An Açık Değildir</h2>
          <p className="text-gray-500 max-w-lg mt-2 font-medium">
            Şu anda STK gönüllülük formu başvurusu alınmamaktadır. Yeni dönem açıldığında buradan form doldurabilirsiniz.
          </p>
        </section>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Formunuz Başarıyla Gönderildi!</h2>
        <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto">
          Gönüllülük deneyiminizi bizimle paylaştığınız için teşekkür ederiz. Değerlendirmeniz alınmıştır.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Yeni Form Gönder
        </button>
      </div>
    );
  }

  const schemaFields = schema?.fields || [];
  const schemaDocs = schema?.documents || [];

  const canSubmit = scholarshipCategoryId && schemaFields.every((f: any) => {
    if (f.required) {
      if (!values[f.id] || !values[f.id].trim()) return false;
    }
    return true;
  }) && schemaDocs.every((d: any) => {
    if (d.required && !files[d.id]) return false;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('scholarshipCategoryId', scholarshipCategoryId);
      fd.append('dynamicFields', JSON.stringify(values));
      
      Object.keys(files).forEach(id => {
        fd.append(id, files[id]);
      });

      await volunteerApi.submit(fd);
      setSubmitted(true);
      toast.success('Form başarıyla gönderildi.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Form gönderilemedi. Lütfen alanları kontrol ediniz.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Gönüllülük Formu</h1>
        <p className="mt-2 text-sm text-gray-500">Aşağıdaki alanları eksiksiz doldurarak projenizi bize iletebilirsiniz.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile & Program */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span>
            Program Seçimi
          </legend>
          <div>
            <label className="form-label">Gelişim Programı Seçin <span className="text-red-500">*</span></label>
            <select
              className="form-select"
              value={scholarshipCategoryId}
              onChange={e => setScholarshipCategoryId(e.target.value)}
              required
            >
              <option value="">Seçiniz...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Lütfen bu çalışmayı hangi program kapsamında yaptığınızı seçin.</p>
          </div>
        </fieldset>

        {/* Dynamic Fields */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">2</span>
            Form Soruları
          </legend>
          <div className="space-y-5">
            {schemaFields.map((f: any) => (
              <div key={f.id}>
                <label className="form-label">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={values[f.id] || ''}
                    onChange={e => handleFieldChange(f.id, e.target.value)}
                    required={f.required}
                  />
                ) : f.type === 'select' ? (
                  <select
                    className="form-select"
                    value={values[f.id] || ''}
                    onChange={e => handleFieldChange(f.id, e.target.value)}
                    required={f.required}
                  >
                    <option value="">Seçiniz...</option>
                    {f.options?.split(',').map((opt: string) => (
                      <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    className="form-input"
                    value={values[f.id] || ''}
                    onChange={e => handleFieldChange(f.id, e.target.value)}
                    required={f.required}
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>

        {/* Documents */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <legend className="text-sm font-semibold text-gray-900 px-2 -ml-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">3</span>
            İstenen Belgeler
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {schemaDocs.map((d: any) => (
              <FileDropZone
                key={d.id}
                label={d.label}
                required={d.required}
                file={files[d.id] || null}
                onFile={file => handleFileChange(d.id, file)}
                onRemove={() => handleFileChange(d.id, null)}
              />
            ))}
          </div>
        </fieldset>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary px-8 py-3 w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><span className="spinner border-white/30 border-t-white w-5 h-5" /> Gönderiliyor...</>
            ) : (
              'Formu Gönder'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
