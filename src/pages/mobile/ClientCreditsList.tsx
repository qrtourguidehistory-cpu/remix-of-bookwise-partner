import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Receipt, ArrowLeft, CreditCard, DollarSign, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";

interface ClientCredit {
  id: string;
  amount: number;
  paid_amount: number;
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
    services?: {
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
          appointments (id, appointment_date, services:service_id (name))
        `)
        .eq("business_id", profile.business_id)
        .in("status", ["pending", "partial"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCredits(data || []);
    } catch (error) {
      console.error("Error loading credits:", error);
      toast.error(language === "es" ? "Error al cargar créditos" : "Error loading credits");
    } finally {
      setLoading(false);
    }
  };

  const filteredCredits = credits.filter((credit) => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = credit.clients?.full_name || "";
    const clientEmail = credit.clients?.email || "";
    return (
      clientName.toLowerCase().includes(searchLower) ||
      clientEmail.toLowerCase().includes(searchLower)
    );
  });

  // Group credits by client
  const creditsByClient = filteredCredits.reduce((acc, credit) => {
    const clientId = credit.client_id || "unknown";
    if (!acc[clientId]) {
      acc[clientId] = {
        clientId: credit.client_id,
        clientName: credit.clients?.full_name || language === "es" ? "Cliente desconocido" : "Unknown client",
        clientEmail: credit.clients?.email || "",
        clientPhone: credit.clients?.phone || "",
        credits: [],
        totalAmount: 0,
        totalPaid: 0,
      };
    }
    acc[clientId].credits.push(credit);
    acc[clientId].totalAmount += Number(credit.amount || 0);
    acc[clientId].totalPaid += Number(credit.paid_amount || 0);
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
                  <div className="mt-4 space-y-2 border-t pt-3">
                    {client.credits.slice(0, 3).map((credit) => (
                      <div key={credit.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(credit.status)}
                          <span className="text-muted-foreground">
                            {credit.appointments?.services?.name || 
                              (language === "es" ? "Servicio" : "Service")}
                          </span>
                        </div>
                        <span className="font-medium">
                          DOP {(Number(credit.amount) - Number(credit.paid_amount)).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                    {client.credits.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{client.credits.length - 3} {language === "es" ? "más" : "more"}
                      </p>
                    )}
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
