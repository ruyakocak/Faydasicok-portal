import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { MentorProfile, StudentProfile } from '../../types';
import toast from 'react-hot-toast';

export default function MentorsPage() {
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingMentorId, setEditingMentorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Assign Student states
  const [assigningMentor, setAssigningMentor] = useState<MentorProfile | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [viewingStudentsFor, setViewingStudentsFor] = useState<MentorProfile | null>(null);
  const [deletingMentorId, setDeletingMentorId] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.listMentors();
      setMentors(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreateModal() {
    setEditingMentorId(null);
    setFirstName('');
    setLastName('');
    setTitle('');
    setCompany('');
    setPhone('');
    setEmail('');
    setFile(null);
    setShowModal(true);
  }

  function openEditModal(mentor: MentorProfile) {
    setEditingMentorId(mentor.id);
    setFirstName(mentor.firstName);
    setLastName(mentor.lastName);
    setTitle(mentor.title || '');
    setCompany(mentor.company || '');
    setPhone(mentor.phone || '');
    setEmail(mentor.email || '');
    setFile(null); // Photo file needs to be re-uploaded if changing
    setShowModal(true);
  }

  async function openAssignModal(mentor: MentorProfile) {
    setAssigningMentor(mentor);
    setSelectedStudentId('');
    if (students.length === 0) {
      setStudentsLoading(true);
      try {
        const res = await adminApi.listStudents({ limit: '2000' });
        // Filter out students who already have this mentor? The backend just overwrites, so we can list all.
        setStudents(res.data);
      } catch {
        toast.error('Öğrenciler yüklenemedi.');
      } finally {
        setStudentsLoading(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) {
      toast.error('Ad ve soyad zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (title) fd.append('title', title);
      if (company) fd.append('company', company);
      if (phone) fd.append('phone', phone);
      if (email) fd.append('email', email);
      if (file) fd.append('file', file);

      if (editingMentorId) {
        await adminApi.updateMentor(editingMentorId, fd);
        toast.success('Mentör bilgileri güncellendi.');
      } else {
        await adminApi.createMentor(fd);
        toast.success('Mentör başarıyla oluşturuldu.');
      }
      
      setShowModal(false);
      load();
    } catch (err) {
      // handled by interceptor
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningMentor || !selectedStudentId) return;
    setAssignSubmitting(true);
    try {
      await adminApi.assignMentor(selectedStudentId, assigningMentor.id);
      toast.success('Öğrenci mentöre başarıyla atandı.');
      setAssigningMentor(null);
      load(); 
    } catch {
      // Handled by interceptor
    } finally {
      setAssignSubmitting(false);
    }
  }

  async function executeDelete() {
    if (!deletingMentorId) return;
    try {
      await adminApi.deleteMentor(deletingMentorId);
      toast.success('Mentör silindi.');
      setDeletingMentorId(null);
      load();
    } catch (e) {
      // Error handled by interceptor
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Mentör Yönetimi</h1>
          <p className="page-subtitle">Bursiyerler için mentörleri ekleyin ve düzenleyin</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Mentör Ekle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
        </div>
      ) : mentors.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Henüz eklenmiş bir mentör bulunmamaktadır.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mentors.map(mentor => (
            <div key={mentor.id} className="card flex flex-col justify-between overflow-hidden relative group">
              <div className="card-body">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-primary-100">
                    {mentor.photoPath ? (
                      <img src={`/${mentor.photoPath}`} alt={`${mentor.firstName} ${mentor.lastName}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 font-bold text-xl uppercase">
                        {mentor.firstName[0]}{mentor.lastName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg leading-snug">
                      {mentor.firstName} {mentor.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {mentor.title || 'Mentör'}
                      {mentor.company ? ` @ ${mentor.company}` : ''}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 pt-2 border-t border-gray-100">
                  {mentor.email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      <span className="truncate">{mentor.email}</span>
                    </div>
                  )}
                  {mentor.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      <span>{mentor.phone}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => setViewingStudentsFor(mentor)}
                    className="flex items-center gap-2 text-xs text-primary-600 bg-primary-50 rounded-full px-2.5 py-1 w-fit mt-2 font-medium hover:bg-primary-100 transition-colors"
                  >
                    <span>Atanmış Bursiyer: {mentor.students?.length ?? mentor._count?.students ?? 0}</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 flex justify-between gap-3 border-t border-gray-100">
                <button
                  onClick={() => openAssignModal(mentor)}
                  className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                  Öğrenci Ata
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => openEditModal(mentor)}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button
                    onClick={() => setDeletingMentorId(mentor.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMentorId ? 'Mentör Bilgilerini Güncelle' : 'Yeni Mentör Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Ad *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Soyad *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Ünvan / Görev</label>
                  <input
                    type="text"
                    placeholder="Örn: Yazılım Mühendisi"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Çalıştığı Şirket</label>
                  <input
                    type="text"
                    placeholder="Örn: Google"
                    className="form-input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">E-posta</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Telefon Numarası</label>
                  <input
                    type="tel"
                    placeholder="05xxxxxxxxx"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Profil Fotoğrafı {editingMentorId && '(Değiştirmek için seçin)'}</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assign Student Modal */}
      {assigningMentor && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">
                Mentöre Öğrenci Ata
              </h2>
              <button onClick={() => setAssigningMentor(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 bg-primary-50 p-3 rounded-lg border border-primary-100">
                 <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {assigningMentor.photoPath ? (
                      <img src={`/${assigningMentor.photoPath}`} alt="Mentor" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-200 text-primary-700 font-bold uppercase">
                        {assigningMentor.firstName[0]}{assigningMentor.lastName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary-900 text-sm">
                      {assigningMentor.firstName} {assigningMentor.lastName}
                    </h3>
                    <p className="text-xs text-primary-700">Bu mentöre atanacak öğrenciyi seçin.</p>
                  </div>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Öğrenci Seçin</label>
                  {studentsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <span className="spinner w-4 h-4 border-gray-300 border-t-primary-500" />
                      Öğrenciler yükleniyor...
                    </div>
                  ) : (
                    <select
                      required
                      className="form-select w-full"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                    >
                      <option value="" disabled>-- Bir öğrenci seçin --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} {s.universityName ? `(${s.universityName})` : ''} 
                          {s.mentorId === assigningMentor.id ? ' (Zaten Atanmış)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setAssigningMentor(null)}
                    className="btn-secondary"
                    disabled={assignSubmitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={assignSubmitting || studentsLoading || !selectedStudentId}
                  >
                    {assignSubmitting ? 'Atanıyor...' : 'Ata'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* View Students Modal */}
      {viewingStudentsFor && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">
                Atanmış Öğrenciler
              </h2>
              <button onClick={() => setViewingStudentsFor(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                 <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {viewingStudentsFor.photoPath ? (
                      <img src={`/${viewingStudentsFor.photoPath}`} alt="Mentor" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 font-bold uppercase">
                        {viewingStudentsFor.firstName[0]}{viewingStudentsFor.lastName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {viewingStudentsFor.firstName} {viewingStudentsFor.lastName}
                    </h3>
                    <p className="text-xs text-gray-500">Mentörün öğrencileri listeleniyor.</p>
                  </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {viewingStudentsFor.students && viewingStudentsFor.students.length > 0 ? (
                  viewingStudentsFor.students.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.firstName} {s.lastName}</p>
                        {s.universityName && <p className="text-xs text-gray-500">{s.universityName}</p>}
                      </div>
                      <button 
                        onClick={async () => {
                          if (!window.confirm(`${s.firstName} ${s.lastName} adlı öğrencinin mentör atamasını kaldırmak istediğinizden emin misiniz?`)) return;
                          try {
                            await adminApi.assignMentor(s.id, null);
                            toast.success('Öğrenci ataması kaldırıldı.');
                            setViewingStudentsFor(null);
                            load();
                          } catch {}
                        }}
                        className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        Kaldır
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-gray-500 py-4">Bu mentöre atanmış herhangi bir öğrenci bulunmuyor.</p>
                )}
              </div>

              <div className="flex justify-end pt-4 mt-2 border-t border-gray-100">
                <button onClick={() => setViewingStudentsFor(null)} className="btn-secondary">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deletingMentorId && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Mentörü Sil</h3>
              <p className="text-sm text-gray-500 mb-6">
                Bu mentörü silmek istediğinizden emin misiniz? Mentör silindiğinde, mentöre atanmış tüm öğrencilerin ataması otomatik olarak kaldırılacaktır. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeletingMentorId(null)}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  onClick={executeDelete}
                  className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 flex-1"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
