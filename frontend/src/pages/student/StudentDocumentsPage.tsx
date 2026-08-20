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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Belge Yönetim Merkezi
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          İlk kayıt evraklarınızı, dönemlik belgelerinizi ve teslim durumlarını buradan yönetebilirsiniz.
        </p>
      </div>

      {/* Deadlines Alert Banner if any pending */}
      {activeDeadlines.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-300/80 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-amber-900">
                Teslim Edilmesi Gereken {activeDeadlines.length} Açık Belgeniz Bulunuyor
              </h2>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {activeDeadlines.map((p) => {
                  const type = docTypes.find(t => t.code === p.type)?.name || p.type;
                  const daysLeft = p.endDate ? differenceInDays(new Date(p.endDate), new Date()) : null;
                  return (
                    <div key={p.id} className="bg-white/90 p-2.5 rounded-xl border border-amber-200 text-xs">
                      <div className="font-bold text-gray-900 truncate">{p.label} - {type}</div>
                      <div className="text-amber-700 font-semibold mt-0.5">
                        {daysLeft !== null ? `Son ${daysLeft} Gün (${format(new Date(p.endDate!), 'dd.MM.yyyy', { locale: tr })})` : 'Süre devam ediyor'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Documents Tab Component */}
      <div className="card overflow-hidden bg-white shadow-xs border border-gray-200">
        <div className="p-6">
          <DocumentsTab
            profile={profile}
            documents={documents}
            periods={periods}
            onUpload={loadData}
            readOnly={false}
          />
        </div>
      </div>
    </div>
  );
}
