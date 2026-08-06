import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { authApi } from '../../api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { toast.error('Şifreler eşleşmiyor.'); return; }
    if (newPassword.length < 6) { toast.error('Şifre en az 6 karakter olmalı.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token!, newPassword);
      toast.success('Şifreniz güncellendi!');
      navigate('/login');
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-1">Yeni Şifre Belirle</h2>
          <p className="text-sm text-gray-500 mb-6">En az 6 karakterli bir şifre seçin.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Yeni Şifre</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="form-label">Şifre Tekrar</label>
              <input
                type="password"
                className="form-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <span className="spinner border-white/30 border-t-white" /> : 'Şifremi Güncelle'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">← Giriş sayfasına dön</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
