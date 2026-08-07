import { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';

export default function MentorLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 flex items-center flex-shrink-0">
              <img src="/logo.png" alt="Logo" className="h-full object-contain" />
            </div>
            <span className="text-sm font-semibold text-gray-900 border-l border-gray-300 pl-3 ml-1">
              Mentör Paneli
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link 
              to="/mentor/dashboard" 
              className={`text-sm font-medium ${location.pathname.includes('/dashboard') ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Öğrencilerim
            </Link>
          </div>

          <div className="flex items-center gap-4">
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

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
        <Outlet />
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
