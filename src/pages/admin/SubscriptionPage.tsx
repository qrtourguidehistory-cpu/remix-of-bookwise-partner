import { useState, useEffect, useCallback } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  purchaseProduct,
  verifyPremiumEntitlement,
  identifyUser,
  forceUnlockPremium,
  PREMIUM_ENTITLEMENT_ID,
} from "@/lib/revenueCatService";
import { Purchases } from "@revenuecat/purchases-capacitor";
import {
  CreditCard,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Loader2,
  Shield,
  Settings,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface RCSubscriptionInfo {
  isActive: boolean;
  priceString: string | null;
  expirationDate: string | null;
  productIdentifier: string | null;
  periodType: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rcInfo, setRcInfo] = useState<RCSubscriptionInfo | null>(null);

  // ── Fuente de verdad principal ───────────────────────────────────────────────
  // is_premium del perfil (actualizado por webhook de RevenueCat) O entitlement activo en SDK
  const isPremium = profile?.is_premium === true || rcInfo?.isActive === true;

  // ── Cargar datos de RevenueCat ───────────────────────────────────────────────
  const loadRCData = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") {
      setLoading(false);
      return;
    }

    try {
      // 1. Obtener customerInfo actual
      const { customerInfo } = await Purchases.getCustomerInfo();
      const proEntitlement = customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];

      let priceString: string | null = null;
      let expirationDate: string | null = proEntitlement?.expirationDate ?? null;
      let productIdentifier: string | null = proEntitlement?.productIdentifier ?? null;
      let periodType: string | null = (proEntitlement as any)?.periodType ?? null;

      // 2. Intentar obtener precio del offering actual
      try {
        const offerings = await Purchases.getOfferings();
        const packages = offerings?.current?.availablePackages ?? [];
        const pkgArray: any[] = Array.isArray(packages) ? packages : Object.values(packages);
        const monthly: any = pkgArray.find(
          (p: any) =>
            p.identifier === "$rc_monthly" ||
            p.packageType === "MONTHLY" ||
            p.identifier?.toLowerCase().includes("monthly")
        ) ?? pkgArray[0];

        if (monthly) {
          priceString = monthly?.storeProduct?.priceString ?? null;
          if (!productIdentifier) {
            productIdentifier = monthly?.storeProduct?.identifier ?? null;
          }
        }
      } catch (offeringsErr) {
        console.warn("[SubscriptionPage] No se pudieron cargar offerings:", offeringsErr);
      }

      setRcInfo({
        isActive: !!proEntitlement,
        priceString,
        expirationDate,
        productIdentifier,
        periodType,
      });

      console.log("[SubscriptionPage] ✅ RC data:", {
        isActive: !!proEntitlement,
        priceString,
        expirationDate,
        productIdentifier,
      });
    } catch (err: any) {
      console.warn("[SubscriptionPage] ⚠️ Error cargando RC data:", err?.message);
      // No crashear: dejar rcInfo null y confiar en profile.is_premium
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRCData();
  }, [loadRCData]);

  // ── Abrir Google Play para gestionar ─────────────────────────────────────────
  const handleManageSubscription = async () => {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({
        url: "https://play.google.com/store/account/subscriptions",
        presentationStyle: "fullscreen",
      });
    } catch (err: any) {
      console.error("[SubscriptionPage] Error abriendo Google Play:", err);
      toast({
        title: language === "es" ? "Error" : "Error",
        description:
          language === "es"
            ? "No se pudo abrir Google Play. Ábrelo manualmente desde tu dispositivo."
            : "Could not open Google Play. Open it manually from your device.",
        variant: "destructive",
      });
    }
  };


  // ── Comprar suscripción ──────────────────────────────────────────────────────
  const handlePurchase = async () => {
    if (!profile?.id) return;
    setProcessing(true);

    try {
      // 1. Identificar usuario
      try {
        await identifyUser(profile.id);
      } catch (idErr) {
        console.warn("[SubscriptionPage] identifyUser falló, continuando:", idErr);
      }

      // 2. Comprar
      const result = await purchaseProduct();

      if (result.success) {
        // 3. Esperar que Google Play cierre su modal
        await new Promise((r) => setTimeout(r, 800));
        setProcessing(false);

        // 4. Verificar entitlement en RevenueCat
        const hasPro = await verifyPremiumEntitlement(profile.id);

        if (!hasPro) {
          // ✅ UNLOCK OPTIMISTA: pago confirmado por Google Play, entitlement aún pendiente.
          // Forzar is_premium=true para desbloquear YA — el webhook confirmará luego.
          console.warn("[SubscriptionPage] ⚡ Entitlement pendiente. Aplicando unlock optimista...");
          await forceUnlockPremium(profile.id);
        }

        toast({
          title: language === "es" ? "¡Suscripción activada!" : "Subscription activated!",
          description: language === "es"
            ? "Tu suscripción premium está activa."
            : "Your premium subscription is now active.",
        });

        // 5. Refrescar estado global para que la UI se desbloquee inmediatamente
        await refreshProfile();
        await loadRCData();
        return;
      } else {
        if (result.error?.includes("cancelada") || result.error?.includes("cancelled")) {
          return; // Usuario canceló voluntariamente
        }
        toast({
          title: language === "es" ? "Error en la compra" : "Purchase error",
          description:
            result.error ??
            (language === "es"
              ? "No se pudo completar la compra."
              : "Could not complete the purchase."),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("[SubscriptionPage] ❌ Error en handlePurchase:", err);
      toast({
        title: language === "es" ? "Error" : "Error",
        description:
          err?.message ??
          (language === "es"
            ? "Ocurrió un error. Por favor, intenta de nuevo."
            : "An error occurred. Please try again."),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--bottom-nav-height))] p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            {language === "es"
              ? "Verificando suscripción..."
              : "Verifying subscription..."}
          </p>
        </div>
      </MobileLayout>
    );
  }

  // ── Render: principal ────────────────────────────────────────────────────────
  return (
    <MobileLayout>
      <div className="p-4 pb-28 max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Suscripción" : "Subscription"}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              setLoading(true);
              await refreshProfile();
              await loadRCData();
            }}
            className="ml-auto rounded-full"
            title="Refrescar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Card estado ───────────────────────────────────────────────── */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {language === "es" ? "Estado de Suscripción" : "Subscription Status"}
              </CardTitle>
              {isPremium ? (
                <Badge className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {language === "es" ? "Activa" : "Active"}
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400">
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  {language === "es" ? "Sin suscripción" : "No subscription"}
                </Badge>
              )}
            </div>
            {isPremium && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 mt-1">
                <Shield className="h-4 w-4" />
                <span className="font-medium">
                  {language === "es" ? "Acceso Premium activo" : "Premium access active"}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Plan */}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">
                {language === "es" ? "Plan" : "Plan"}
              </span>
              <span className="font-semibold capitalize">
                {rcInfo?.periodType ? rcInfo.periodType.toLowerCase() : "monthly"}
              </span>
            </div>

            {/* Precio — dinámico desde RevenueCat */}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {language === "es" ? "Tarifa Mensual" : "Monthly Fee"}
              </span>
              <span className="font-bold text-lg text-primary">
                {rcInfo?.priceString ?? "—"}
              </span>
            </div>

            {/* Próxima renovación — del entitlement */}
            {rcInfo?.expirationDate ? (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {language === "es" ? "Próxima Renovación" : "Next Renewal"}
                </span>
                <span className="font-semibold">
                  {formatDate(rcInfo.expirationDate)}
                </span>
              </div>
            ) : null}

            {/* Sin suscripción */}
            {!isPremium && (
              <p className="text-sm text-muted-foreground text-center pt-2">
                {language === "es"
                  ? "No tienes una suscripción activa."
                  : "You don't have an active subscription."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Card método de pago ────────────────────────────────────────── */}
        <Card className="shadow-md border-0">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {language === "es" ? "Método de Pago" : "Payment Method"}
            </CardTitle>
            <CardDescription className="text-sm">
              {language === "es"
                ? "Gestiona tu suscripción"
                : "Manage your subscription"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPremium ? (
              /* ── Usuario premium ── */
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="p-2 bg-card rounded-lg shadow-sm">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Google Play Store</p>
                    <p className="text-xs text-muted-foreground">
                      {language === "es"
                        ? "Pago procesado de forma segura"
                        : "Payment processed securely"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    {language === "es" ? "Activo" : "Active"}
                  </Badge>
                </div>

                {/* Gestionar suscripción */}
                <Button
                  onClick={handleManageSubscription}
                  variant="outline"
                  className="w-full h-12 rounded-xl font-semibold border-2"
                  size="lg"
                >
                  <Settings className="h-5 w-5 mr-2" />
                  {language === "es" ? "Gestionar Suscripción" : "Manage Subscription"}
                </Button>
              </div>
            ) : (
              /* ── Usuario sin suscripción ── */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {language === "es"
                    ? "Activa tu suscripción premium a través de Google Play Store."
                    : "Activate your premium subscription through Google Play Store."}
                </p>

                {Capacitor.getPlatform() === "android" ? (
                  <Button
                    onClick={handlePurchase}
                    disabled={processing}
                    className="w-full h-12 rounded-xl shadow-sm font-semibold text-base bg-black text-white hover:bg-gray-900"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {language === "es" ? "Procesando..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-5 w-5 mr-2" />
                        {language === "es"
                          ? "Suscribirse con Google Play"
                          : "Subscribe with Google Play"}
                      </>
                    )}
                  </Button>
                ) : (
                  <Alert>
                    <ShoppingBag className="h-4 w-4" />
                    <AlertTitle>
                      {language === "es"
                        ? "Disponible solo en Android"
                        : "Available on Android only"}
                    </AlertTitle>
                    <AlertDescription>
                      {language === "es"
                        ? "Las suscripciones a través de Google Play solo están disponibles en la app Android."
                        : "Subscriptions through Google Play are only available on the Android app."}
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {language === "es"
                    ? "Pago procesado de forma segura a través de Google Play Store"
                    : "Payment processed securely through Google Play Store"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </MobileLayout>
  );
}
