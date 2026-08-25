import { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api';
import type { MentorProfile, StudentProfile } from '../../types';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────
interface MentorStats {
  totalMentors: number;
  activeMentors: number;
  totalAssignedStudents: number;
  totalCapacity: number;
  availableSlots: number;
  matchRate: number;
}

type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | 'no-students' | 'full' | 'active' | 'passive';

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({ title, value, icon, accent }: { title: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-5 flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight leading-none">{value}</div>
        <div className="text-xs font-semibold text-gray-500 mt-1 tracking-wide uppercase">{title}</div>
      </div>
    </div>
  );
}

// ── Avatar Stack ──────────────────────────────────────────────────────
function AvatarStack({ students, maxShow = 4 }: { students: MentorProfile['students']; maxShow?: number }) {
  if (!students || students.length === 0) {
    return <span className="text-xs text-gray-400 italic">Atanmış bursiyer yok</span>;
  }
  const shown = students.slice(0, maxShow);
  const remaining = students.length - maxShow;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((s) => (
          <div
            key={s.id}
            title={`${s.firstName} ${s.lastName}${s.universityName ? ` — ${s.universityName}` : ''}`}
            className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm"
          >
            {s.photoPath ? (
              <img src={`/${s.photoPath}`} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 text-[10px] font-bold uppercase">
                {s.firstName?.[0]}{s.lastName?.[0]}
              </div>
            )}
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <span className="ml-1.5 text-xs text-gray-500 font-semibold">+{remaining}</span>
      )}
    </div>
  );
}

