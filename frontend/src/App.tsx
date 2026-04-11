import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PortalRoute } from './components/PortalRoute';
import { CrewRoute } from './components/CrewRoute';
import { AppLayout } from './components/layout/AppLayout';
import { PortalLayout } from './components/layout/PortalLayout';
import { CrewMobileLayout } from './components/layout/CrewMobileLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomerListPage from './pages/customers/CustomerListPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import PropertyListPage from './pages/properties/PropertyListPage';
import PropertyDetailPage from './pages/properties/PropertyDetailPage';
import ContactListPage from './pages/contacts/ContactListPage';
import ContactDetailPage from './pages/contacts/ContactDetailPage';
import ContractListPage from './pages/contracts/ContractListPage';
import ContractDetailPage from './pages/contracts/ContractDetailPage';
import JobListPage from './pages/jobs/JobListPage';
import JobCard from './pages/jobs/job-card/JobCard';
import SchedulePage from './pages/jobs/SchedulePage';
import CrewListPage from './pages/crews/CrewListPage';
import CrewDetailPage from './pages/crews/CrewDetailPage';
import RouteListPage from './pages/routes/RouteListPage';
import RouteDetailPage from './pages/routes/RouteDetailPage';
import TimeEntryListPage from './pages/time-tracking/TimeEntryListPage';
import TimesheetPage from './pages/time-tracking/TimesheetPage';
import InvoiceListPage from './pages/invoices/InvoiceListPage';
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage';
import DisputeListPage from './pages/disputes/DisputeListPage';
import DisputeDetailPage from './pages/disputes/DisputeDetailPage';
import SeasonListPage from './pages/snow/SeasonListPage';
import RunListPage from './pages/snow/RunListPage';
import RunDetailPage from './pages/snow/RunDetailPage';
import ProjectListPage from './pages/hardscape/ProjectListPage';
import ProjectDetailPage from './pages/hardscape/ProjectDetailPage';
import PipelinePage from './pages/hardscape/PipelinePage';
import ProspectListPage from './pages/prospects/ProspectListPage';
import ProspectDetailPage from './pages/prospects/ProspectDetailPage';
import EquipmentListPage from './pages/equipment/EquipmentListPage';
import MaterialListPage from './pages/materials/MaterialListPage';
import SubcontractorListPage from './pages/subcontractors/SubcontractorListPage';
import TemplateListPage from './pages/sops/TemplateListPage';
import TemplateDetailPage from './pages/sops/TemplateDetailPage';
import AssignmentListPage from './pages/sops/AssignmentListPage';
import IntegrationListPage from './pages/integrations/IntegrationListPage';
import TemplatesPage from './pages/templates/TemplatesPage';
import SettingsPage from './pages/settings/SettingsPage';
import UserListPage from './pages/settings/UserListPage';
import UserDetailPage from './pages/settings/UserDetailPage';
import ReportsPage from './pages/reports/ReportsPage';
import NotificationPage from './pages/notifications/NotificationPage';
import SeasonalListPage from './pages/seasonal/SeasonalListPage';
import SeasonalDetailPage from './pages/seasonal/SeasonalDetailPage';
import SeasonSetupWizard from './pages/season-setup/SeasonSetupWizard';
import DispatchBoardPage from './pages/dispatch/DispatchBoard';
import LiveCrewMapPage from './pages/live-map/LiveCrewMapPage';
import PortalLoginPage from './pages/portal/PortalLoginPage';
import PortalDashboardPage from './pages/portal/PortalDashboardPage';
import PortalContractsPage from './pages/portal/PortalContractsPage';
import PortalJobsPage from './pages/portal/PortalJobsPage';
import PortalInvoicesPage from './pages/portal/PortalInvoicesPage';
import PortalInvoiceDetailPage from './pages/portal/PortalInvoiceDetailPage';
import PortalPropertiesPage from './pages/portal/PortalPropertiesPage';
import PortalFilesPage from './pages/portal/PortalFilesPage';
import CrewLoginPage from './pages/crew-mobile/CrewLoginPage';
import CrewDashboardPage from './pages/crew-mobile/CrewDashboardPage';
import CrewJobDetailPage from './pages/crew-mobile/CrewJobDetailPage';
import CrewTimesheetPage from './pages/crew-mobile/CrewTimesheetPage';
import CrewProfilePage from './pages/crew-mobile/CrewProfilePage';
import SigningPage from './pages/signing/SigningPage';
import BillingDashboard from './pages/billing/BillingDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Public signing page — no auth required */}
        <Route path="/sign/:token" element={<SigningPage />} />

        {/* Protected routes with shared layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Customers & Properties */}
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/properties" element={<PropertyListPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />

          {/* Contacts */}
          <Route path="/contacts" element={<ContactListPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />

          {/* Contracts */}
          <Route path="/contracts" element={<ContractListPage />} />
          <Route path="/contracts/:id" element={<ContractDetailPage />} />

          {/* Jobs & Scheduling */}
          <Route path="/jobs" element={<JobListPage />} />
          <Route path="/jobs/:id" element={<JobCard />} />
          <Route path="/jobs/:id/:tab" element={<JobCard />} />
          <Route path="/schedule" element={<SchedulePage />} />

          {/* Dispatch */}
          <Route path="/dispatch" element={<DispatchBoardPage />} />

          {/* Live Crew Map */}
          <Route path="/live-map" element={<LiveCrewMapPage />} />

          {/* Crews & Routes */}
          <Route path="/crews" element={<CrewListPage />} />
          <Route path="/crews/:id" element={<CrewDetailPage />} />
          <Route path="/routes" element={<RouteListPage />} />
          <Route path="/routes/:id" element={<RouteDetailPage />} />

          {/* Time Tracking */}
          <Route path="/time-tracking" element={<TimeEntryListPage />} />
          <Route path="/timesheets" element={<TimesheetPage />} />

          {/* Invoicing & Disputes */}
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/disputes" element={<DisputeListPage />} />
          <Route path="/disputes/:id" element={<DisputeDetailPage />} />

          {/* Billing Dashboard */}
          <Route path="/billing" element={<BillingDashboard />} />
          <Route path="/billing/:section" element={<BillingDashboard />} />

          {/* Snow Operations */}
          <Route path="/snow" element={<Navigate to="/snow/seasons" replace />} />
          <Route path="/snow/seasons" element={<SeasonListPage />} />
          <Route path="/snow/seasons/:seasonId/runs" element={<RunListPage />} />
          <Route path="/snow/runs/:id" element={<RunDetailPage />} />

          {/* Hardscape */}
          <Route path="/hardscape" element={<ProjectListPage />} />
          <Route path="/hardscape/:id" element={<ProjectDetailPage />} />
          <Route path="/hardscape/pipeline" element={<PipelinePage />} />

          {/* Prospects */}
          <Route path="/prospects" element={<ProspectListPage />} />
          <Route path="/prospects/:id" element={<ProspectDetailPage />} />

          {/* Resources */}
          <Route path="/equipment" element={<EquipmentListPage />} />
          <Route path="/materials" element={<MaterialListPage />} />
          <Route path="/subcontractors" element={<SubcontractorListPage />} />

          {/* SOPs */}
          <Route path="/sops" element={<TemplateListPage />} />
          <Route path="/sops/templates/:id" element={<TemplateDetailPage />} />
          <Route path="/sops/assignments" element={<AssignmentListPage />} />

          {/* Integrations */}
          <Route path="/integrations" element={<IntegrationListPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/users" element={<UserListPage />} />
          <Route path="/settings/users/:id" element={<UserDetailPage />} />

          {/* Templates */}
          <Route path="/settings/templates" element={<TemplatesPage />} />
          <Route path="/settings/templates/:tab" element={<TemplatesPage />} />

          {/* Reports */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* Notifications */}
          <Route path="/notifications" element={<NotificationPage />} />

          {/* Seasonal Transitions */}
          <Route path="/seasonal" element={<SeasonalListPage />} />
          <Route path="/seasonal/:id" element={<SeasonalDetailPage />} />

          {/* Season Setup Wizard */}
          <Route path="/season-setup/:contractId" element={<SeasonSetupWizard />} />
        </Route>

        {/* Client Portal */}
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route
          element={
            <PortalRoute>
              <PortalLayout />
            </PortalRoute>
          }
        >
          <Route path="/portal/dashboard" element={<PortalDashboardPage />} />
          <Route path="/portal/contracts" element={<PortalContractsPage />} />
          <Route path="/portal/jobs" element={<PortalJobsPage />} />
          <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
          <Route path="/portal/invoices/:id" element={<PortalInvoiceDetailPage />} />
          <Route path="/portal/properties" element={<PortalPropertiesPage />} />
          <Route path="/portal/files" element={<PortalFilesPage />} />
        </Route>

        {/* Crew Mobile PWA */}
        <Route path="/crew/login" element={<CrewLoginPage />} />
        <Route
          element={
            <CrewRoute>
              <CrewMobileLayout />
            </CrewRoute>
          }
        >
          <Route path="/crew/dashboard" element={<CrewDashboardPage />} />
          <Route path="/crew/jobs/:id" element={<CrewJobDetailPage />} />
          <Route path="/crew/timesheet" element={<CrewTimesheetPage />} />
          <Route path="/crew/profile" element={<CrewProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
