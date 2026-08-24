import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { announcementApi, studentApi } from '../api';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

function SidebarIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [studentProfile, setStudentProfile] = useState<any>(null);

  const profileId = user?.profileId;

  useEffect(() => {
    async function loadStudentInfo() {
      if (!profileId) return;
      try {
        const [profile, anns] = await Promise.all([
          studentApi.getProfile(profileId).catch(() => null),
          announcementApi.getStudentAnnouncements(profileId).catch(() => []),
        ]);

        if (profile) {
          setStudentProfile(profile);
        }

        // Calculate unread announcements
        const readIds: string[] = JSON.parse(localStorage.getItem('read_announcements') || '[]');
        const unread = anns.filter(a => !readIds.includes(a.id)).length;
        setUnreadAnnouncementsCount(unread);
      } catch (err) {
        console.error(err);
      }
    }

    loadStudentInfo();

    const handleRead = () => {
      setUnreadAnnouncementsCount(0);
    };
    window.addEventListener('announcements_read', handleRead);
    return () => window.removeEventListener('announcements_read', handleRead);
  }, [profileId, location.pathname]);

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const NAV_ITEMS: NavItem[] = [
    {
      to: '/student/dashboard',
      label: 'Ana Sayfa',
      icon: <SidebarIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />,
    },
    {
      to: '/student/profile',
      label: 'Profil Bilgilerim',
      icon: <SidebarIcon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
    },
    {
      to: '/student/documents',
      label: 'Belge Merkezi',
      icon: <SidebarIcon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />,
    },
    {
      to: '/student/announcements',
      label: 'Duyurular',
      icon: <SidebarIcon path="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
      badge: unreadAnnouncementsCount > 0 ? unreadAnnouncementsCount : undefined,
    },
    {
      to: '/student/mentor',
      label: 'Mentörüm',
      icon: <SidebarIcon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />,
    },
    {
      to: '/student/volunteer-form',
      label: 'Gönüllülük Formu',
      icon: <SidebarIcon path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* ── Mobile Header ───────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/70 z-30 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100/80"
            aria-label="Menüyü Aç"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <img src="/logo.png" alt="Logo" className="h-7 object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {unreadAnnouncementsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-600 text-white">
              {unreadAnnouncementsCount} Yeni
            </span>
          )}
        </div>
      </div>

      {/* ── Mobile Backdrop ─────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-xs z-40 animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`w-56 bg-white/60 backdrop-blur-2xl border-r border-white/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Section */}
        <div className="px-4 h-[72px] flex items-center gap-2 border-b border-white/50 bg-white/30 backdrop-blur-md overflow-hidden">
          <div className="h-8 flex items-center flex-shrink-0 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
            <img src="/logo.png" alt="Logo" className="h-full object-contain drop-shadow-sm" />
          </div>
          <div className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center justify-center leading-tight tracking-wide whitespace-normal break-words">
            ÖĞRENCİ PANELİ
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <NavLink
            to="/student/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[13px] font-bold ${
                isActive 
                  ? 'text-primary-700 bg-white/50 shadow-sm border border-white/60' 
                  : 'text-slate-600 hover:text-primary-600 hover:bg-white/40 border border-transparent'
              }`
            }
          >
            <span className="w-[18px] h-[18px] flex-shrink-0">
              <SidebarIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
            </span>
            <span>Ana Sayfa</span>
          </NavLink>

          <div className="pt-3 mt-3 border-t border-white/50 space-y-1">
            {NAV_ITEMS.slice(1).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-[13px] font-bold ${
                    isActive 
                      ? 'text-primary-700 bg-white/50 shadow-sm border border-white/60' 
                      : 'text-slate-600 hover:text-primary-600 hover:bg-white/40 border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <span className={`w-[18px] h-[18px] flex-shrink-0 ${location.pathname.startsWith(item.to) ? 'text-primary-600' : 'text-slate-400'}`}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="bg-primary-500 text-white shadow-sm border border-primary-400 text-[10px] font-extrabold px-2 py-0.5 rounded-xl">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Bottom User Profile Section */}
        <div className="border-t border-white/50 p-5 space-y-3 bg-white/30 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/80 border border-white flex items-center justify-center text-primary-700 font-bold text-base flex-shrink-0 overflow-hidden shadow-sm">
              {studentProfile?.photoPath ? (
                <img src={`/${studentProfile.photoPath}`} alt={studentProfile.firstName} className="w-full h-full object-cover" />
              ) : studentProfile ? (
                <img 
                  src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${studentProfile.user?.tcKimlikNo || studentProfile.id}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                (user?.username || 'B')[0].toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-[13px] font-bold text-slate-800 truncate tracking-tight">
                {studentProfile ? `${studentProfile.firstName} ${studentProfile.lastName}` : (user?.username || 'Bursiyer')}
              </div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Bursiyer Öğrenci
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="w-full py-2 px-4 rounded-xl border border-white/60 bg-white/40 hover:bg-white/60 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Şifre Değiştir
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 rounded-xl border border-red-100/50 bg-red-50/70 hover:bg-red-100/80 text-xs font-bold text-red-600 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Güvenli Çıkış
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <main className="flex-1 lg:ml-56 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
