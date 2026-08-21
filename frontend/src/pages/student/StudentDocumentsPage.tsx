import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { studentApi, documentApi } from '../../api';
import type { StudentProfile, Document as DocFile, DocumentPeriod } from '../../types';
import { DocumentsTab } from '../../components/ProfileTabs';
import { differenceInDays, format } from 'date-fns';
import { tr } from 'date-fns/locale';

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

    const docTypeObj = docTypes.find(dt => dt.code === p.type);
    if (docTypeObj) {
      let dtCatIds: string[] = [];
      try {
        dtCatIds = docTypeObj.categoryIds ? JSON.parse(docTypeObj.categoryIds) : [];
        if (!Array.isArray(dtCatIds)) dtCatIds = [];
      } catch {}

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
        <section className="bg-gradient-to-br from-primary-900 to-primary-800 rounded-3xl p-8 md:p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90">
              Aksiyon Gerekli
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">Teslim Edilmesi Gereken {activeDeadlines.length} Belgeniz Bulunuyor</h2>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              {activeDeadlines.map((p) => {
                const type = docTypes.find(t => t.code === p.type)?.name || p.type;
                const daysLeft = p.endDate ? differenceInDays(new Date(p.endDate), new Date()) : null;
                return (
                  <div key={p.id} className="bg-white/10 p-3 rounded-2xl border border-white/20 text-sm">
                    <div className="font-semibold text-white truncate">{p.label} - {type}</div>
                    <div className="text-primary-100 font-medium mt-1">
                      {daysLeft !== null ? `Son ${daysLeft} Gün (${format(new Date(p.endDate!), 'dd.MM.yyyy', { locale: tr })})` : 'Süre devam ediyor'}
                    </div>
                  </div>
                );
              })}
            </div>
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
