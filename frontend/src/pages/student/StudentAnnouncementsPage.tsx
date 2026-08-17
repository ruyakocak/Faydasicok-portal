import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { announcementApi } from '../../api';
import type { Announcement } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function StudentAnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);

  useEffect(() => {
    if (user?.profileId) {
      loadAnnouncements(user.profileId);
    }
  }, [user?.profileId]);

  async function loadAnnouncements(profileId: string) {
    try {
      const anns = await announcementApi.getStudentAnnouncements(profileId);
      setAnnouncements(anns);
      
      // Mark all as read
      const readIds = anns.map(a => a.id);
      localStorage.setItem('read_announcements', JSON.stringify(readIds));
      
      // Dispatch a custom event to update the layout counter if necessary
      window.dispatchEvent(new Event('announcements_read'));
    } catch (err: any) {
      toast.error('Duyurular yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div>
        <Link to="/student" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary-600 transition-colors mb-4">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Ana Sayfaya Dön
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          Duyurular
        </h1>
        <p className="text-sm text-gray-500 mt-1">Sizin için yayınlanan en güncel duyurular.</p>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="card p-10 text-center flex flex-col items-center justify-center">
             <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </div>
            <h3 className="font-semibold text-gray-900">Henüz duyuru bulunmuyor</h3>
            <p className="text-sm text-gray-500 mt-1">Yeni bir duyuru olduğunda burada listelenecektir.</p>
          </div>
        ) : (
          announcements.map(ann => (
            <div 
              key={ann.id} 
              className="card p-6 border border-gray-150 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
              onClick={() => setSelectedAnn(ann)}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-500" />
              <div className="pl-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-primary-700 transition-colors break-words line-clamp-1">{ann.title}</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {format(new Date(ann.createdAt), 'dd MMMM yyyy', { locale: tr })}
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-600 line-clamp-3 break-words">
                  {ann.content.split('\n').map((paragraph, idx) => (
                    <p key={idx} className={idx > 0 ? 'mt-2' : ''}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-3 text-xs font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Devamını oku →
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {selectedAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 break-words pr-4">{selectedAnn.title}</h3>
              <button 
                onClick={() => setSelectedAnn(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-4 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {format(new Date(selectedAnn.createdAt), 'dd MMMM yyyy, HH:mm', { locale: tr })}
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 break-words whitespace-pre-wrap">
                {selectedAnn.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
