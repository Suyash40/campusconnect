import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, ProtectedRoute } from './components/Layout';
import Landing from './pages/public/Landing';
import About from './pages/public/About';
import { Login, Register } from './pages/public/Auth';
import Onboarding from './pages/student/Onboarding';
import StudentDashboard from './pages/student/Dashboard';
import Opportunities from './pages/student/Opportunities';
import OpportunityDetail from './pages/student/OpportunityDetail';
import { Registrations, Saved, Applications } from './pages/student/Lists';
import Placements from './pages/student/Placements';
import Notifications from './pages/student/Notifications';
import Assistant from './pages/student/Assistant';
import Clubs from './pages/student/Clubs';
import Profile from './pages/student/Profile';
import Settings from './pages/student/Settings';
import { CoordinatorAnalytics, CoordinatorAnnouncements, CoordinatorClubs, CoordinatorDashboard, CoordinatorEvents, Attendees } from './pages/coordinator/Workspace';
import Composer from './pages/coordinator/Composer';
import { AdminDashboard, AdminUsers, AdminClubs, AdminModeration, AdminAudit, AdminAnnouncements } from './pages/admin/Admin';
import { useAuth } from './lib/auth';
import { navFor } from './components/Layout';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={navFor(user.role)[0].to} replace />;
  return <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/opportunities" element={<ProtectedRoute roles={['student']}><Opportunities /></ProtectedRoute>} />
        <Route path="/opportunities/:id" element={<OpportunityDetail />} />
        <Route path="/registrations" element={<ProtectedRoute roles={['student']}><Registrations /></ProtectedRoute>} />
        <Route path="/saved" element={<ProtectedRoute roles={['student']}><Saved /></ProtectedRoute>} />
        <Route path="/placements" element={<ProtectedRoute roles={['student']}><Placements /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute roles={['student']}><Applications /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute roles={['student']}><Notifications /></ProtectedRoute>} />
        <Route path="/assistant" element={<ProtectedRoute roles={['student']}><Assistant /></ProtectedRoute>} />
        <Route path="/clubs" element={<ProtectedRoute roles={['student']}><Clubs /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="/coordinator/dashboard" element={<ProtectedRoute roles={['coordinator', 'admin']}><CoordinatorDashboard /></ProtectedRoute>} />
        <Route path="/coordinator/announcements" element={<ProtectedRoute roles={['coordinator', 'admin']}><CoordinatorAnnouncements /></ProtectedRoute>} />
        <Route path="/coordinator/announcements/new" element={<ProtectedRoute roles={['coordinator', 'admin']}><Composer mode="new" /></ProtectedRoute>} />
        <Route path="/coordinator/announcements/:id/edit" element={<ProtectedRoute roles={['coordinator', 'admin']}><Composer mode="edit" /></ProtectedRoute>} />
        <Route path="/coordinator/events" element={<ProtectedRoute roles={['coordinator', 'admin']}><CoordinatorEvents /></ProtectedRoute>} />
        <Route path="/coordinator/events/:id/attendees" element={<ProtectedRoute roles={['coordinator', 'admin']}><Attendees /></ProtectedRoute>} />
        <Route path="/coordinator/clubs" element={<ProtectedRoute roles={['coordinator', 'admin']}><CoordinatorClubs /></ProtectedRoute>} />
        <Route path="/coordinator/analytics" element={<ProtectedRoute roles={['coordinator', 'admin']}><CoordinatorAnalytics /></ProtectedRoute>} />

        <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/clubs" element={<ProtectedRoute roles={['admin']}><AdminClubs /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute roles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/moderation" element={<ProtectedRoute roles={['admin']}><AdminModeration /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminAudit /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<div className="p-10 text-center"><h1 className="text-2xl font-semibold">Page not found</h1><p className="mt-2 text-[var(--muted)]">Check the address or go back to your dashboard.</p></div>} />
    </Routes>
  );
}
