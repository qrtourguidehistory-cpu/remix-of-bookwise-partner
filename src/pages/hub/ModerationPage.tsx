import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  MapPin,
  Phone,
  Image,
  Globe,
  AlertTriangle,
  Eye,
  Loader2,
  ExternalLink,
  Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import HubLayout from "@/components/hub/HubLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface ApprovalRequest {
  id: string;
  business_id: string;
  owner_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  business: {
    id: string;
    business_name: string;
    description: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    phone: string | null;
    address: string | null;
    primary_category: string | null;
    google_maps_url: string | null;
    approval_status: string;
    is_public: boolean;
  };
  owner: {
    email: string;
    full_name: string | null;
  } | null;
}

export default function ModerationPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      console.log("🔍 Fetching approval requests...");
      
      const { data, error } = await supabase
        .from("business_approval_requests")
        .select(`
          id,
          business_id,
          owner_id,
          status,
          submitted_at,
          reviewed_at,
          reviewed_by,
          rejection_reason,
          notes,
          businesses:business_id (
            id,
            business_name,
            description,
            logo_url,
            cover_image_url,
            phone,
            address,
            primary_category,
            google_maps_url,
            approval_status,
            is_public
          )
        `)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching approval requests:", error);
        throw error;
      }

      console.log("✅ Approval requests fetched:", data?.length || 0, "requests");
      console.log("📊 Raw data:", data);

      // If businesses relation didn't work, fetch them separately
      const requestsWithBusinesses = await Promise.all(
        (data || []).map(async (req: any) => {
          let businessData = req.businesses;
          
          // If business relation is null or missing, fetch it separately
          if (!businessData && req.business_id) {
            console.log("⚠️ Business relation missing, fetching separately for:", req.business_id);
            const { data: business, error: businessError } = await supabase
              .from("businesses")
              .select("id, business_name, description, logo_url, cover_image_url, phone, address, primary_category, google_maps_url, approval_status, is_public")
              .eq("id", req.business_id)
              .single();
            
            if (businessError) {
              console.error("❌ Error fetching business:", businessError);
            } else {
              businessData = business;
            }
          }
          
          const { data: ownerData, error: ownerError } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", req.owner_id)
            .single();
          
          if (ownerError) {
            console.warn("⚠️ Error fetching owner for request", req.id, ownerError);
          }
          
          // Get email from auth.users is not possible client-side, so we use profile
          return {
            ...req,
            business: businessData || null,
            owner: ownerData ? { full_name: ownerData.full_name, email: "" } : null,
          };
        })
      );

      console.log("✅ Processed requests:", requestsWithBusinesses);
      setRequests(requestsWithBusinesses);
    } catch (error: any) {
      console.error("❌ Error fetching approval requests:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? `No se pudieron cargar las solicitudes: ${error?.message || "Error desconocido"}` 
          : `Could not load requests: ${error?.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: ApprovalRequest) => {
    setProcessing(true);
    try {
      // Actualizar la solicitud de aprobación
      const { error: requestError } = await supabase
        .from("business_approval_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Actualizar el negocio para marcarlo como aprobado y público
      // Esto activará el trigger que crea la suscripción de trial
      const { error: businessError } = await supabase
        .from("businesses")
        .update({
          approval_status: "approved",
          is_public: true,
        })
        .eq("id", request.business_id);

      if (businessError) throw businessError;

      // Enviar notificación al propietario del negocio (solo una vez)
      // Verificar si ya se envió una notificación para esta aprobación
      const { data: existingNotification } = await supabase
        .from("client_notifications")
        .select("id")
        .eq("user_id", request.owner_id)
        .eq("business_id", request.business_id)
        .eq("type", "business_approved")
        .eq("read", false)
        .maybeSingle();

      if (!existingNotification) {
        const { error: notificationError } = await supabase
          .from("client_notifications")
          .insert({
            user_id: request.owner_id,
            business_id: request.business_id,
            type: "business_approved",
            title: language === "es" ? "¡Tu negocio ha sido aprobado!" : "Your business has been approved!",
            message: language === "es" 
              ? "Tu solicitud de publicación ha sido aprobada. Tu negocio ahora es visible en Mí Turnow Client y se ha iniciado un período de prueba de 30 días."
              : "Your publication request has been approved. Your business is now visible on Mí Turnow Client and a 30-day trial period has started.",
            role: "partner",
          });

        if (notificationError) {
          console.error("Error sending notification:", notificationError);
          // No fallar si la notificación falla
        }
      }

      toast({
        title: language === "es" ? "¡Aprobado!" : "Approved!",
        description: language === "es" 
          ? "El negocio ha sido aprobado y ahora es visible en Mí Turnow Client. Se ha iniciado un período de prueba de 30 días."
          : "The business has been approved and is now visible on Mí Turnow Client. A 30-day trial period has started.",
      });

      fetchRequests();
      setReviewDialogOpen(false);
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo aprobar la solicitud" 
          : "Could not approve request",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: ApprovalRequest) => {
    if (!rejectionReason.trim()) {
      toast({
        title: language === "es" ? "Motivo requerido" : "Reason required",
        description: language === "es" 
          ? "Por favor proporciona un motivo de rechazo"
          : "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("business_approval_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      // Actualizar el negocio para marcarlo como rechazado
      const { error: businessError } = await supabase
        .from("businesses")
        .update({
          approval_status: "rejected",
          is_public: false,
        })
        .eq("id", request.business_id);

      if (businessError) throw businessError;

      // Enviar notificación al propietario del negocio (solo una vez)
      const { data: existingNotification } = await supabase
        .from("client_notifications")
        .select("id")
        .eq("user_id", request.owner_id)
        .eq("business_id", request.business_id)
        .eq("type", "business_rejected")
        .eq("read", false)
        .maybeSingle();

      if (!existingNotification) {
        const { error: notificationError } = await supabase
          .from("client_notifications")
          .insert({
            user_id: request.owner_id,
            business_id: request.business_id,
            type: "business_rejected",
            title: language === "es" ? "Solicitud rechazada" : "Request rejected",
            message: language === "es" 
              ? `Tu solicitud de publicación ha sido rechazada. Motivo: ${rejectionReason}. Por favor, corrige los problemas y envía una nueva solicitud.`
              : `Your publication request has been rejected. Reason: ${rejectionReason}. Please fix the issues and submit a new request.`,
            role: "partner",
          });

        if (notificationError) {
          console.error("Error sending notification:", notificationError);
        }
      }

      toast({
        title: language === "es" ? "Rechazado" : "Rejected",
        description: language === "es" 
          ? "La solicitud ha sido rechazada y se notificó al propietario"
          : "The request has been rejected and the owner was notified",
      });

      setRejectionReason("");
      fetchRequests();
      setReviewDialogOpen(false);
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo rechazar la solicitud" 
          : "Could not reject request",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspend = async (request: ApprovalRequest) => {
    setProcessing(true);
    try {
      // Update business to suspended
      const { error: businessError } = await supabase
        .from("businesses")
        .update({
          approval_status: "suspended",
          is_public: false,
        })
        .eq("id", request.business_id);

      if (businessError) throw businessError;

      toast({
        title: language === "es" ? "Suspendido" : "Suspended",
        description: language === "es" 
          ? "El negocio ha sido suspendido"
          : "The business has been suspended",
      });

      fetchRequests();
      setReviewDialogOpen(false);
    } catch (error) {
      console.error("Error suspending business:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo suspender el negocio" 
          : "Could not suspend business",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setReviewDialogOpen(true);
  };

  const openPreviewDialog = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setPreviewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <Clock className="h-3 w-3 mr-1" />
            {language === "es" ? "Pendiente" : "Pending"}
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            {language === "es" ? "Aprobado" : "Approved"}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {language === "es" ? "Rechazado" : "Rejected"}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(language === "es" ? "es-ES" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const reviewedRequests = requests.filter(r => r.status !== "pending");

  const RequirementCheck = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 ${met ? "text-green-600" : "text-red-600"}`}>
      {met ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span className="text-sm">{label}</span>
    </div>
  );

  const RequestCard = ({ request }: { request: ApprovalRequest }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="shrink-0">
            {request.business?.logo_url ? (
              <img
                src={request.business.logo_url}
                alt="Logo"
                className="h-16 w-16 rounded-lg object-cover border"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold truncate">
                  {request.business?.business_name || "Sin nombre"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {request.business?.primary_category || "Sin categoría"}
                </p>
              </div>
              {getStatusBadge(request.status)}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(request.submitted_at)}
              </div>
              {request.business?.address && (
                <div className="flex items-center gap-1 text-muted-foreground truncate">
                  <MapPin className="h-3 w-3" />
                  {request.business.address.substring(0, 30)}...
                </div>
              )}
            </div>

            {/* Quick requirements check */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={request.business?.logo_url ? "default" : "secondary"} className="text-xs">
                <Image className="h-3 w-3 mr-1" />
                Logo
              </Badge>
              <Badge variant={request.business?.cover_image_url ? "default" : "secondary"} className="text-xs">
                <Image className="h-3 w-3 mr-1" />
                Cover
              </Badge>
              <Badge variant={request.business?.phone ? "default" : "secondary"} className="text-xs">
                <Phone className="h-3 w-3 mr-1" />
                Phone
              </Badge>
              <Badge variant={request.business?.address ? "default" : "secondary"} className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                Address
              </Badge>
              <Badge variant={request.business?.google_maps_url ? "default" : "secondary"} className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Maps
              </Badge>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPreviewDialog(request)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {language === "es" ? "Ver detalles" : "View details"}
              </Button>
              {request.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => openReviewDialog(request)}
                >
                  {language === "es" ? "Revisar" : "Review"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <HubLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Moderación" : "Moderation"}
          </h1>
          <p className="text-muted-foreground">
            {language === "es" 
              ? "Revisa y aprueba solicitudes de publicación de negocios"
              : "Review and approve business publication requests"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              {language === "es" ? "Pendientes" : "Pending"}
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviewed">
              {language === "es" ? "Revisadas" : "Reviewed"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="font-semibold text-lg">
                    {language === "es" ? "¡Todo al día!" : "All caught up!"}
                  </h3>
                  <p className="text-muted-foreground">
                    {language === "es" 
                      ? "No hay solicitudes pendientes de revisión"
                      : "No pending requests to review"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviewed" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reviewedRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">
                    {language === "es" ? "Sin historial" : "No history"}
                  </h3>
                  <p className="text-muted-foreground">
                    {language === "es" 
                      ? "No hay solicitudes revisadas aún"
                      : "No reviewed requests yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {reviewedRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === "es" ? "Revisar solicitud" : "Review request"}
              </DialogTitle>
              <DialogDescription>
                {language === "es" 
                  ? "Revisa los detalles del negocio y decide si aprobar o rechazar"
                  : "Review the business details and decide whether to approve or reject"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6">
                {/* Business Info */}
                <div className="flex items-start gap-4">
                  {selectedRequest.business?.logo_url ? (
                    <img
                      src={selectedRequest.business.logo_url}
                      alt="Logo"
                      className="h-20 w-20 rounded-lg object-cover border"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedRequest.business?.business_name}
                    </h3>
                    <p className="text-muted-foreground">
                      {selectedRequest.business?.primary_category}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRequest.business?.description || "Sin descripción"}
                    </p>
                  </div>
                </div>

                {/* Cover Image */}
                {selectedRequest.business?.cover_image_url && (
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      {language === "es" ? "Imagen de portada" : "Cover image"}
                    </Label>
                    <img
                      src={selectedRequest.business.cover_image_url}
                      alt="Cover"
                      className="w-full h-32 object-cover rounded-lg mt-2"
                    />
                  </div>
                )}

                {/* Requirements Check */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    {language === "es" ? "Requisitos" : "Requirements"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                    <RequirementCheck 
                      met={!!selectedRequest.business?.logo_url}
                      label={language === "es" ? "Logo del negocio" : "Business logo"}
                    />
                    <RequirementCheck 
                      met={!!selectedRequest.business?.cover_image_url}
                      label={language === "es" ? "Imagen de portada" : "Cover image"}
                    />
                    <RequirementCheck 
                      met={!!selectedRequest.business?.phone}
                      label={language === "es" ? "Teléfono" : "Phone"}
                    />
                    <RequirementCheck 
                      met={!!selectedRequest.business?.address}
                      label={language === "es" ? "Dirección" : "Address"}
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      {language === "es" ? "Teléfono" : "Phone"}
                    </Label>
                    <p className="font-medium">
                      {selectedRequest.business?.phone || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      {language === "es" ? "Dirección" : "Address"}
                    </Label>
                    <p className="font-medium">
                      {selectedRequest.business?.address || "-"}
                    </p>
                  </div>
                </div>

                {/* Google Maps Link */}
                {selectedRequest.business?.google_maps_url && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Google Maps</Label>
                    <a
                      href={selectedRequest.business.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      {language === "es" ? "Ver en mapa" : "View on map"}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}

                {/* Rejection reason input */}
                <div>
                  <Label htmlFor="rejectionReason">
                    {language === "es" 
                      ? "Motivo de rechazo (requerido para rechazar)"
                      : "Rejection reason (required to reject)"}
                  </Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={language === "es" 
                      ? "Describe el motivo del rechazo para que el propietario pueda corregirlo..."
                      : "Describe the rejection reason so the owner can fix it..."}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setReviewDialogOpen(false)}
                disabled={processing}
              >
                {language === "es" ? "Cancelar" : "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedRequest && handleReject(selectedRequest)}
                disabled={processing || !rejectionReason.trim()}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <XCircle className="h-4 w-4 mr-2" />
                {language === "es" ? "Rechazar" : "Reject"}
              </Button>
              <Button
                onClick={() => selectedRequest && handleApprove(selectedRequest)}
                disabled={processing}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <CheckCircle className="h-4 w-4 mr-2" />
                {language === "es" ? "Aprobar" : "Approve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {language === "es" ? "Detalles del negocio" : "Business details"}
              </DialogTitle>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                {/* Cover */}
                {selectedRequest.business?.cover_image_url && (
                  <img
                    src={selectedRequest.business.cover_image_url}
                    alt="Cover"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}

                <div className="flex items-start gap-4">
                  {selectedRequest.business?.logo_url ? (
                    <img
                      src={selectedRequest.business.logo_url}
                      alt="Logo"
                      className="h-16 w-16 rounded-full object-cover border-4 border-background -mt-8 relative z-10"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-4 border-background -mt-8 relative z-10">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="pt-2">
                    <h3 className="font-semibold">
                      {selectedRequest.business?.business_name}
                    </h3>
                    <Badge variant="secondary">
                      {selectedRequest.business?.primary_category}
                    </Badge>
                  </div>
                </div>

                {selectedRequest.business?.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.business.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {selectedRequest.business?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedRequest.business.phone}
                    </div>
                  )}
                  {selectedRequest.business?.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {selectedRequest.business.address}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    {language === "es" ? "Enviada: " : "Submitted: "}
                    {formatDate(selectedRequest.submitted_at)}
                  </p>
                  {selectedRequest.status !== "pending" && selectedRequest.reviewed_at && (
                    <p className="text-xs text-muted-foreground">
                      {language === "es" ? "Revisada: " : "Reviewed: "}
                      {formatDate(selectedRequest.reviewed_at)}
                    </p>
                  )}
                  {selectedRequest.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      <strong>{language === "es" ? "Motivo de rechazo:" : "Rejection reason:"}</strong>
                      <p>{selectedRequest.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                {language === "es" ? "Cerrar" : "Close"}
              </Button>
              {selectedRequest?.status === "approved" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    openReviewDialog(selectedRequest);
                  }}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  {language === "es" ? "Suspender" : "Suspend"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </HubLayout>
  );
}

