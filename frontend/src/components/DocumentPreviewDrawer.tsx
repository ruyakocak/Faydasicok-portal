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
    if (document.entityType === 'DOCUMENT' && document.document?.filePath) {
      return `/${document.document.filePath}`;
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
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Belge Önizleme</h2>
            <p className="text-sm text-gray-500">
              {document.studentProfile?.firstName} {document.studentProfile?.lastName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex flex-col items-center justify-center">
          {fileUrl ? (
            isPdf ? (
              <iframe src={fileUrl} className="w-full h-full rounded-lg shadow-sm border border-gray-200" title="PDF Önizleme" />
            ) : isImage ? (
              <img src={fileUrl} alt="Belge Önizleme" className="max-w-full max-h-full rounded-lg shadow-sm" />
            ) : (
              <div className="text-center">
                <p className="text-gray-500 mb-4">Bu dosya türü önizlenemiyor.</p>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  Dosyayı Yeni Sekmede Aç
                </a>
              </div>
            )
          ) : (
            <div className="text-center text-gray-500">
              <p>Önizlenecek dosya bulunamadı.</p>
              <p className="text-sm mt-2 font-mono bg-gray-200 p-2 rounded">{document.newValue}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          {isRejecting ? (
            <div className="space-y-3 animate-fade-in">
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
            <div className="flex gap-3">
              <button 
                onClick={handleReject} 
                className="btn-secondary text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 flex-1 py-2.5"
              >
                Reddet
              </button>
              <button 
                onClick={handleApprove} 
                className="btn-primary flex-1 py-2.5 text-base"
              >
                Onayla
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
