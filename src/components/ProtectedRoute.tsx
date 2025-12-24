import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export default function ProtectedRoute({ children, requireOnboarding = false }: ProtectedRouteProps) {
  const { isAuthenticated, loading, profile } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // If onboarding is NOT required (e.g., user is on /onboarding page)
  // Check if they already have business_id and redirect to admin if so
  if (!requireOnboarding) {
    // If profile exists and has business_id, they already completed onboarding
    if (profile?.business_id) {
      return <Navigate to="/admin" replace />;
    }
    // If no business_id, allow access to onboarding
    return <>{children}</>;
  }

  // If onboarding IS required (protected routes like /admin)
  // Check if user needs to complete onboarding
  if (requireOnboarding) {
    // If profile exists but has no business_id, redirect to onboarding
    if (profile && !profile.business_id) {
      return <Navigate to="/onboarding" replace />;
    }
    // If profile is null but we're past loading, also redirect to onboarding
    // (user needs to complete onboarding to get a profile with business_id)
    if (!profile) {
      return <Navigate to="/onboarding" replace />;
    }
    // If business_id exists, allow access (onboarding is done)
  }

  // Allow access to children
  return <>{children}</>;
}
