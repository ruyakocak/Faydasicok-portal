import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { MentorProfile } from '../../types';
import toast from 'react-hot-toast';

export default function MentorsPage() {
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) {
      toast.error('Ad ve soyad zorunludur.');
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (title) fd.append('title', title);
      if (company) fd.append('company', company);
      if (phone) fd.append('phone', phone);
      if (email) fd.append('email', email);
      if (file) fd.append('file', file);

      await adminApi.createMentor(fd);
      toast.success('Mentör başarıyla oluşturuldu.');
      setShowCreate(false);
      // Reset form
      setFirstName('');
      setLastName('');
      setTitle('');
      setCompany('');
      setPhone('');
      setEmail('');
      setFile(null);
      load();
    } catch (err) {
      // handled by interceptor
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Bu mentörü silmek istediğinizden emin misiniz? (Öğrencilerin mentör ataması kaldırılacaktır)')) return;
    try {
      await adminApi.deleteMentor(id);
      toast.success('Mentör silindi.');
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
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
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
                  <div className="flex items-center gap-2 text-xs text-primary-600 bg-primary-50 rounded-full px-2.5 py-1 w-fit mt-2 font-medium">
                    <span>Atanmış Bursiyer: {mentor._count?.students ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 flex justify-end border-t border-gray-100">
                <button
                  onClick={() => handleDelete(mentor.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md w-full">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Mentör Ekle</h2>
              <button onClick={() => setShowCreate(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
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
                <label className="form-label">Profil Fotoğrafı</label>
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
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary"
                  disabled={creating}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
