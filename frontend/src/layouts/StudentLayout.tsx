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
      <aside
        className={`w-56 bg-white/75 backdrop-blur-xl border-r border-slate-200/70 shadow-sm flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Section */}
        <div className="px-3.5 h-14 flex items-center justify-between border-b border-slate-200/70 bg-white/40 backdrop-blur-md">
          <div className="h-7 flex items-center flex-shrink-0 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
            <img src="/logo.png" alt="Logo" className="h-full object-contain" />
          </div>
          <div className="text-[10px] font-bold text-primary-600 uppercase text-right leading-tight tracking-wider bg-primary-50/80 px-2 py-1 rounded-lg border border-primary-100">
            Bursiyer<br/>Portalı
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Menü
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item justify-between group ${isActive ? 'nav-item-active font-bold' : 'text-gray-600 hover:text-gray-900 font-medium'}`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 flex-shrink-0 text-current">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary-500 text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom User Profile Section */}
        <div className="border-t border-slate-200/70 p-3 bg-white/40 backdrop-blur-md space-y-1.5">
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0 shadow-sm border border-gray-200 overflow-hidden">
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
              <div className="text-xs font-bold text-gray-900 truncate tracking-tight">
                {studentProfile ? `${studentProfile.firstName} ${studentProfile.lastName}` : (user?.username || 'Bursiyer')}
              </div>
              <div className="text-[10px] text-gray-500 font-medium truncate uppercase tracking-wider">
                Bursiyer Öğrenci
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="btn-ghost btn-sm w-full justify-start text-gray-600 text-xs gap-2 py-1.5"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z" />
            </svg>
            Şifre Değiştir
          </button>

          <button
            onClick={handleLogout}
            className="btn-ghost btn-sm w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs gap-2 py-1.5"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
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