// ── Capacity Bar ──────────────────────────────────────────────────────
function CapacityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const isFull = current >= max;
  const isNearFull = pct >= 75 && !isFull;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-600">{current}/{max} Bursiyer</span>
        <span className={`font-bold ${isFull ? 'text-red-600' : isNearFull ? 'text-amber-600' : 'text-emerald-600'}`}>
          {isFull ? 'Dolu' : `${pct}%`}
        </span>
      </div>
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : isNearFull ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function MentorsPage() {
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MentorStats | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingMentorId, setEditingMentorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [assigningMentor, setAssigningMentor] = useState<MentorProfile | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [viewingStudentsFor, setViewingStudentsFor] = useState<MentorProfile | null>(null);
  const [unassigningStudent, setUnassigningStudent] = useState<{ id: string, firstName: string, lastName: string } | null>(null);
  const [deletingMentorId, setDeletingMentorId] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('5');
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [mentorsData, statsData] = await Promise.all([
        adminApi.listMentors(),
        adminApi.getMentorStats(),
      ]);
      setMentors(mentorsData);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Filtering ───────────────────────────────────────────────────────
  const filteredMentors = useMemo(() => {
    let result = mentors;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        (m.company || '').toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    switch (statusFilter) {
      case 'no-students':
        result = result.filter(m => (m._count?.students ?? m.students?.length ?? 0) === 0);
        break;
      case 'full':
        result = result.filter(m => (m._count?.students ?? 0) >= m.maxCapacity);
        break;
      case 'active':
        result = result.filter(m => m.isActive);
        break;
      case 'passive':
        result = result.filter(m => !m.isActive);
        break;
    }

    return result;
  }, [mentors, searchQuery, statusFilter]);

  // ── Modal Handlers ──────────────────────────────────────────────────
  function openCreateModal() {
    setEditingMentorId(null);
    setFirstName(''); setLastName(''); setTitle(''); setCompany('');
    setPhone(''); setEmail(''); setMaxCapacity('5'); setIsActive(true); setFile(null);
    setShowModal(true);
  }

  function openEditModal(mentor: MentorProfile) {
    setEditingMentorId(mentor.id);
    setFirstName(mentor.firstName); setLastName(mentor.lastName);
    setTitle(mentor.title || ''); setCompany(mentor.company || '');
    setPhone(mentor.phone || ''); setEmail(mentor.email || '');
    setMaxCapacity(String(mentor.maxCapacity ?? 5));
    setIsActive(mentor.isActive ?? true);
    setFile(null);
    setShowModal(true);
  }

  async function openAssignModal(mentor: MentorProfile) {
    setAssigningMentor(mentor);
    setSelectedStudentId('');
    if (students.length === 0) {
      setStudentsLoading(true);
      try {
        const res = await adminApi.listStudents({ limit: '2000' });
        setStudents(res.data);
      } catch {
        toast.error('Öğrenciler yüklenemedi.');
      } finally {
        setStudentsLoading(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) { toast.error('Ad ve soyad zorunludur.'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (title) fd.append('title', title);
      if (company) fd.append('company', company);
      if (phone) fd.append('phone', phone);
      if (email) fd.append('email', email);
      fd.append('maxCapacity', maxCapacity);
      fd.append('isActive', String(isActive));
      if (file) fd.append('file', file);

      if (editingMentorId) {
        await adminApi.updateMentor(editingMentorId, fd);
        toast.success('Mentör bilgileri güncellendi.');
      } else {
        await adminApi.createMentor(fd);
        toast.success('Mentör başarıyla oluşturuldu.');
      }
      setShowModal(false);
      load();
    } catch { } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningMentor || !selectedStudentId) return;
    setAssignSubmitting(true);
    try {
      await adminApi.assignMentor(selectedStudentId, assigningMentor.id);
      toast.success('Öğrenci mentöre başarıyla atandı.');
      setAssigningMentor(null);
      load();
    } catch { } finally {
      setAssignSubmitting(false);
    }
  }

  async function executeDelete() {
    if (!deletingMentorId) return;
    try {
      await adminApi.deleteMentor(deletingMentorId);
      toast.success('Mentör silindi.');
      setDeletingMentorId(null);
      load();
    } catch { }
  }

  async function handleExportMatches() {
    try {
      const blob = await adminApi.exportMentorMatches();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'mentor_eslesmeleri.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      toast.error('Excel dosyası indirilemedi.');
    }
  }

  // ── Helper ──────────────────────────────────────────────────────────
  function getStudentCount(m: MentorProfile) {
    return m._count?.students ?? m.students?.length ?? 0;
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Mentör Yönetimi</h1>
          <p className="page-subtitle">Mentörleri yönetin, öğrenci eşleştirmelerini takip edin</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button onClick={handleExportMatches} className="btn-secondary flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Eşleşmeleri İndir (Excel)
          </button>
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Mentör Ekle
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Toplam Mentör"
            value={stats.totalMentors}
            accent="bg-blue-50 text-blue-600 border border-blue-100"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          />
          <StatCard
            title="Aktif Mentör"
            value={stats.activeMentors}
            accent="bg-emerald-50 text-emerald-600 border border-emerald-100"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          />
          <StatCard
            title="Eşleşme Oranı"
            value={`%${stats.matchRate}`}
            accent="bg-purple-50 text-purple-600 border border-purple-100"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6m3-3h-6"/></svg>}
          />
          <StatCard
            title="Boş Kontenjan"
            value={stats.availableSlots}
            accent="bg-amber-50 text-amber-600 border border-amber-100"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8m-4-4h8"/></svg>}
          />
        </div>
      )}

      {/* Toolbar: Search + Filters + View Toggle */}
      <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="İsim, şirket veya uzmanlık ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-9 text-sm w-full"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              ['all', 'Tümü'],
              ['active', 'Aktif'],
              ['passive', 'Pasif'],
              ['no-students', 'Bursiyersiz'],
              ['full', 'Kontenjan Dolu'],
            ] as [StatusFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  statusFilter === key
                    ? 'bg-primary-50 text-primary-700 border-primary-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 flex-shrink-0 self-start lg:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title="Kart Görünümü"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title="Tablo Görünümü"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="spinner border-gray-300 border-t-primary-500 w-8 h-8" />
        </div>
      ) : filteredMentors.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          {mentors.length === 0
            ? 'Henüz eklenmiş bir mentör bulunmamaktadır.'
            : 'Arama kriterlerine uygun mentör bulunamadı.'}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ───────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMentors.map(mentor => {
            const studentCount = getStudentCount(mentor);
            return (
              <div key={mentor.id} className={`bg-white rounded-2xl border shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between overflow-hidden transition-all hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] group ${
                !mentor.isActive ? 'border-gray-300 opacity-75' : 'border-gray-200/60'
              }`}>
                <div className="p-5">
                  {/* Header: Avatar + Name + Status */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-primary-100 shadow-sm">
                      {mentor.photoPath ? (
                        <img src={`/${mentor.photoPath}`} alt={`${mentor.firstName} ${mentor.lastName}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 font-bold text-lg uppercase">
                          {mentor.firstName[0]}{mentor.lastName[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-base leading-snug truncate">
                          {mentor.firstName} {mentor.lastName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                          mentor.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {mentor.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {mentor.title || 'Mentör'}
                        {mentor.company ? ` @ ${mentor.company}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Quick Contact */}
                  <div className="flex items-center gap-2 mb-4">
                    {mentor.email && (
                      <a
                        href={`mailto:${mentor.email}`}
                        title={mentor.email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        E-posta
                      </a>
                    )}
                    {mentor.phone && (
                      <a
                        href={`tel:${mentor.phone}`}
                        title={mentor.phone}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-green-50 hover:text-green-600 border border-gray-200 hover:border-green-200 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        Ara
                      </a>
                    )}
                  </div>

                  {/* Capacity Bar */}
                  <div className="mb-4">
                    <CapacityBar current={studentCount} max={mentor.maxCapacity} />
                  </div>

                  {/* Assigned Students Avatars */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <AvatarStack students={mentor.students} maxShow={4} />
                      {mentor.students && mentor.students.length > 0 && (
                        <button
                          onClick={() => setViewingStudentsFor(mentor)}
                          className="text-[11px] text-primary-600 hover:text-primary-800 font-semibold hover:underline"
                        >
                          Detay &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-gray-50/80 px-5 py-3 flex justify-between gap-3 border-t border-gray-100">
                  <button
                    onClick={() => openAssignModal(mentor)}
                    disabled={studentCount >= mentor.maxCapacity || !mentor.isActive}
                    className={`text-sm font-medium flex items-center gap-1.5 transition-colors ${
                      studentCount >= mentor.maxCapacity || !mentor.isActive
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-primary-600 hover:text-primary-800'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                    Öğrenci Ata
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(mentor)}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center transition-all"
                      title="Düzenle"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button
                      onClick={() => setDeletingMentorId(mentor.id)}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-red-500 hover:text-red-700 hover:border-red-300 flex items-center justify-center transition-all"
                      title="Sil"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table View ──────────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-16"></th>
                  <th>Ad Soyad</th>
                  <th>Ünvan & Şirket</th>
                  <th>İletişim</th>
                  <th className="w-44">Kapasite</th>
                  <th>Bursiyerler</th>
                  <th>Durum</th>
                  <th className="!text-right pr-6 w-36">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredMentors.map(mentor => {
                  const studentCount = getStudentCount(mentor);
                  return (
                    <tr key={mentor.id} className={!mentor.isActive ? 'opacity-60' : ''}>
                      <td>
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                          {mentor.photoPath ? (
                            <img src={`/${mentor.photoPath}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 font-bold text-xs uppercase">
                              {mentor.firstName[0]}{mentor.lastName[0]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-gray-900">{mentor.firstName} {mentor.lastName}</div>
                      </td>
                      <td>
                        <div className="text-sm text-gray-700">{mentor.title || '—'}</div>
                        {mentor.company && <div className="text-xs text-gray-500">{mentor.company}</div>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {mentor.email && (
                            <a href={`mailto:${mentor.email}`} title={mentor.email} className="text-gray-400 hover:text-blue-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            </a>
                          )}
                          {mentor.phone && (
                            <a href={`tel:${mentor.phone}`} title={mentor.phone} className="text-gray-400 hover:text-green-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <CapacityBar current={studentCount} max={mentor.maxCapacity} />
                      </td>
                      <td>
                        <AvatarStack students={mentor.students} maxShow={3} />
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          mentor.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {mentor.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="!text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openAssignModal(mentor)}
                            disabled={studentCount >= mentor.maxCapacity || !mentor.isActive}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                              studentCount >= mentor.maxCapacity || !mentor.isActive
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-primary-600 hover:bg-primary-50'
                            }`}
                            title="Öğrenci Ata"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                          </button>
                          {mentor.students && mentor.students.length > 0 && (
                            <button
                              onClick={() => setViewingStudentsFor(mentor)}
                              className="w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
                              title="Bursiyerleri Gör"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(mentor)}
                            className="w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
                            title="Düzenle"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button
                            onClick={() => setDeletingMentorId(mentor.id)}
                            className="w-7 h-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                            title="Sil"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Edit/Create Modal ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMentorId ? 'Mentör Bilgilerini Güncelle' : 'Yeni Mentör Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Ad *</label>
                    <input type="text" required className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Soyad *</label>
                    <input type="text" required className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Ünvan / Görev</label>
                    <input type="text" placeholder="Örn: Yazılım Mühendisi" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Çalıştığı Şirket</label>
                    <input type="text" placeholder="Örn: Google" className="form-input" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">E-posta</label>
                    <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Telefon</label>
                    <input type="tel" placeholder="05xxxxxxxxx" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Maks. Kapasite</label>
                    <input type="number" min="1" max="50" className="form-input" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} />
                    <p className="text-[11px] text-gray-400 mt-1">En fazla atanabilecek öğrenci sayısı</p>
                  </div>
                  <div>
                    <label className="form-label">Durum</label>
                    <select
                      className="form-select"
                      value={isActive ? 'true' : 'false'}
                      onChange={(e) => setIsActive(e.target.value === 'true')}
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Pasif</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Profil Fotoğrafı {editingMentorId && '(Değiştirmek için seçin)'}</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" disabled={submitting}>İptal</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Student Modal ─────────────────────────────────────── */}
      {assigningMentor && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Mentöre Öğrenci Ata</h2>
              <button onClick={() => setAssigningMentor(null)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 bg-primary-50 p-3 rounded-xl border border-primary-100">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                  {assigningMentor.photoPath ? (
                    <img src={`/${assigningMentor.photoPath}`} alt="Mentor" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-200 text-primary-700 font-bold uppercase">
                      {assigningMentor.firstName[0]}{assigningMentor.lastName[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-primary-900 text-sm">{assigningMentor.firstName} {assigningMentor.lastName}</h3>
                  <p className="text-xs text-primary-700">
                    Kapasite: {getStudentCount(assigningMentor)}/{assigningMentor.maxCapacity}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Öğrenci Seçin</label>
                  {studentsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <span className="spinner w-4 h-4 border-gray-300 border-t-primary-500" />
                      Öğrenciler yükleniyor...
                    </div>
                  ) : (
                    <select required className="form-select w-full" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                      <option value="" disabled>-- Bir öğrenci seçin --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} {s.universityName ? `(${s.universityName})` : ''}
                          {s.mentorId === assigningMentor.id ? ' (Zaten Atanmış)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setAssigningMentor(null)} className="btn-secondary" disabled={assignSubmitting}>İptal</button>
                  <button type="submit" className="btn-primary" disabled={assignSubmitting || studentsLoading || !selectedStudentId}>
                    {assignSubmitting ? 'Atanıyor...' : 'Ata'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── View Students Modal ──────────────────────────────────────── */}
      {viewingStudentsFor && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Atanmış Bursiyerler</h2>
              <button onClick={() => setViewingStudentsFor(null)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                  {viewingStudentsFor.photoPath ? (
                    <img src={`/${viewingStudentsFor.photoPath}`} alt="Mentor" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 font-bold uppercase">
                      {viewingStudentsFor.firstName[0]}{viewingStudentsFor.lastName[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{viewingStudentsFor.firstName} {viewingStudentsFor.lastName}</h3>
                  <div className="mt-1">
                    <CapacityBar current={getStudentCount(viewingStudentsFor)} max={viewingStudentsFor.maxCapacity} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {viewingStudentsFor.students && viewingStudentsFor.students.length > 0 ? (
                  viewingStudentsFor.students.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                          {s.photoPath ? (
                            <img src={`/${s.photoPath}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 text-[10px] font-bold uppercase">
                              {s.firstName?.[0]}{s.lastName?.[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{s.firstName} {s.lastName}</p>
                          {(s.universityName || s.department) && (
                            <p className="text-xs text-gray-500">
                              {s.universityName}{s.department ? ` — ${s.department}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setUnassigningStudent(s)}
                        className="text-amber-600 hover:text-amber-800 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                      >
                        Kaldır
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-gray-500 py-6">Bu mentöre atanmış herhangi bir öğrenci bulunmuyor.</p>
                )}
              </div>

              <div className="flex justify-end pt-5 mt-2 border-t border-gray-100">
                <button onClick={() => setViewingStudentsFor(null)} className="btn-secondary">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      {deletingMentorId && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Mentörü Sil</h3>
              <p className="text-sm text-gray-500 mb-6">
                Bu mentörü silmek istediğinizden emin misiniz? Mentör silindiğinde, mentöre atanmış tüm öğrencilerin ataması otomatik olarak kaldırılacaktır. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeletingMentorId(null)} className="btn-secondary flex-1">İptal</button>
                <button onClick={executeDelete} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 flex-1">Evet, Sil</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Unassign Confirmation Modal ────────────────────────────────── */}
      {unassigningStudent && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Atamayı Kaldır</h3>
              <p className="text-sm text-gray-500 mb-6">
                <strong>{unassigningStudent.firstName} {unassigningStudent.lastName}</strong> adlı öğrencinin mentör atamasını kaldırmak istediğinizden emin misiniz?
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setUnassigningStudent(null)} className="btn-secondary flex-1">İptal</button>
                <button 
                  onClick={async () => {
                    try {
                      await adminApi.assignMentor(unassigningStudent.id, null);
                      toast.success('Öğrenci ataması kaldırıldı.');
                      setUnassigningStudent(null);
                      setViewingStudentsFor(null);
                      load();
                    } catch {}
                  }} 
                  className="btn-primary bg-amber-600 hover:bg-amber-700 border-amber-600 flex-1"
                >
                  Evet, Kaldır
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
