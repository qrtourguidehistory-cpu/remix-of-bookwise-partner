import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useBackButton } from "@/hooks/useBackButton";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import OnboardingFlow from "./pages/onboarding/OnboardingFlow";
import MobileCalendar from "./pages/mobile/MobileCalendar";
import MobileSales from "./pages/mobile/MobileSales";
import DailySalesSummary from "./pages/mobile/DailySalesSummary";
import BlockedClients from "./pages/mobile/BlockedClients";
import BookingFlow from "./pages/mobile/BookingFlow";
import ProfilePage from "./pages/mobile/ProfilePage";
import ReviewsPage from "./pages/mobile/ReviewsPage";
import ClientForm from "./pages/mobile/ClientForm";
import ClientList from "./pages/mobile/ClientList";
import ClientCreditsList from "./pages/mobile/ClientCreditsList";
import StaffForm from "./pages/mobile/StaffForm";
import StaffList from "./pages/mobile/StaffList";
import ServiceImageGallery from "./pages/mobile/ServiceImageGallery";
import SaleForm from "./pages/mobile/SaleForm";
import StaffScheduleManagement from "./pages/mobile/StaffScheduleManagement";
import AppointmentsManagement from "./pages/admin/AppointmentsManagement";
import StaffManagement from "./pages/admin/StaffManagement";
import ServicesManagement from "./pages/admin/ServicesManagement";
import ServiceForm from "./pages/mobile/ServiceForm";
import ClientsManagement from "./pages/admin/ClientsManagement";
import ReviewsManagement from "./pages/admin/ReviewsManagement";
import ReportsAnalytics from "./pages/admin/ReportsAnalytics";
import BusinessHoursSettings from "./pages/admin/BusinessHoursSettings";
import SettingsPage from "./pages/admin/SettingsPage";
import PaymentMethodsPage from "./pages/admin/PaymentMethodsPage";
import StaffCommissionsPage from "./pages/admin/StaffCommissionsPage";
import ThemeSettingsPage from "./pages/admin/ThemeSettingsPage";
import LocaleSettingsPage from "./pages/admin/LocaleSettingsPage";
import NotificationSettingsPage from "./pages/admin/NotificationSettingsPage";
import RolesPermissionsPage from "./pages/admin/RolesPermissionsPage";
import InventoryManagement from "./pages/admin/InventoryManagement";
import InventoryForm from "./pages/admin/InventoryForm";
import InventoryMovements from "./pages/admin/InventoryMovements";
import InventoryDashboard from "./pages/admin/InventoryDashboard";
import AppointmentConfigPage from "./pages/admin/AppointmentConfigPage";
import SMSTemplatesPage from "./pages/admin/SMSTemplatesPage";
import BusinessProfileSettings from "./pages/admin/BusinessProfileSettings";
import TemporaryClosePage from "./pages/admin/TemporaryClosePage";
import AccessibilitySettings from "./pages/admin/AccessibilitySettings";
import ClientPortal from "./pages/ClientPortal";
import SplashPage from "./pages/SplashPage";
import WelcomePage from "./pages/WelcomePage";
import RootRoute from "./components/RootRoute";
import HubDashboard from "./pages/hub/HubDashboard";
import ModerationPage from "./pages/hub/ModerationPage";

const queryClient = new QueryClient();

// Component to handle back button at the router level
function BackButtonHandler() {
  useBackButton();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <BackButtonHandler />
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<RootRoute />} />
                <Route path="/welcome" element={<WelcomePage />} />
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/signup" element={<SignupPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                
                {/* Onboarding (requires auth) */}
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <OnboardingFlow />
                    </ProtectedRoute>
                  }
                />
                
                {/* Protected Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <MobileCalendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <MobileSales />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SaleForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales/form"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SaleForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales/summary"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <DailySalesSummary />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/booking"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <BookingFlow />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/profile"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reviews"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ReviewsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/appointments"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <AppointmentsManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/appointments/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <BookingFlow />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/staff"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <StaffList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/staff/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <StaffForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/staff/edit/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <StaffForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/services"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ServicesManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/services/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ServiceForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/services/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ServiceForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ClientList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/blocked-clients"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <BlockedClients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ClientForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients/edit/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ClientForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients/credits"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ClientCreditsList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ReportsAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/schedule/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <MobileCalendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/gallery"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ServiceImageGallery />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/schedules"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <StaffScheduleManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/business-hours"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <BusinessHoursSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/temporary-close"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <TemporaryClosePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/payment-methods"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <PaymentMethodsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/commissions"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <StaffCommissionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/theme-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ThemeSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/locale-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <LocaleSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/accessibility-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <AccessibilitySettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/notification-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <NotificationSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/roles"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <RolesPermissionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <InventoryManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/dashboard"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <InventoryDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <InventoryForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/edit/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <InventoryForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/movements/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <InventoryMovements />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/appointment-config"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <AppointmentConfigPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sms-templates"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SMSTemplatesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/business-profile"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <BusinessProfileSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-portal"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <ClientPortal />
                    </ProtectedRoute>
                  }
                />

                {/* Hub Routes (Super Admin) */}
                <Route
                  path="/hub"
                  element={
                    <ProtectedRoute>
                      <HubDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hub/moderation"
                  element={
                    <ProtectedRoute>
                      <ModerationPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Catch all */}
                <Route path="*" element={<Navigate to="/auth/login" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
