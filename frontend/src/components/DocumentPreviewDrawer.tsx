import { useEffect, useState } from 'react';
import type { ApprovableChange } from '../types';

interface DocumentPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  document: ApprovableChange | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note: string) => Promise<void>;
}

export default function DocumentPreviewDrawer({
  isOpen,
  onClose,
  document,
  onApprove,
  onReject,
}: DocumentPreviewDrawerProps) {
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.document.body.style.overflow = 'hidden';
      setRejectNote('');
      setIsRejecting(false);
    } else {
      window.document.body.style.overflow = 'unset';
    }
    return () => { window.document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen || !document) return null;

  const handleApprove = async () => {
    setLoadingAction(true);
    try {
      await onApprove(document.id);
      onClose();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    if (!isRejecting) {
      setIsRejecting(true);
      return;
    }
    if (!rejectNote.trim()) return;
    
    setLoadingAction(true);
    try {
      await onReject(document.id, rejectNote);
      onClose();
    } finally {
      setLoadingAction(false);
    }
  };

  const getFileUrl = () => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    if (document.entityType === 'DOCUMENT' && document.document?.filePath) {
      return `${baseUrl}/${document.document.filePath.replace(/^\/+/, '')}`;
    }
    
    if (document.newValue) {
      try {
        const parsed = JSON.parse(document.newValue);
        if (parsed.fileUrl) return parsed.fileUrl;
      } catch {
        // If it's just a raw URL string
        if (document.newValue.startsWith('http')) return document.newValue;
      }
    }
    return null;
  };

  const fileUrl = getFileUrl();
  const isPdf = fileUrl?.toLowerCase().endsWith('.pdf');
  const isImage = fileUrl?.match(/\.(jpeg|jpg|gif|png)$/i);

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className={`bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col relative transform transition-transform duration-300 ${
          isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              Belge Önizleme
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 ml-7">
              {document.studentProfile?.firstName} {document.studentProfile?.lastName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {fileUrl && (
              <>
                <a href={fileUrl} download="Belge" className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  İndir
                </a>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  Yeni Sekme
                </a>
              </>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-100 flex flex-col relative min-h-0">
          {fileUrl ? (
            isPdf ? (
              <iframe src={fileUrl} className="absolute inset-0 w-full h-full border-0" title="PDF Önizleme" />
            ) : isImage ? (
              <div className="flex items-center justify-center p-6 h-full">
                <img src={fileUrl} alt="Belge Önizleme" className="max-w-full max-h-full rounded-lg shadow-md object-contain" />
              </div>
            ) : (
              <div className="text-center mt-20">
                <p className="text-gray-500 mb-4">Bu dosya türü önizlenemiyor.</p>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  Dosyayı Yeni Sekmede Aç
                </a>
              </div>
            )
          ) : (
            <div className="text-center text-gray-500 mt-20">
              <p>Önizlenecek dosya bulunamadı.</p>
              <p className="text-sm mt-2 font-mono bg-gray-200 p-2 rounded max-w-lg mx-auto break-all">{document.newValue}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          {isRejecting ? (
            <div className="space-y-3 animate-fade-in max-w-2xl mx-auto">
              <label className="block text-sm font-medium text-gray-700">Ret Sebebi (Zorunlu)</label>
              <textarea
                className="form-input w-full p-2 h-20 resize-none text-sm"
                placeholder="Örn: Belge tarihi güncel değil..."
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsRejecting(false)} 
                  className="btn-secondary flex-1"
                  disabled={loadingAction}
                >
                  Vazgeç
                </button>
                <button 
                  onClick={handleReject} 
                  className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 flex-1"
                  disabled={!rejectNote.trim() || loadingAction}
                >
                  {loadingAction ? <span className="spinner w-4 h-4" /> : 'Reddet ve Kapat'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 max-w-lg mx-auto">
              <button 
                onClick={handleReject} 
                className="btn-secondary text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 flex-1 py-3 text-base font-semibold"
              >
                Reddet
              </button>
              <button 
                onClick={handleApprove} 
                className="btn-primary flex-1 py-3 text-base font-semibold"
              >
                Onayla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
