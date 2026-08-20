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
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar */}
      <aside className="w-56 bg-white/70 backdrop-blur-xl border-r border-slate-200/70 shadow-sm flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Logo */}
        <div className="px-3.5 h-14 flex items-center justify-between border-b border-slate-200/70 bg-white/40 backdrop-blur-md">
          <div className="h-7 flex items-center flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="h-full object-contain" />
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase text-right leading-tight tracking-wider">
            Yönetim<br/>Paneli
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto">
          {/* Dashboard Direct Link */}
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `nav-item font-semibold text-xs ${isActive ? 'nav-item-active' : 'text-gray-700 hover:bg-gray-100/80'}`
            }
          >
            <span className="w-4 h-4 flex-shrink-0">
              <SidebarIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
            </span>
            <span>Ana Sayfa</span>
          </NavLink>

          <div className="pt-2 border-t border-gray-200/60 space-y-1">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'ADMIN');
              if (visibleItems.length === 0) return null;

              const isGroupActive = visibleItems.some(item => location.pathname.startsWith(item.to));
              const isOpen = !!openGroups[group.id];

              return (
                <div key={group.id} className="rounded-xl overflow-hidden transition-all">
                  {/* Collapsible Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all select-none ${
                      isGroupActive
                        ? 'text-primary-700 bg-primary-50/70 hover:bg-primary-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 flex-shrink-0 ${isGroupActive ? 'text-primary-600' : 'text-gray-400'}`}>
                        {group.icon}
                      </span>
                      <span>{group.title}</span>
                    </div>

                    <svg
                      viewBox="0 0 24 24"
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gray-600' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* Sub-items (collapsible container) */}
                  {isOpen && (
                    <div className="pl-2 pr-1 py-1 space-y-0.5 border-l-2 border-primary-200 ml-3.5 mt-0.5 animate-fade-in">
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                              isActive
                                ? 'bg-primary-50 text-primary-700 hover:text-primary-800 font-bold border border-primary-100 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100 font-medium'
                            }`
                          }
                        >
                          <span className="w-3.5 h-3.5 flex-shrink-0 opacity-90">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
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
        <div className="border-t border-gray-200/80 p-3 space-y-1 bg-white/40">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm flex-shrink-0">
              {(user?.username || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user?.username || user?.email || 'Admin'}
              </div>
              <div className="text-xs text-gray-500">
                {user?.role === 'ADMIN' ? 'Yönetici' : 'Değerlendirici'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="btn-ghost btn-sm w-full justify-start text-gray-600 text-xs"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z" />
            </svg>
            Şifre Değiştir
          </button>
          <button
            onClick={handleLogout}
            className="btn-ghost btn-sm w-full justify-start text-gray-600 text-xs"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-56 min-w-0 overflow-y-auto">
        <div className="p-6 max-w-full">
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
