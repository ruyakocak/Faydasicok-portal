import { useEffect, useState } from 'react';
import { mentorshipApi } from '../../api';

export default function MentorshipPage() {
  const [mentor, setMentor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mentorshipApi.getProfile()
      .then(res => setMentor(res.mentor))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center mt-10"><span className="spinner border-primary-500 border-t-transparent w-8 h-8"></span></div>;
  }

  if (!mentor) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Mentörlük</h1>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Henüz bir mentör atanmadı</h3>
          <p className="mt-1 text-sm text-gray-500">
            Mentör atama süreciniz devam etmektedir. Atama yapıldığında burada mentörünüzün bilgilerini görebileceksiniz.
          </p>
        </div>
      </div>
    );
  }

  const avatar = mentor.avatarUrl || `https://ui-avatars.com/api/?name=${mentor.firstName}+${mentor.lastName}&background=random`;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Mentörlük</h1>
        <p className="text-sm text-gray-500 mt-1">
          Size atanan mentörünüzün bilgilerini buradan görebilir ve iletişime geçebilirsiniz.
        </p>
      </div>

      <div className="card overflow-hidden bg-white shadow-sm border border-gray-200 sm:rounded-lg">
        <div className="p-6 sm:p-8">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="sm:flex sm:space-x-5">
              <div className="flex-shrink-0 mb-4 sm:mb-0">
                <img
                  className="mx-auto h-20 w-20 rounded-full border-2 border-primary-100"
                  src={avatar}
                  alt={`${mentor.firstName} ${mentor.lastName}`}
                />
              </div>
              <div className="text-center sm:text-left sm:pt-1">
                <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                  {mentor.firstName} {mentor.lastName}
                </p>
                <p className="text-sm font-medium text-gray-500">
                  {mentor.title || 'Mentör'}
                </p>
                <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                  {mentor.expertise?.split(',').map((exp: string, i: number) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {exp.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 sm:px-8">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">E-posta Adresi</dt>
              <dd className="mt-1 text-sm text-gray-900">{mentor.user?.email || '—'}</dd>
            </div>
            {mentor.linkedin && (
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">LinkedIn</dt>
                <dd className="mt-1 text-sm text-primary-600 hover:text-primary-800">
                  <a href={mentor.linkedin} target="_blank" rel="noopener noreferrer">
                    {mentor.linkedin}
                  </a>
                </dd>
              </div>
            )}
            {mentor.company && (
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Şirket/Kurum</dt>
                <dd className="mt-1 text-sm text-gray-900">{mentor.company}</dd>
              </div>
            )}
          </dl>
          
          <div className="mt-6 rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1 md:flex md:justify-between">
                <p className="text-sm text-blue-700">
                  Şu an için mentörünüzle e-posta aracılığıyla iletişime geçebilirsiniz. Platform içi mesajlaşma özelliği yakında eklenecektir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
