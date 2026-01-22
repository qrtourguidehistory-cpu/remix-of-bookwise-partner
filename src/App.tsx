import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useBackButton } from "@/hooks/useBackButton";
import { usePaymentDeepLink } from "@/hooks/usePaymentDeepLink";
import ProtectedRoute from "@/components/ProtectedRoute";
import SubscriptionGuard from "@/components/SubscriptionGuard";
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
import SubscriptionPage from "./pages/admin/SubscriptionPage";
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
import PermissionsSettingsPage from "./pages/admin/PermissionsSettingsPage";
import DeleteAccountPage from "./pages/admin/DeleteAccountPage";
import ClientPortal from "./pages/ClientPortal";
import WelcomePage from "./pages/WelcomePage";
import RootRoute from "./components/RootRoute";
import HubDashboard from "./pages/hub/HubDashboard";
import ModerationPage from "./pages/hub/ModerationPage";
import SubscriptionsPage from "./pages/hub/SubscriptionsPage";

const queryClient = new QueryClient();

// Component to handle back button and payment deep links at the router level
function BackButtonHandler() {
  useBackButton();
  usePaymentDeepLink();
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
                      <SubscriptionGuard>
                        <MobileCalendar />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <MobileSales />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <SaleForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales/form"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <SaleForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales/summary"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <DailySalesSummary />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/booking"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <BookingFlow />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/profile"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ProfilePage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reviews"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ReviewsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/appointments"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <AppointmentsManagement />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/appointments/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <BookingFlow />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/staff"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <StaffList />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/staff/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <StaffForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/staff/edit/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <StaffForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/services"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ServicesManagement />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/services/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ServiceForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/services/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ServiceForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ClientList />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/blocked-clients"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <BlockedClients />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ClientForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients/edit/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ClientForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients/credits"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ClientCreditsList />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ReportsAnalytics />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/schedule/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <MobileCalendar />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/gallery"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ServiceImageGallery />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/schedules"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <StaffScheduleManagement />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/business-hours"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <BusinessHoursSettings />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/temporary-close"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <TemporaryClosePage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <SettingsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/payment-methods"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <PaymentMethodsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/commissions"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <StaffCommissionsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/subscription"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/theme-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ThemeSettingsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/locale-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <LocaleSettingsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/accessibility-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <AccessibilitySettings />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/notification-settings"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <NotificationSettingsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/roles"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <RolesPermissionsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <InventoryManagement />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/dashboard"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <InventoryDashboard />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/new"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <InventoryForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/edit/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <InventoryForm />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory/movements/:id"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <InventoryMovements />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/appointment-config"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <AppointmentConfigPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sms-templates"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <SMSTemplatesPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/business-profile"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <BusinessProfileSettings />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/permissions"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <PermissionsSettingsPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/delete-account"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <DeleteAccountPage />
                      </SubscriptionGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-portal"
                  element={
                    <ProtectedRoute requireOnboarding>
                      <SubscriptionGuard>
                        <ClientPortal />
                      </SubscriptionGuard>
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
                <Route
                  path="/hub/subscriptions"
                  element={
                    <ProtectedRoute>
                      <SubscriptionsPage />
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
