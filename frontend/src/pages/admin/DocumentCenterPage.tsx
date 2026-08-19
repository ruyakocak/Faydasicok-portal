import { useState } from 'react';
import ApprovalQueueTab from './ApprovalQueueTab';
import PeriodsTab from './PeriodsTab';
import DocumentTypesTab from './DocumentTypesTab';

export default function DocumentCenterPage() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'periods' | 'types'>('approvals');

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Belge Yönetim Merkezi</h1>
        <p className="page-subtitle">Belge türleri, dönemler ve onay bekleyen talepler</p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'approvals'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Onay Bekleyenler
          </button>
          <button
            onClick={() => setActiveTab('periods')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'periods'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dönem / Talep Yönetimi
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'types'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Belge Türleri (Şablonlar)
          </button>
        </nav>
      </div>

      <div className="tab-content">
        {activeTab === 'approvals' && <ApprovalQueueTab />}
        {activeTab === 'periods' && <PeriodsTab />}
        {activeTab === 'types' && <DocumentTypesTab />}
      </div>
    </div>
  );
}
