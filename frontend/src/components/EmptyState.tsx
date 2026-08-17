import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="mb-6 relative">
        <div className="absolute -inset-4 bg-gray-50 rounded-full scale-110 opacity-50"></div>
        <svg 
          viewBox="0 0 120 120" 
          className="w-24 h-24 text-gray-300 relative z-10" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* A minimal inbox/document line art */}
          <path d="M20 40 L100 40 L100 90 A10 10 0 0 1 90 100 L30 100 A10 10 0 0 1 20 90 Z" fill="white" />
          <path d="M20 40 L35 60 L85 60 L100 40" stroke="currentColor" />
          <path d="M45 60 A 15 15 0 0 0 75 60" stroke="currentColor" />
          {/* Subtle maroon accent dot */}
          <circle cx="60" cy="50" r="4" className="text-primary-500" fill="currentColor" stroke="none" />
          {/* Decorative lines */}
          <line x1="40" y1="80" x2="60" y2="80" stroke="currentColor" />
          <line x1="40" y1="70" x2="50" y2="70" stroke="currentColor" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1 tracking-tight">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
