import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
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
import JobDetailPage from './pages/jobs/JobDetailPage';
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
import ReportsPage from './pages/reports/ReportsPage';
import NotificationPage from './pages/notifications/NotificationPage';
import SeasonalListPage from './pages/seasonal/SeasonalListPage';
import SeasonalDetailPage from './pages/seasonal/SeasonalDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

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
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/schedule" element={<SchedulePage />} />

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

          {/* Snow Operations */}
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

          {/* Reports */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* Notifications */}
          <Route path="/notifications" element={<NotificationPage />} />

          {/* Seasonal Transitions */}
          <Route path="/seasonal" element={<SeasonalListPage />} />
          <Route path="/seasonal/:id" element={<SeasonalDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
