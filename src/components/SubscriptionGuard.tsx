import { useEffect } from "react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import Paywall from "./Paywall";
import { Loader2 } from "lucide-react";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { status, isLoading } = useSubscriptionStatus();

  // Log para debugging
  useEffect(() => {
    console.log('🔒 SubscriptionGuard - Status:', status, 'Loading:', isLoading);
  }, [status, isLoading]);

  // Mostrar loading mientras se verifica la suscripción
  if (isLoading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si la suscripción no está activa, mostrar el paywall
  // Permitir también 'trialing' para usuarios en periodo de prueba
  if (status !== 'active' && status !== 'trialing') {
    return <Paywall />;
  }

  // Si la suscripción está activa, permitir acceso
  return <>{children}</>;
}

