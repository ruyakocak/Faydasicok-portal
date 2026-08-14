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
      const msg = err.response?.data?.error || 'Kullanıcı adı veya şifre hatalı.';
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo + header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
          <img src="/logo.png" alt="Faydasıçok Vakfı Logo" className="max-w-full max-h-full object-contain" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Faydasıçok Vakfı</h1>
        <p className="text-sm text-gray-500 mt-1">Bursiyer Yönetim Sistemi</p>
      </div>

      {/* Login card */}
      <div className="card w-full max-w-sm">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Giriş Yap</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="form-label">
                Kullanıcı Adı / TC Kimlik No
              </label>
              <input
                id="identifier"
                type="text"
                className="form-input"
                placeholder="TC Kimlik No veya e-posta"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="form-label mb-0">Şifre</label>
                <Link to="/forgot-password" className="text-xs text-primary-500 hover:text-primary-600">
                  Şifremi unuttum
                </Link>
              </div>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="spinner border-white/30 border-t-white" />
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6">
        © {new Date().getFullYear()} Faydasıçok Vakfı — Tüm hakları saklıdır.
      </p>
    </div>
  );
}
