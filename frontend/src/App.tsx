import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectLayout } from './pages/ProjectLayout';
import { BoardPage } from './pages/BoardPage';
import { BacklogPage } from './pages/BacklogPage';
import { SprintsPage } from './pages/SprintsPage';
import { EpicsPage } from './pages/EpicsPage';
import { MembersPage } from './pages/MembersPage';
import { WorkflowPage } from './pages/WorkflowPage';
import { AdminRolesPage } from './pages/AdminRolesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminJoinRequestsPage } from './pages/AdminJoinRequestsPage';
import { AdminActivityPage } from './pages/AdminActivityPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* Not admin-only: a project manager sees/decides requests for their own projects too (§13). */}
            <Route path="/admin/join-requests" element={<AdminJoinRequestsPage />} />

            <Route path="/projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<Navigate to="board" replace />} />
              <Route path="board" element={<BoardPage />} />
              <Route path="backlog" element={<BacklogPage />} />
              <Route path="sprints" element={<SprintsPage />} />
              <Route path="epics" element={<EpicsPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="workflow" element={<WorkflowPage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin/roles" element={<AdminRolesPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/activity" element={<AdminActivityPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
