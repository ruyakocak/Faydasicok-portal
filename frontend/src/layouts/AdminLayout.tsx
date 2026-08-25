import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

function SidebarIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'people',
    title: 'Kişiler',
    icon: <SidebarIcon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />,
    items: [
      { to: '/admin/students', label: 'Bursiyerler', icon: <SidebarIcon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /> },
      { to: '/admin/graduates', label: 'Mezunlar', icon: <SidebarIcon path="M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5" /> },
      { to: '/admin/mentors', label: 'Mentör Yönetimi', icon: <SidebarIcon path="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />, adminOnly: true },
    ]
  },
  {
    id: 'processes',
    title: 'Süreç & İletişim',
    icon: <SidebarIcon path="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
    items: [
      { to: '/admin/documents', label: 'Belge Yönetimi', icon: <SidebarIcon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" /> },
      { to: '/admin/volunteer-forms', label: 'STK Raporları', icon: <SidebarIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { to: '/admin/events', label: 'Eğitim & Etkinlikler', icon: <SidebarIcon path="M19 4h-1V3c0-.55-.45-1-1-1s-1 .45-1 1v1H8V3c0-.55-.45-1-1-1s-1 .45-1 1v1H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" />, adminOnly: true },
      { to: '/admin/announcements', label: 'Duyurular', icon: <SidebarIcon path="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />, adminOnly: true },
    ]
  },
  {
    id: 'system',
    title: 'Sistem',
    icon: <SidebarIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
    items: [
      { to: '/admin/users', label: 'Kullanıcı Yönetimi', icon: <SidebarIcon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />, adminOnly: true },
      { to: '/admin/audit-logs', label: 'Değişiklik Geçmişi', icon: <SidebarIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { to: '/admin/settings', label: 'Sistem Ayarları', icon: <SidebarIcon path="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />, adminOnly: true },
    ]
  }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Track expanded groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    people: true,
    processes: false,
    system: false,
  });

  // Automatically expand group containing active route on route change
  useEffect(() => {
    NAV_GROUPS.forEach(group => {
      const isInside = group.items.some(item => location.pathname.startsWith(item.to));
      if (isInside) {
        setOpenGroups(prev => ({ ...prev, [group.id]: true }));
      }
    });
  }, [location.pathname]);

  function toggleGroup(groupId: string) {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-50 bg-gradient-to-br from-indigo-50/30 via-slate-50 to-rose-50/30">
      {/* Sidebar */}
      {/* Sidebar */}
      <aside className={`w-56 bg-white/60 backdrop-blur-2xl border-r border-white/50 flex flex-col fixed inset-y-0 left-0 z-40 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-transform duration-200 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex flex-col items-center justify-center px-4 pt-4 pb-3 border-b border-white/50 bg-white/30 backdrop-blur-md overflow-hidden">
          <div className="h-10 w-auto flex-shrink-0 flex items-center justify-center cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
            <img src="/logo.png" alt="Logo" className="h-full w-auto object-contain drop-shadow-sm" />
          </div>
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase mt-2.5 whitespace-nowrap text-center">
            YÖNETİM PANELİ
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {/* Dashboard Direct Link */}
          <NavLink
            to="/admin/dashboard"
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
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'ADMIN');
              if (visibleItems.length === 0) return null;

              const isGroupActive = visibleItems.some(item => location.pathname.startsWith(item.to));
              const isOpen = !!openGroups[group.id];

              return (
                <div key={group.id} className="transition-all">
                  {/* Collapsible Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all select-none ${
                      isGroupActive
                        ? 'text-primary-700 bg-white/50 shadow-sm border border-white/60'
                        : 'text-slate-600 hover:text-primary-600 hover:bg-white/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-[18px] h-[18px] flex-shrink-0 ${isGroupActive ? 'text-primary-600' : 'text-slate-400'}`}>
                        {group.icon}
                      </span>
                      <span>{group.title}</span>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* Sub-items (collapsible container) */}
                  {isOpen && (
                    <div className="pl-3 py-1.5 space-y-1 mt-1 border-l-2 border-slate-300/40 ml-6">
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                              isActive
                                ? 'text-primary-700 font-bold bg-white/60 shadow-sm border border-white/60'
                                : 'text-slate-500 hover:text-primary-600 hover:bg-white/40 border border-transparent'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom user area */}
        <div className="border-t border-white/50 p-5 space-y-3 bg-white/30 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/80 border border-white flex items-center justify-center text-primary-700 font-bold text-base flex-shrink-0 shadow-sm">
              {(user?.username || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-[13px] font-bold text-slate-800 truncate tracking-tight">
                {user?.username || user?.email || 'Kullanıcı'}
              </div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                {user?.role === 'ADMIN' ? 'Yönetici' : 'Değerlendirici'}
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

      {/* Main Content */}
      <main className="flex-1 lg:ml-56 flex flex-col min-w-0 bg-[#FAFAFA] min-h-screen pt-14 lg:pt-0">
        <div className="flex-1 p-6 md:p-8 lg:p-10 w-full">
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
