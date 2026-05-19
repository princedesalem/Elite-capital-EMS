import React from 'react'
import {BrowserRouter,Routes,Route,Navigate,useParams} from 'react-router-dom'
import {AuthProvider} from './contexts/AuthContext'
import {ThemeProvider} from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import RHLayout from './components/RHLayout'
import Login from './components/Login'
import Home from './pages/Home'
import EmailLoginCallback from './pages/EmailLoginCallback'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeForm from './pages/EmployeeForm'
import CongesPage from './pages/CongesPage'
import PermissionsPage from './pages/PermissionsPage'
import MissionsPage from './pages/MissionsPage'
import FraisPage from './pages/FraisPage'
import ProtectedRoute from './components/ProtectedRoute'
import MFASetup from './components/MFASetup'
import ChangePassword from './components/ChangePassword'
import Operations from './pages/Operations'
import WorkflowPage from './pages/WorkflowPage'
import EvaluationsPage from './pages/EvaluationsPage'
import FicheDePostePage from './pages/FicheDePostePage'
import NotificationsPage from './pages/NotificationsPage'
import Organisation from './pages/Organisation'
import Administration from './pages/Administration'
import Utilisateurs from './pages/Utilisateurs'
import UsageStats from './pages/UsageStats'
import AdminUsageStats from './pages/AdminUsageStats'
import MissionsIG from './pages/MissionsIG'
import CongeCalendar from './pages/CongeCalendar'
import SortiesPage from './pages/SortiesPage'
import Parametrage from './pages/Parametrage'
import ModulePlaceholder from './pages/ModulePlaceholder'
import TasksPage from './pages/TasksPage'
import EventsPage from './pages/EventsPage'
import AnalyticsDashboards from './pages/AnalyticsDashboards'
import EmployeeTimeline from './pages/EmployeeTimeline'
import OrgChart from './pages/OrgChart'
import PerformanceReviews from './pages/PerformanceReviews'
import WorkforcePlanning from './pages/WorkforcePlanning'
import TalentManagement from './pages/TalentManagement'
import ClubReview from './pages/ClubReview'
import SandboxPage from './pages/SandboxPage'
import AbsencesPage from './pages/AbsencesPage'
import AuditLogPage from './pages/AuditLogPage'
import ProfilePage from './pages/ProfilePage'
import DemandeExplicationPage from './pages/DemandeExplicationPage'
import AIAssistantPage from './pages/AIAssistantPage'
import DisciplinairePage from './pages/DisciplinairePage'
import ScoreComportementalPage from './pages/ScoreComportementalPage'
import DocumentationPage from './pages/DocumentationPage'
import RemplacantsPage from './pages/RemplacantsPage'
import Academy from './pages/Academy'
import AcademyCourse from './pages/AcademyCourse'
import AcademyAdmin from './pages/AcademyAdmin'
import { ToastProvider, ConfirmProvider } from './components/ui'
import './index.css'

function EmployeeIdRedirect() {
  const { id } = useParams()
  return <Navigate to={`/rh/employees/${id}`} replace />
}

