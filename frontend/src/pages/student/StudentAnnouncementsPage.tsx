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
    <div className="max-w-[1200px] mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      
      {/* ── 1. Clean Header ──────────────────────────────────── */}
      <section className="relative pt-10 pb-8 border-b border-gray-200/60 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <Link to="/student" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-600 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Ana Sayfaya Dön
          </Link>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Duyurular
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Sizin için yayınlanan en güncel duyurular ve haberler.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        {announcements.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg tracking-tight">Henüz duyuru bulunmuyor</h3>
            <p className="text-gray-500 font-medium mt-1">Yeni bir duyuru olduğunda burada listelenecektir.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {announcements.map(ann => (
              <div 
                key={ann.id} 
                onClick={() => setSelectedAnn(ann)}
                className="group cursor-pointer p-6 md:p-8 rounded-3xl bg-white border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:border-gray-300 transition-all duration-300 flex flex-col"
              >
                <div className="flex justify-between items-start gap-4 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 shrink-0 border border-gray-100">
                    {format(new Date(ann.createdAt), 'dd MMM yyyy', { locale: tr })}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-black transition-colors line-clamp-2 tracking-tight leading-tight mb-3">
                  {ann.title}
                </h2>
                <div className="text-gray-500 font-medium line-clamp-3 leading-relaxed text-sm">
                  {ann.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Modal ─────────────────────────────── */}
      {selectedAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-200/60 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-10 border-b border-gray-100 flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2 block">
                  {format(new Date(selectedAnn.createdAt), 'dd MMMM yyyy, HH:mm', { locale: tr })}
                </span>
                <h3 className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight">{selectedAnn.title}</h3>
              </div>
              <button onClick={() => setSelectedAnn(null)} className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-8 md:p-10 max-h-[60vh] overflow-y-auto">
              <div className="text-gray-600 leading-relaxed whitespace-pre-wrap font-medium">
                {selectedAnn.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
