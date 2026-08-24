import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { studentApi, documentApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod } from '../../types';
import { DocumentsTab } from '../../components/ProfileTabs';
import { differenceInDays } from 'date-fns';

export default function StudentDocumentsPage() {
  const { user } = useAuth();
  const profileId = user?.profileId;

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [periods, setPeriods] = useState<DocumentPeriod[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!profileId) return;
    try {
      const [p, d, pers, types] = await Promise.all([
        studentApi.getProfile(profileId),
        studentApi.getDocuments(profileId),
        documentApi.getPeriods(),
        documentApi.getActiveTypes().catch(() => []),
      ]);
      setProfile(p);
      setDocuments(d);
      setPeriods(pers);
      setDocTypes(types);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="spinner border-gray-300 border-t-primary-500 w-9 h-9" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card p-12 text-center text-gray-500">
        Profil bilgisi yüklenemedi.
      </div>
    );
  }

  // Active deadlines calculation
  const activeDeadlines = periods.filter(p => {
    if (!p.isOpen) return false;
    if (p.type === 'VOLUNTEER_REPORT') return false;

    const docTypeObj = docTypes.find(dt => dt.code === p.type);
    if (docTypeObj) {
      let dtCatIds: string[] = [];
      try {
        dtCatIds = docTypeObj.categoryIds ? JSON.parse(docTypeObj.categoryIds) : [];
        if (!Array.isArray(dtCatIds)) dtCatIds = [];
      } catch { }

      // if dtCatIds is empty, it means open to all categories
      if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
        return false;
      }
      if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
        return false;
      }
    }

    const isUploaded = documents.some(d => d.periodId === p.id && d.status !== 'REJECTED');
    return !isUploaded;
  });

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-20 animate-in fade-in duration-700">

      {/* ── 1. Clean Header ──────────────────────────────────── */}
      <section className="relative pt-10 pb-8 border-b border-gray-200/60 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs font-semibold text-primary-700">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            Evrak Sistemi
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Belge Yönetim Merkezi
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            İlk kayıt evraklarınızı, dönemlik belgelerinizi ve teslim durumlarını buradan yönetebilirsiniz.
          </p>
        </div>
      </section>

      {/* Deadlines Alert Banner if any pending */}
      {activeDeadlines.length > 0 && (
        <section className="bg-gradient-to-br from-primary-900 to-primary-800 rounded-3xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-semibold text-white/80 mb-1">
                Aksiyon Gerekli
              </div>
              <h2 className="text-lg font-semibold tracking-tight leading-tight">
                Teslim Edilmesi Gereken {activeDeadlines.length} Belgeniz Bulunuyor
              </h2>
            </div>
          </div>

          {/* Compact scrollable list */}
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {activeDeadlines.map((p) => {
              const type = docTypes.find(t => t.code === p.type)?.name || p.type;
              const daysLeft = p.endDate ? differenceInDays(new Date(p.endDate), new Date()) : null;
              const isUrgent = daysLeft !== null && daysLeft <= 3;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-4 py-2.5 border border-white/15">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {p.label} — {type}
                    </span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${isUrgent
                      ? 'bg-rose-400/40 text-rose-100 border border-rose-300/30'
                      : 'bg-white/10 text-white/70 border border-white/15'
                    }`}>
                    {daysLeft !== null
                      ? `Son ${daysLeft} gün`
                      : 'Süre devam ediyor'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Documents Tab Component */}
      <section className="bg-white rounded-3xl p-8 border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <DocumentsTab
          profile={profile}
          documents={documents}
          periods={periods}
          onUpload={loadData}
          readOnly={false}
        />
      </section>
    </div>
  );
}
