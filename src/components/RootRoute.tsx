import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MobileCalendar from "@/pages/mobile/MobileCalendar";
import ProtectedRoute from "@/components/ProtectedRoute";

// Root route handler - redirects to WelcomePage if not authenticated, Calendar if authenticated
export default function RootRoute() {
  const { isAuthenticated, loading } = useAuth();

  // Show minimal loading state while checking auth
  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="text-2xl font-bold text-primary">Mí Turnow</div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <ProtectedRoute requireOnboarding key="protected-calendar">
        <MobileCalendar />
      </ProtectedRoute>
    );
  }

  // Redirect directly to welcome page instead of showing splash
  return <Navigate to="/welcome" replace />;
}

