import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Mail, Save, Send, ShieldCheck, Server, User as UserIcon, Key } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '',
    user: '',
    pass: '',
    from: '',
    secure: false,
  });

  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getSmtpSettings();
      if (data) {
        setSmtpSettings(data);
      }
    } catch (error: any) {
      toast.error('Ayarlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await adminApi.saveSmtpSettings(smtpSettings);
      toast.success('E-posta ayarları başarıyla kaydedildi.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error('Lütfen test için bir e-posta adresi girin.');
      return;
    }
    try {
      setTesting(true);
      const res = await adminApi.testSmtpSettings({ to: testEmail });
      toast.success(res.message || 'Test e-postası başarıyla gönderildi.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Test e-postası gönderilemedi.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">E-posta Ayarları (SMTP)</h1>
          <p className="text-gray-500 mt-1">
            Sistem üzerinden gidecek bildirim ve bilgilendirme e-postaları için SMTP sunucu ayarlarını buradan yapılandırabilirsiniz.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ayarlar Formu */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                SMTP Sunucu Bilgileri
              </h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Sunucu Adresi (Host)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Server className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="pl-10 w-full rounded-xl border-gray-300 shadow-sm focus:border-primary focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Port Numarası</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                      placeholder="465 veya 587"
                      className="w-full rounded-xl border-gray-300 shadow-sm focus:border-primary focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Kullanıcı E-postası (User)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                      placeholder="ornek@faydasicokvakfi.org"
                      className="pl-10 w-full rounded-xl border-gray-300 shadow-sm focus:border-primary focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Parola / Uygulama Şifresi (Pass)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={smtpSettings.pass}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                      placeholder="••••••••"
                      className="pl-10 w-full rounded-xl border-gray-300 shadow-sm focus:border-primary focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Gönderen İsmi (From)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={smtpSettings.from}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, from: e.target.value })}
                      placeholder="Faydasıçok Vakfı"
                      className="pl-10 w-full rounded-xl border-gray-300 shadow-sm focus:border-primary focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={smtpSettings.secure}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                      className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                        Güvenli Bağlantı (SSL/TLS)
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">Port 465 kullanıyorsanız genellikle işaretlenmelidir. (Port 587 için kapalı tutulabilir)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Test Paneli */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Bağlantı Testi
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Ayarlarınızı kaydettikten sonra, yapılandırmanızın doğru çalışıp çalışmadığını test edebilirsiniz.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Test Edilecek E-posta</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@ornek.com"
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="w-full flex justify-center items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50 font-medium border border-blue-200"
              >
                {testing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Test E-postası Gönder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
