import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { announcementApi } from '../api';

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.profileId) {
      loadUnreadCount();
      // Listen for custom event when announcements are read
      const handleRead = () => setUnreadCount(0);
      window.addEventListener('announcements_read', handleRead);
      return () => window.removeEventListener('announcements_read', handleRead);
    }
  }, [user?.profileId]);

  // If user visits announcements page directly, clear the unread count
  useEffect(() => {
    if (location.pathname === '/student/announcements') {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  async function loadUnreadCount() {
    try {
      if (!user?.profileId) return;
      const anns = await announcementApi.getStudentAnnouncements(user.profileId);
      const readIds = JSON.parse(localStorage.getItem('read_announcements') || '[]');
      const unread = anns.filter(a => !readIds.includes(a.id)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 flex items-center flex-shrink-0 cursor-pointer" onClick={() => navigate('/student/profile')}>
              <img src="/logo.png" alt="Logo" className="h-full object-contain" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student/events')}
              className={`text-sm flex items-center gap-1.5 relative ${location.pathname === '/student/events' ? 'text-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <svg viewBox="0 0 24 24" className={`w-4 h-4 ${location.pathname === '/student/events' ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Eğitim ve Etkinlikler
            </button>
            <button
              onClick={() => navigate('/student/announcements')}
              className={`text-sm flex items-center gap-1.5 relative ${location.pathname === '/student/announcements' ? 'text-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <svg viewBox="0 0 24 24" className={`w-4 h-4 ${location.pathname === '/student/announcements' ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              Duyurular
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold border border-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z" />
              </svg>
              Şifre Değiştir
            </button>
            <button
              onClick={handleLogout}
              className="btn-ghost btn-sm text-gray-600"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
