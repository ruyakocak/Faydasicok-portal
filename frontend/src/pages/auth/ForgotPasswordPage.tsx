import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
      toast.success('Sıfırlama e-postası gönderildi.');
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-1">Şifre Sıfırlama</h2>
          <p className="text-sm text-gray-500 mb-6">
            E-posta adresinizi girin, sıfırlama bağlantısı göndereceğiz.
          </p>

          {sent ? (
            <div className="bg-status-approved-bg text-status-approved-text rounded p-4 text-sm">
              E-posta gönderildi! Gelen kutunuzu kontrol edin.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="form-label">E-posta</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="ornek@eposta.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <span className="spinner border-white/30 border-t-white" /> : 'Gönder'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
              ← Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
