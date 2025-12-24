import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Receipt, DollarSign, Calendar, User, Phone, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

export default function ClientCreditsList() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.business_id) {
      fetchCredits();
    }
  }, [profile?.business_id]);

  const fetchCredits = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
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
      setLoading(false);
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

  const filteredCredits = credits.filter((credit) => {
    const clientName = credit.clients?.full_name || credit.appointments?.client_name || "";
    const clientEmail = credit.clients?.email || credit.appointments?.client_email || "";
    const searchLower = searchQuery.toLowerCase();
    return (
      clientName.toLowerCase().includes(searchLower) ||
      clientEmail.toLowerCase().includes(searchLower)
    );
  });

  // Group credits by client
  const creditsByClient = filteredCredits.reduce((acc, credit) => {
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
      </div>
    </MobileLayout>
  );
}