export default function App(){
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
        <ToastProvider>
        <ConfirmProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/rh/home" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/email/callback" element={<EmailLoginCallback />} />

          <Route path="/rh" element={<ProtectedRoute><RHLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />

            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<ProtectedRoute allowedRoles={["RH","PCA","ADMIN"]}><EmployeeForm /></ProtectedRoute>} />
            <Route path="employees/new" element={<ProtectedRoute allowedRoles={["RH","PCA","ADMIN"]}><EmployeeForm /></ProtectedRoute>} />

            <Route path="absences" element={<AbsencesPage />} />
            <Route path="conges" element={<CongesPage />} />
            <Route path="permissions" element={<PermissionsPage />} />
            <Route path="missions" element={<MissionsPage />} />
            <Route path="frais" element={<FraisPage />} />
            <Route path="operations" element={<Operations />} />
            <Route path="workflow" element={<WorkflowPage />} />
            <Route path="missions-ig" element={<MissionsIG />} />
            <Route path="evaluations" element={<EvaluationsPage />} />
            <Route path="fiche-de-poste" element={<FicheDePostePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="organisation" element={<Organisation />} />
            <Route path="administration" element={<Administration />} />
            <Route path="utilisateurs" element={<ProtectedRoute allowedRoles={["ADMIN","PCA","AG"]}><Utilisateurs /></ProtectedRoute>} />
            <Route path="usage-stats" element={<ProtectedRoute allowedRoles={["ADMIN"]}><UsageStats /></ProtectedRoute>} />
            <Route path="admin/usage-stats" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminUsageStats /></ProtectedRoute>} />
            <Route path="mfa" element={<MFASetup />} />
            <Route path="password" element={<ChangePassword />} />
            <Route path="calendrier-conge" element={<CongeCalendar />} />
            <Route path="sorties" element={<SortiesPage />} />
            <Route path="remplacants" element={<RemplacantsPage />} />
            <Route path="parametrage" element={<Parametrage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="analytics" element={<AnalyticsDashboards />} />
            <Route path="timeline" element={<EmployeeTimeline />} />
            <Route path="orgchart" element={<OrgChart />} />
            <Route path="performance" element={<PerformanceReviews />} />
            <Route path="workforce" element={<WorkforcePlanning />} />
            <Route path="talent" element={<TalentManagement />} />
            <Route path="club-review" element={<ClubReview />} />
            <Route path="sandbox" element={<ProtectedRoute allowedRoles={["ADMIN"]}><SandboxPage /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AuditLogPage /></ProtectedRoute>} />
            <Route path="module/:slug" element={<ModulePlaceholder />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="demandes-explication" element={<DemandeExplicationPage />} />
            <Route path="ai-assistant" element={<AIAssistantPage />} />
            <Route path="disciplinaire" element={<DisciplinairePage />} />
            <Route path="score-comportemental" element={<ScoreComportementalPage />} />
            <Route path="documentation" element={<DocumentationPage />} />
            <Route path="academy" element={<Academy />} />
            <Route path="academy/admin" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AcademyAdmin /></ProtectedRoute>} />
            <Route path="academy/:formationId" element={<AcademyCourse />} />
          </Route>

          <Route path="/home" element={<Navigate to="/rh/home" replace />} />
          <Route path="/pdf/*" element={<Navigate to="/rh/conges" replace />} />
          <Route path="/dashboard" element={<Navigate to="/rh/dashboard" replace />} />
          <Route path="/employees" element={<Navigate to="/rh/employees" replace />} />
          <Route path="/employees/new" element={<Navigate to="/rh/employees/new" replace />} />
          <Route path="/employees/:id" element={<EmployeeIdRedirect />} />
          <Route path="/leaves" element={<Navigate to="/rh/conges" replace />} />
          <Route path="/leaves/new" element={<Navigate to="/rh/conges" replace />} />
          <Route path="/operations" element={<Navigate to="/rh/operations" replace />} />
          <Route path="/remplacants" element={<Navigate to="/rh/remplacants" replace />} />
          <Route path="/missions-ig" element={<Navigate to="/rh/missions-ig" replace />} />
          <Route path="/evaluations" element={<Navigate to="/rh/evaluations" replace />} />
          <Route path="/notifications" element={<Navigate to="/rh/notifications" replace />} />
          <Route path="/organisation" element={<Navigate to="/rh/organisation" replace />} />
          <Route path="/administration" element={<Navigate to="/rh/administration" replace />} />
          <Route path="/usage-stats" element={<Navigate to="/rh/usage-stats" replace />} />
          <Route path="/admin/usage-stats" element={<Navigate to="/rh/admin/usage-stats" replace />} />
          <Route path="/mfa" element={<Navigate to="/rh/mfa" replace />} />
          <Route path="/password" element={<Navigate to="/rh/password" replace />} />
          <Route path="/profile" element={<Navigate to="/rh/profile" replace />} />
          <Route path="/utilisateurs" element={<Navigate to="/rh/utilisateurs" replace />} />

        </Routes>
        </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
