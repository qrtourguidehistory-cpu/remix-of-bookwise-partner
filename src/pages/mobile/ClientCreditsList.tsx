import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Receipt, Calendar, Mail, Phone, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Client Credits List Page
 * Note: client_credits table doesn't exist yet
 * This is a placeholder that shows an empty state until the table is created
 */

interface ClientCredit {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  appointment_id: string;
  client_id: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  appointmentDate: string | null;
}

export default function ClientCreditsList() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(false);

  // Table doesn't exist yet, so we just show empty state
  useEffect(() => {
    setLoading(false);
    setCredits([]);
  }, [profile?.business_id]);

  const filteredCredits = credits.filter((credit) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      credit.clientName.toLowerCase().includes(searchLower) ||
      credit.clientEmail.toLowerCase().includes(searchLower)
    );
  });

  // Group credits by client
  const creditsByClient = filteredCredits.reduce((acc, credit) => {
    const clientId = credit.client_id || credit.clientName || "unknown";
    if (!acc[clientId]) {
      acc[clientId] = {
        clientId: credit.client_id,
        clientName: credit.clientName,
        clientEmail: credit.clientEmail,
        clientPhone: credit.clientPhone,
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
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              {language === "es" 
                ? "Sistema de créditos próximamente" 
                : "Credits system coming soon"}
            </p>
            <p className="text-sm">
              {language === "es" 
                ? "Esta funcionalidad estará disponible pronto" 
                : "This feature will be available soon"}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
