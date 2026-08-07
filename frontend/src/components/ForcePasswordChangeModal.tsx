import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import toast from 'react-hot-toast';

export default function ForcePasswordChangeModal() {
  const { user, updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user || !user.forcePasswordChange) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Şifreniz başarıyla güncellendi!');
      updateUser({ forcePasswordChange: false });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Şifre güncellenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-gray-100 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Güvenlik Uyarısı</h2>
          <p className="text-sm text-gray-500 mt-2">
            Hesabınızın güvenliği için, sisteme ilk girişinizde geçici şifrenizi değiştirmeniz zorunludur. Lütfen kendinize yeni bir şifre belirleyin.
          </p>
        </div>

        <div className="p-6 bg-gray-50/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Mevcut (Geçici) Şifreniz</label>
              <input
                type="password"
                required
                className="form-input"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Yeni Şifreniz</label>
              <input
                type="password"
                required
                className="form-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Yeni Şifreniz (Tekrar)</label>
              <input
                type="password"
                required
                className="form-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => logout()}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Çıkış Yap
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Güncelleniyor...' : 'Şifremi Güncelle ve Devam Et'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
