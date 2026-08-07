import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mentorshipApi } from '../../api';
import toast from 'react-hot-toast';

export default function MentorStudentDetailPage() {
  const { id } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      mentorshipApi.getProfile(), // We can filter the matched students
      mentorshipApi.getNotes(id)
    ])
      .then(([profileRes, notesRes]) => {
        const found = profileRes.students?.find((s: any) => s.id === id);
        if (found) setStudent(found);
        setNotes(notesRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    setSubmitting(true);
    try {
      const created = await mentorshipApi.createNote(newNote, id);
      setNotes([...notes, created]);
      setNewNote('');
      toast.success('Not eklendi.');
    } catch (err: any) {
      toast.error('Not eklenirken hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center mt-10"><span className="spinner border-primary-500 border-t-transparent w-8 h-8"></span></div>;
  }

  if (!student) {
    return <div className="text-center mt-10 text-gray-500">Öğrenci bulunamadı.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/mentor/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-2 inline-flex items-center gap-1">
          &larr; Öğrencilerime Dön
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">{student.firstName} {student.lastName}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Öğrenci Bilgileri</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-gray-500 font-medium">E-posta</dt>
                <dd className="text-gray-900 mt-1">{student.user?.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium">Telefon</dt>
                <dd className="text-gray-900 mt-1">{student.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium">Üniversite</dt>
                <dd className="text-gray-900 mt-1">{student.universityName || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium">Bölüm</dt>
                <dd className="text-gray-900 mt-1">{student.department || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium">Sınıf</dt>
                <dd className="text-gray-900 mt-1">{student.grade || '-'}</dd>
              </div>
            </dl>
            
            <div className="mt-6 pt-6 border-t border-gray-100">
              <a href={`mailto:${student.user?.email}`} className="btn-primary w-full justify-center flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                E-posta Gönder
              </a>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card bg-white p-6 rounded-lg border border-gray-200 h-full flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Görüşme Notları</h3>
            
            <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-4 min-h-[300px]">
              {notes.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">Henüz not eklenmemiş.</div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm text-gray-900">
                        {note.createdBy?.role === 'MENTOR' ? 'Siz' : (note.createdBy?.username || 'Yetkili')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(note.createdAt).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.noteText}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddNote} className="mt-auto border-t border-gray-100 pt-4">
              <label htmlFor="note" className="sr-only">Yeni Not</label>
              <textarea
                id="note"
                rows={3}
                className="form-input mb-3"
                placeholder="Öğrenci hakkında görüşme notlarınızı buraya yazabilirsiniz..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !newNote.trim()}
                  className="btn-primary"
                >
                  {submitting ? 'Ekleniyor...' : 'Not Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
