import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, UserPlus, Edit, Trash2, Receipt, Calendar, Mail, Phone, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

interface ClientCredit {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  appointment_id: string;
  client_id: string | null;
  clients: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  appointments: {
    id: string;
    date: string | null;
    appointment_date: string | null;
    start_time: string | null;
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    services: {
      name: string;
    } | null;
  } | null;
}

export default function ClientList() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [showCredits, setShowCredits] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);

  useEffect(() => {
    if (profile?.business_id) {
      fetchClients();
      if (showCredits) {
        fetchCredits();
      }
    }
  }, [profile?.business_id, showCredits]);

  const fetchClients = async () => {
    if (!profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("full_name");
    if (!error && data) {
      setClients(data);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchCredits = async () => {
    if (!profile?.business_id) return;
    
    setLoadingCredits(true);
    try {
      const { data, error } = await supabase
        .from("client_credits")
        .select(`
          *,
          clients!client_credits_client_id_fkey(id, full_name, email, phone),
          appointments!client_credits_appointment_id_fkey(
            id,
            date,
            appointment_date,
            start_time,
            client_name,
            client_email,
            client_phone,
            services!appointments_service_id_fkey(name)
          )
        `)
        .eq("business_id", profile.business_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setCredits((data || []) as any);
    } catch (error: any) {
      console.error("Error fetching credits:", error);
      toast.error(language === "es" ? "Error al cargar créditos" : "Error loading credits");
    } finally {
      setLoadingCredits(false);
    }
  };

  const handleMarkAsPaid = async (creditId: string) => {
    if (!profile?.business_id) return;
    
    try {
      const { error } = await supabase
        .from("client_credits")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", creditId)
        .eq("business_id", profile.business_id);

      if (error) throw error;

      toast.success(language === "es" ? "Crédito marcado como pagado" : "Credit marked as paid");
      fetchCredits();
    } catch (error: any) {
      console.error("Error marking credit as paid:", error);
      toast.error(language === "es" ? "Error al marcar como pagado" : "Error marking as paid");
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !profile?.business_id) return;
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", deleteId)
      .eq("business_id", profile.business_id);
    
    if (!error) {
      toast.success(t("clientDeleted") || "Cliente eliminado");
      fetchClients();
    } else {
      toast.error("Error deleting client");
    }
    setDeleteId(null);
  };

  // Group credits by client
  const creditsByClient = credits.reduce((acc, credit) => {
    const clientId = credit.client_id || credit.appointments?.client_name || "unknown";
    if (!acc[clientId]) {
      acc[clientId] = {
        clientId: credit.client_id,
        clientName: credit.clients?.full_name || credit.appointments?.client_name || (language === "es" ? "Cliente" : "Client"),
        clientEmail: credit.clients?.email || credit.appointments?.client_email || "",
        clientPhone: credit.clients?.phone || credit.appointments?.client_phone || "",
        credits: [],
        totalAmount: 0,
      };
    }
    acc[clientId].credits.push(credit);
    acc[clientId].totalAmount += Number(credit.amount || 0);
    return acc;
  }, {} as Record<string, {
    clientId: string | null;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    credits: ClientCredit[];
    totalAmount: number;
  }>);

  const totalPending = Object.values(creditsByClient).reduce((sum, client) => sum + client.totalAmount, 0);

  const filteredCredits = credits.filter((credit) => {
    const clientName = credit.clients?.full_name || credit.appointments?.client_name || "";
    const clientEmail = credit.clients?.email || credit.appointments?.client_email || "";
    const searchLower = searchQuery.toLowerCase();
    return (
      clientName.toLowerCase().includes(searchLower) ||
      clientEmail.toLowerCase().includes(searchLower)
    );
  });

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("clients")}</h1>
          <Button onClick={() => navigate("/admin/clients/new")}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("newClient")}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <Button
            variant={!showCredits ? "default" : "ghost"}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            onClick={() => setShowCredits(false)}
          >
            {language === "es" ? "Clientes" : "Clients"}
          </Button>
          <Button
            variant={showCredits ? "default" : "ghost"}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            onClick={() => {
              setShowCredits(true);
              fetchCredits();
            }}
          >
            <Receipt className="h-4 w-4 mr-2" />
            {language === "es" ? "Clientes a Crédito" : "Client Credits"}
            {totalPending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {Object.keys(creditsByClient).length}
              </Badge>
            )}
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={showCredits 
              ? (language === "es" ? "Buscar cliente..." : "Search client...")
              : (t("search") || "Buscar...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {showCredits ? (
          <>
            {/* Summary Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === "es" ? "Resumen" : "Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === "es" ? "Total pendiente" : "Total pending"}
                    </p>
                    <p className="text-2xl font-bold">DOP {totalPending.toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {language === "es" ? "Clientes" : "Clients"}
                    </p>
                    <p className="text-2xl font-bold">{Object.keys(creditsByClient).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingCredits ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "es" ? "Cargando..." : "Loading..."}
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "es" 
                  ? "No hay clientes con créditos pendientes" 
                  : "No clients with pending credits"}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.values(creditsByClient).map((clientGroup, index) => (
                  <Card key={index} className="border-l-4 border-l-orange-500">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {clientGroup.clientName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{clientGroup.clientName}</CardTitle>
                          {clientGroup.clientEmail && (
                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-1">
                              <Mail className="h-3 w-3" />
                              {clientGroup.clientEmail}
                            </p>
                          )}
                          {clientGroup.clientPhone && (
                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {clientGroup.clientPhone}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="text-sm">
                            DOP {clientGroup.totalAmount.toFixed(0)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {clientGroup.credits.length} {language === "es" ? "crédito(s)" : "credit(s)"}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {clientGroup.credits.map((credit) => (
                          <div key={credit.id} className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Receipt className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {credit.appointments?.services?.name || (language === "es" ? "Servicio" : "Service")}
                                  </span>
                                </div>
                                {credit.appointments?.date && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(
                                      new Date(credit.appointments.date || credit.appointments.appointment_date || credit.created_at),
                                      "EEE, d MMM yyyy",
                                      { locale: language === "es" ? es : undefined }
                                    )}
                                  </div>
                                )}
                                {credit.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{credit.notes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">DOP {Number(credit.amount || 0).toFixed(0)}</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 text-xs"
                                  onClick={() => handleMarkAsPaid(credit.id)}
                                >
                                  {language === "es" ? "Marcar pagado" : "Mark paid"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
            <div key={client.id} className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src="" />
                  <AvatarFallback>{client.full_name?.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{client.full_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                  <p className="text-sm text-muted-foreground">{client.phone}</p>
                  <Badge variant="secondary" className="mt-2">
                    {client.total_bookings || 0} {t("appointments") || "citas"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/clients/edit/${client.id}`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(client.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteClient")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteClientConfirm") || "¿Está seguro de que desea eliminar este cliente?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                {t("delete") || "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}
