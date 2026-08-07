import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mentorshipApi } from '../../api';

export default function MentorDashboardPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mentorshipApi.getProfile()
      .then(res => {
        setStudents(res.students || []);
        setProfile(res.profile);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center mt-10"><span className="spinner border-primary-500 border-t-transparent w-8 h-8"></span></div>;
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hoş Geldiniz, {profile?.firstName}</h1>
          <p className="text-sm text-gray-500 mt-1">Size atanan öğrenciler aşağıda listelenmektedir.</p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Henüz öğrenci atanmadı</h3>
          <p className="mt-1 text-sm text-gray-500">Size bir öğrenci atandığında burada listelenecektir.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <Link
              key={student.id}
              to={`/mentor/students/${student.id}`}
              className="card flex flex-col justify-between bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow p-6"
            >
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
                    {student.firstName?.[0]}{student.lastName?.[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{student.firstName} {student.lastName}</h3>
                    <p className="text-sm text-gray-500">{student.universityName}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Bölüm:</span> {student.department || '-'}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Sınıf:</span> {student.grade || '-'}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <span className="text-sm font-medium text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                  Profili Görüntüle &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
