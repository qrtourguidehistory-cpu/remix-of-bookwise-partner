import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SplashPage from "@/pages/SplashPage";
import MobileCalendar from "@/pages/mobile/MobileCalendar";
import ProtectedRoute from "@/components/ProtectedRoute";

// Root route handler - shows SplashPage if not authenticated, Calendar if authenticated
export default function RootRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashPage shouldRedirect={false} />;
  }

  if (isAuthenticated) {
    // Pass explicit key to force re-render on auth change but not loop
    return (
      <ProtectedRoute requireOnboarding key="protected-calendar">
        <MobileCalendar />
      </ProtectedRoute>
    );
  }

  return <SplashPage />;
}

