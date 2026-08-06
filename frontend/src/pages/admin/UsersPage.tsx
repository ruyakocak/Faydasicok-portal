import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';

interface UserItem {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', username: '', password: '', role: 'REVIEWER' });
  const [creating, setCreating] = useState(false);

  async function load() {
    const data = await adminApi.listUsers();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await adminApi.createUser(form);
      toast.success('Kullanıcı oluşturuldu.');
      setShowCreate(false);
      setForm({ email: '', username: '', password: '', role: 'REVIEWER' });
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`"${email}" kullanıcısını devre dışı bırakmak istiyor musunuz?`)) return;
    await adminApi.deleteUser(id);
    toast.success('Kullanıcı devre dışı bırakıldı.');
    load();
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Kullanıcı Yönetimi</h1>
          <p className="page-subtitle">Admin ve değerlendirici hesapları</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Kullanıcı
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="spinner border-gray-300 border-t-primary-500 w-7 h-7" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad / Kullanıcı Adı</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Oluşturulma</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className="font-medium">{user.username || '—'}</td>
                  <td className="text-gray-600">{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === 'ADMIN' ? 'badge-primary' : 'badge-gray'}`}>
                      {user.role === 'ADMIN' ? 'Yönetici' : 'Değerlendirici'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.isActive ? 'badge-approved' : 'badge-gray'}`}>
                      {user.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td>
                    {user.isActive && (
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        className="btn-ghost btn-sm text-status-rejected hover:bg-status-rejected-bg"
                      >
                        Devre Dışı Bırak
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-sm">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold">Yeni Kullanıcı Oluştur</h3>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="form-label">Rol</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="REVIEWER">Değerlendirici</option>
                  <option value="ADMIN">Yönetici</option>
                </select>
              </div>
              <div>
                <label className="form-label">E-posta</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Kullanıcı Adı (opsiyonel)</label>
                <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Şifre</label>
                <input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>
                  {creating ? <span className="spinner border-white/30 border-t-white w-4 h-4" /> : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
