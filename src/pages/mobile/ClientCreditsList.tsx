import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Receipt, ArrowLeft, CreditCard, DollarSign, ChevronRight, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { AppointmentDetailView } from "@/components/mobile/AppointmentDetailView";

interface ClientCredit {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  appointment_id: string | null;
  client_id: string | null;
  clients?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
  appointments?: {
    id: string;
    appointment_date: string;
    client_name: string | null;
    guest_name: string | null;
    user_id: string | null;
    start_time: string;
    end_time: string;
    services?: {
      name: string;
    } | null;
    staff?: {
      full_name: string;
    } | null;
    businesses?: {
      business_name: string;
      address: string | null;
    } | null;
  } | null;
}

export default function ClientCreditsList() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [reserverNames, setReserverNames] = useState<Record<string, string>>({});

  const dateLocale = language === "es" ? es : enUS;

  useEffect(() => {
    loadCredits();
  }, [profile?.business_id]);

  const loadCredits = async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_credits")
        .select(`
          *,
          clients (id, full_name, email, phone),
          appointments!appointment_id (
            id, 
            appointment_date, 
            client_name,
            guest_name,
            user_id,
            start_time,
            end_time,
            services!appointments_service_id_fkey (name),
            staff!appointments_staff_id_fkey (full_name),
            businesses!appointments_business_id_fkey (business_name, address)
          )
        `)
        .eq("business_id", profile.business_id)
        .in("status", ["pending", "partial"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCredits(data || []);
      
      // Fetch reserver names for appointments with user_id
      const reserverNamesMap: Record<string, string> = {};
      for (const credit of (data || [])) {
        if (credit.appointments?.user_id && !reserverNamesMap[credit.appointments.user_id]) {
          const userId = credit.appointments.user_id;
          
          // Try client_profiles first
          const { data: clientProfileData } = await supabase
            .from("client_profiles" as any)
            .select("full_name")
            .eq("id", userId)
            .maybeSingle() as any;
          
          if (clientProfileData?.full_name) {
            reserverNamesMap[userId] = clientProfileData.full_name;
            continue;
          }
          
          // Try clients table by user_id
          const { data: clientData } = await supabase
            .from("clients")
            .select("full_name")
            .eq("user_id", userId)
            .eq("business_id", profile.business_id)
            .maybeSingle();
          
          if (clientData?.full_name) {
            reserverNamesMap[userId] = clientData.full_name;
            continue;
          }
          
          // Try profiles table (partners/staff)
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();
          
          if (profileData?.full_name) {
            reserverNamesMap[userId] = profileData.full_name;
          }
        }
      }
      setReserverNames(reserverNamesMap);
    } catch (error) {
      console.error("Error loading credits:", error);
      toast.error(language === "es" ? "Error al cargar créditos" : "Error loading credits");
    } finally {
      setLoading(false);
    }
  };

  const filteredCredits = credits.filter((credit) => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = credit.clients?.full_name || 
                      credit.appointments?.client_name || 
                      credit.appointments?.guest_name || 
                      "";
    const clientEmail = credit.clients?.email || "";
    const appointmentName = credit.appointments?.client_name || 
                           credit.appointments?.guest_name || 
                           "";
    const reserverName = credit.appointments?.user_id ? reserverNames[credit.appointments.user_id] : "";
    
    return (
      clientName.toLowerCase().includes(searchLower) ||
      clientEmail.toLowerCase().includes(searchLower) ||
      appointmentName.toLowerCase().includes(searchLower) ||
      reserverName.toLowerCase().includes(searchLower)
    );
  });

  // Group credits by client
  const creditsByClient = filteredCredits.reduce((acc, credit) => {
    const clientId = credit.client_id || "unknown";
    if (!acc[clientId]) {
      // Get client name - prefer clients relation, then appointment client_name/guest_name
      const clientName = credit.clients?.full_name || 
                        credit.appointments?.client_name || 
                        credit.appointments?.guest_name || 
                        (language === "es" ? "Cliente desconocido" : "Unknown client");
      
      acc[clientId] = {
        clientId: credit.client_id,
        clientName,
        clientEmail: credit.clients?.email || "",
        clientPhone: credit.clients?.phone || "",
        credits: [],
        totalAmount: 0,
        totalPaid: 0,
      };
    }
      acc[clientId].credits.push(credit);
      acc[clientId].totalAmount += Number(credit.amount || 0);
      // Since we only show pending and partial credits, totalPaid is 0 for all
      // (pending = not paid, partial = partially paid but still shows in list)
      return acc;
  }, {} as Record<string, {
    clientId: string | null;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    credits: ClientCredit[];
    totalAmount: number;
    totalPaid: number;
  }>);

  const totalPending = Object.values(creditsByClient).reduce(
    (sum, client) => sum + (client.totalAmount - client.totalPaid), 
    0
  );

  const handleViewReceipt = async (credit: ClientCredit) => {
    if (!credit.appointment_id) {
      toast.error(language === "es" ? "No hay cita asociada" : "No appointment associated");
      return;
    }

    // Fetch full appointment data
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          clients!appointments_client_id_fkey(id, user_id, full_name, email, phone),
          services!appointments_service_id_fkey(name, duration_minutes, price, price_usd, price_mxn),
          staff!appointments_staff_id_fkey(full_name, email, phone),
          businesses!appointments_business_id_fkey(business_name, address)
        `)
        .eq("id", credit.appointment_id)
        .eq("business_id", profile?.business_id)
        .single();

      if (error) throw error;
      setSelectedAppointment(data);
      setDetailViewOpen(true);
    } catch (error) {
      console.error("Error loading appointment:", error);
      toast.error(language === "es" ? "Error al cargar la cita" : "Error loading appointment");
    }
  };

  const handleMarkAsPaid = async (creditId: string) => {
    if (!profile?.business_id) return;

    try {
      const updateData: any = { status: "paid" };
      // Only add paid_at if the column exists (it might not in all schemas)
      try {
        updateData.paid_at = new Date().toISOString();
      } catch (e) {
        // Ignore if paid_at doesn't exist
      }

      const { error } = await supabase
        .from("client_credits")
        .update(updateData)
        .eq("id", creditId)
        .eq("business_id", profile.business_id);

      if (error) throw error;
      toast.success(language === "es" ? "Marcado como pagado" : "Marked as paid");
      loadCredits();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error(language === "es" ? "Error al marcar como pagado" : "Error marking as paid");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="destructive">{language === "es" ? "Pendiente" : "Pending"}</Badge>;
      case "partial":
        return <Badge variant="secondary">{language === "es" ? "Parcial" : "Partial"}</Badge>;
      case "paid":
        return <Badge variant="default" className="bg-green-500">{language === "es" ? "Pagado" : "Paid"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold flex-1">
            {language === "es" ? "Clientes a Crédito" : "Client Credits"}
          </h1>
        </div>

        {/* Summary Card */}
        <Card className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {language === "es" ? "Resumen" : "Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "es" ? "Total pendiente" : "Total pending"}
                </p>
                <p className="text-2xl font-bold text-primary">
                  DOP {totalPending.toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                </p>
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

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "es" ? "Buscar cliente..." : "Search client..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "es" ? "Cargando..." : "Loading..."}
          </div>
        ) : Object.keys(creditsByClient).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">
              {language === "es" 
                ? "No hay créditos pendientes" 
                : "No pending credits"}
            </p>
            <p className="text-sm">
              {language === "es" 
                ? "Los créditos de clientes aparecerán aquí" 
                : "Client credits will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(creditsByClient).map((client) => (
              <Card key={client.clientId} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(client.clientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">{client.clientName}</h3>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                      {client.clientEmail && (
                        <p className="text-sm text-muted-foreground truncate">{client.clientEmail}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-4 w-4 text-destructive" />
                          <span className="font-medium text-destructive">
                            DOP {(client.totalAmount - client.totalPaid).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {client.credits.length} {language === "es" ? "crédito(s)" : "credit(s)"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Credit details */}
                  <div className="mt-4 space-y-3 border-t pt-3">
                    {client.credits.map((credit) => {
                      // Get appointment name (a nombre de)
                      const appointmentName = credit.appointments?.client_name || 
                                            credit.appointments?.guest_name || 
                                            "";
                      
                      // Get reserver name (reserved by)
                      const reserverName = credit.appointments?.user_id 
                        ? reserverNames[credit.appointments.user_id] 
                        : "";
                      
                      // Get service name
                      const serviceName = credit.appointments?.services?.name || 
                                         (language === "es" ? "Servicio" : "Service");
                      
                      // Get appointment date
                      const appointmentDate = credit.appointments?.appointment_date 
                        ? format(new Date(credit.appointments.appointment_date), "d MMM yyyy", { locale: dateLocale })
                        : "";

                      return (
                        <div key={credit.id} className="space-y-2 p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(credit.status)}
                              <span className="text-muted-foreground">{serviceName}</span>
                            </div>
                            <span className="font-medium">
                              DOP {Number(credit.amount).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          
                          {appointmentName && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">{language === "es" ? "A nombre de:" : "Name on appointment:"}</span> {appointmentName}
                            </div>
                          )}
                          
                          {reserverName && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">{language === "es" ? "Reservado por:" : "Reserved by:"}</span> {reserverName}
                            </div>
                          )}
                          
                          {appointmentDate && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">{language === "es" ? "Fecha:" : "Date:"}</span> {appointmentDate}
                            </div>
                          )}
                          
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleViewReceipt(credit)}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              {language === "es" ? "Ver recibo" : "View receipt"}
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleMarkAsPaid(credit.id)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              {language === "es" ? "Marcar pagado" : "Mark paid"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Detail View for Receipt */}
      <AppointmentDetailView
        open={detailViewOpen}
        onOpenChange={setDetailViewOpen}
        appointment={selectedAppointment}
      />
    </MobileLayout>
  );
}
