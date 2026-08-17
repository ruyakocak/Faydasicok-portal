import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  description?: string;
  onBack?: () => void;
  showBack?: boolean;
  children?: React.ReactNode;
}

export default function PageHeader({ title, description, onBack, showBack = true, children }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-3">
        {showBack && (
          <button 
            onClick={onBack ? onBack : () => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Geri Dön"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      {children && (
        <div className="flex gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
