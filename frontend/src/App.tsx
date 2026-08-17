import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Student pages
import StudentLayout from './layouts/StudentLayout';
import StudentProfilePage from './pages/student/StudentProfilePage';
import StudentAnnouncementsPage from './pages/student/StudentAnnouncementsPage';
import StudentEventsPage from './pages/student/StudentEventsPage';

// Admin pages
import AdminLayout from './layouts/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import StudentsListPage from './pages/admin/StudentsListPage';
import StudentDetailPage from './pages/admin/StudentDetailPage';
import MentorsPage from './pages/admin/MentorsPage';
import ApprovalQueuePage from './pages/admin/ApprovalQueuePage';
import PeriodsPage from './pages/admin/PeriodsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import UsersPage from './pages/admin/UsersPage';
import EventsPage from './pages/admin/EventsPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import SettingsPage from './pages/admin/SettingsPage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return (
    <>
      <ForcePasswordChangeModal />
      {children}
    </>
  );
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') return <Navigate to={`/student/profile`} replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Student */}
        <Route
          path="/student"
          element={
            <PrivateRoute roles={['STUDENT']}>
              <StudentLayout />
            </PrivateRoute>
          }
        >
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="announcements" element={<StudentAnnouncementsPage />} />
          <Route path="events" element={<StudentEventsPage />} />
          <Route index element={<Navigate to="profile" replace />} />
        </Route>

        {/* Admin / Reviewer */}
        <Route
          path="/admin"
          element={
            <PrivateRoute roles={['ADMIN', 'REVIEWER']}>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsListPage />} />
          <Route path="students/:profileId" element={<StudentDetailPage />} />
          <Route path="approvals" element={<ApprovalQueuePage />} />
          <Route path="periods" element={<PeriodsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="mentors" element={<MentorsPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
