import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) return;
    try {
      await login(identifier.trim(), password.trim());
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role === 'STUDENT') {
        navigate('/student/profile');
      } else if (user.role === 'MENTOR') {
        navigate('/mentor/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
      toast.success('Hoş geldiniz!');
    } catch (err: any) {
      if (err.response) {
        const msg = err.response.data?.error || 'Kullanıcı adı veya şifre hatalı.';
        toast.error(msg);
      }
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-hidden">
      {/* Left Column: Visual Banner (Wider 62% layout for horizontal image) */}
      <div className="hidden md:flex md:w-[62%] relative bg-gray-950 flex-col justify-end py-12 pr-12 pl-20 text-white overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/login_banner.webp"
            alt="Giriş Görseli"
            className="w-full h-full object-cover"
          />
          {/* Very light dark gradient overlay at the bottom for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end h-full">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white drop-shadow-md">
              Geleceğe İz Bırakın, Hayallerinizi İnşa Edin
            </h1>
          </div>
        </div>
      </div>

      {/* Right Column: Login Form (38% width) */}
      <div className="w-full md:w-[38%] flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-gray-50/50">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo on mobile only */}
          <div className="md:hidden mb-8 text-center">
            <img src="/logo.png" alt="Logo" className="h-16 mx-auto object-contain mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Faydasıçok Vakfı</h2>
            <p className="text-xs text-gray-500 mt-1">Bursiyer Yönetim Sistemi</p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-150 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Giriş Yap</h2>
            <p className="text-sm text-gray-500 mb-6">Sisteme erişmek için bilgilerinizi girin.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="identifier" className="form-label text-xs font-semibold text-gray-700">
                  Kullanıcı Adı / TC Kimlik No
                </label>
                <input
                  id="identifier"
                  type="text"
                  className="form-input rounded-xl border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="TC Kimlik No veya e-posta"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="form-label text-xs font-semibold text-gray-700 mb-0">
                    Şifre
                  </label>
                  <Link to="/forgot-password" className="text-xs text-primary-500 hover:text-primary-600 font-semibold">
                    Şifremi unuttum
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  className="form-input rounded-xl border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-2.5 rounded-xl font-semibold shadow-sm transition-all hover:bg-primary-700 flex items-center justify-center gap-2 mt-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="spinner border-white/30 border-t-white w-4 h-4" />
                ) : (
                  <>
                    <span>Giriş Yap</span>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="md:hidden text-center text-xs text-gray-400 mt-8">
            © {new Date().getFullYear()} Faydasıçok Vakfı — Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </div>
  );
}
