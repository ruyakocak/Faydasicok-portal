import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Ana Sayfa', icon: <SidebarIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" /> },
  { to: '/admin/students', label: 'Bursiyerler', icon: <SidebarIcon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" /> },
  { to: '/admin/approvals', label: 'Onay Kuyruğu', icon: <SidebarIcon path="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
  { to: '/admin/periods', label: 'Dönem Yönetimi', icon: <SidebarIcon path="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, adminOnly: true },
  { to: '/admin/events', label: 'Eğitim & Etkinlikler', icon: <SidebarIcon path="M19 4h-1V3c0-.55-.45-1-1-1s-1 .45-1 1v1H8V3c0-.55-.45-1-1-1s-1 .45-1 1v1H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" />, adminOnly: true },
  { to: '/admin/audit-logs', label: 'Değişiklik Geçmişi', icon: <SidebarIcon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8M16 17H8M10 9H8" /> },
  { to: '/admin/users', label: 'Kullanıcı Yönetimi', icon: <SidebarIcon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" />, adminOnly: true },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Logo */}
        <div className="px-3 h-14 flex items-center justify-between border-b border-gray-200">
          <div className="h-7 flex items-center flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="h-full object-contain" />
          </div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase text-right leading-tight tracking-wider">
            Yönetim<br/>Paneli
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item-active' : ''}`
              }
            >
              <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user area */}
        <div className="border-t border-gray-200 p-3 space-y-1">
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
      <main className="flex-1 ml-56">
        <div className="p-6">
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
