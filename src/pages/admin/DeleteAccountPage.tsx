import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, AlertTriangle, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, differenceInDays, differenceInHours } from "date-fns";
import { es, enUS } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRMATION_TEXT = "ELIMINAR MI CUENTA";
const DELETION_DAYS = 7;

interface DeletionRequest {
  id: string;
  scheduled_for: string;
  status: string;
}

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [existingRequest, setExistingRequest] = useState<DeletionRequest | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    checkExistingRequest();
  }, [user?.id]);

  const checkExistingRequest = async () => {
    if (!user?.id) return;
    
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from("account_deletion_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setExistingRequest(data);
      } else {
        setExistingRequest(null);
      }
    } catch (error) {
      setExistingRequest(null);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user?.id) return;
    
    if (confirmText !== CONFIRMATION_TEXT) {
      toast.error(
        language === "es" 
          ? "Por favor escribe el texto de confirmación exactamente" 
          : "Please type the confirmation text exactly"
      );
      return;
    }

    setLoading(true);
    try {
      const scheduledFor = addDays(new Date(), DELETION_DAYS);

      const { error } = await supabase
        .from("account_deletion_requests")
        .insert({
          user_id: user.id,
          business_id: profile?.business_id,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending"
        });

      if (error) throw error;

      toast.success(
        language === "es"
          ? `Solicitud de eliminación programada para el ${format(scheduledFor, "PPP", { locale: es })}`
          : `Deletion scheduled for ${format(scheduledFor, "PPP", { locale: enUS })}`
      );
      
      setConfirmText("");
      setShowConfirmDialog(false);
      await checkExistingRequest();
    } catch (error: any) {
      console.error("Error requesting deletion:", error);
      toast.error(error.message || (language === "es" ? "Error al solicitar eliminación" : "Error requesting deletion"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!existingRequest) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("account_deletion_requests")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString()
        })
        .eq("id", existingRequest.id);

      if (error) throw error;

      toast.success(
        language === "es"
          ? "Solicitud de eliminación cancelada"
          : "Deletion request cancelled"
      );
      
      setExistingRequest(null);
    } catch (error: any) {
      console.error("Error cancelling deletion:", error);
      toast.error(error.message || (language === "es" ? "Error al cancelar" : "Error cancelling"));
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = () => {
    if (!existingRequest) return "";
    
    const scheduledDate = new Date(existingRequest.scheduled_for);
    const now = new Date();
    const daysLeft = differenceInDays(scheduledDate, now);
    const hoursLeft = differenceInHours(scheduledDate, now) % 24;

    if (daysLeft > 0) {
      return language === "es"
        ? `${daysLeft} días y ${hoursLeft} horas`
        : `${daysLeft} days and ${hoursLeft} hours`;
    }
    return language === "es"
      ? `${hoursLeft} horas`
      : `${hoursLeft} hours`;
  };

  if (checkingStatus) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-destructive">
              {language === "es" ? "Eliminar Cuenta" : "Delete Account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === "es" 
                ? "Esta acción es irreversible" 
                : "This action is irreversible"
              }
            </p>
          </div>
        </div>

        {existingRequest ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-destructive">
                    {language === "es" 
                      ? "Eliminación Programada" 
                      : "Deletion Scheduled"
                    }
                  </CardTitle>
                  <CardDescription>
                    {language === "es"
                      ? `Tu cuenta será eliminada el ${format(new Date(existingRequest.scheduled_for), "PPP 'a las' p", { locale: es })}`
                      : `Your account will be deleted on ${format(new Date(existingRequest.scheduled_for), "PPP 'at' p", { locale: enUS })}`
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background rounded-lg border">
                <p className="text-lg font-semibold text-center">
                  {language === "es" ? "Tiempo restante:" : "Time remaining:"}
                </p>
                <p className="text-2xl font-bold text-center text-destructive">
                  {getRemainingTime()}
                </p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {language === "es"
                    ? "Se eliminarán permanentemente:"
                    : "Will be permanently deleted:"
                  }
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{language === "es" ? "Tu perfil y datos personales" : "Your profile and personal data"}</li>
                  <li>{language === "es" ? "Tu negocio y configuración" : "Your business and settings"}</li>
                  <li>{language === "es" ? "Todas las citas históricas" : "All historical appointments"}</li>
                  <li>{language === "es" ? "Clientes y servicios" : "Clients and services"}</li>
                  <li>{language === "es" ? "Datos del personal" : "Staff data"}</li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancelDeletion}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {language === "es" ? "Cancelar Eliminación" : "Cancel Deletion"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-destructive/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <div>
                    <CardTitle>
                      {language === "es" ? "Advertencia" : "Warning"}
                    </CardTitle>
                    <CardDescription>
                      {language === "es"
                        ? "Esta acción eliminará permanentemente tu cuenta y todos los datos asociados."
                        : "This action will permanently delete your account and all associated data."
                      }
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    {language === "es"
                      ? "Al eliminar tu cuenta, se borrarán permanentemente:"
                      : "By deleting your account, the following will be permanently removed:"
                    }
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>{language === "es" ? "Tu perfil y datos personales" : "Your profile and personal data"}</li>
                    <li>{language === "es" ? "Tu negocio y toda su configuración" : "Your business and all its settings"}</li>
                    <li>{language === "es" ? "Historial de citas" : "Appointment history"}</li>
                    <li>{language === "es" ? "Lista de clientes" : "Client list"}</li>
                    <li>{language === "es" ? "Servicios configurados" : "Configured services"}</li>
                    <li>{language === "es" ? "Datos del personal" : "Staff data"}</li>
                    <li>{language === "es" ? "Ventas e inventario" : "Sales and inventory"}</li>
                  </ul>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    {language === "es"
                      ? `Después de solicitar la eliminación, tendrás ${DELETION_DAYS} días para cancelarla. Pasado ese tiempo, los datos serán eliminados definitivamente.`
                      : `After requesting deletion, you'll have ${DELETION_DAYS} days to cancel. After that, the data will be permanently deleted.`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === "es" ? "Confirmar Eliminación" : "Confirm Deletion"}
                </CardTitle>
                <CardDescription>
                  {language === "es"
                    ? `Escribe "${CONFIRMATION_TEXT}" para continuar`
                    : `Type "${CONFIRMATION_TEXT}" to continue`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="confirmText">
                    {language === "es" ? "Texto de confirmación" : "Confirmation text"}
                  </Label>
                  <Input
                    id="confirmText"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRMATION_TEXT}
                    className="mt-1"
                  />
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={confirmText !== CONFIRMATION_TEXT}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {language === "es" ? "Solicitar Eliminación" : "Request Deletion"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                {language === "es" 
                  ? "¿Estás completamente seguro?" 
                  : "Are you absolutely sure?"
                }
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === "es"
                  ? `Tu cuenta será eliminada en ${DELETION_DAYS} días. Podrás cancelar durante ese período, pero después la eliminación será permanente e irreversible.`
                  : `Your account will be deleted in ${DELETION_DAYS} days. You can cancel during that period, but after that the deletion will be permanent and irreversible.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {language === "es" ? "Cancelar" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRequestDeletion}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {language === "es" ? "Sí, eliminar mi cuenta" : "Yes, delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}
