import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import HubLayout from "@/components/hub/HubLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2
} from "lucide-react";

interface BusinessSubscription {
  id: string;
  business_id: string;
  owner_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'inactive';
  subscription_plan: string;
  monthly_fee: number;
  payment_method: string | null;
  paypal_subscription_id: string | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  payment_due_date: string | null;
  amount_paid: number;
  amount_due: number;
  days_overdue: number;
  payment_history: any;
  created_at: string;
  updated_at: string;
  businesses: {
    business_name: string;
    owner_id: string;
  };
  profiles: {
    email: string;
    full_name: string | null;
  };
}

const statusConfig = {
  trialing: {
    label: 'En Prueba',
    labelEn: 'Trialing',
    color: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    icon: Clock
  },
  active: {
    label: 'Activa',
    labelEn: 'Active',
    color: 'bg-green-500/10 text-green-700 border-green-500/20',
    icon: CheckCircle
  },
  past_due: {
    label: 'Vencida',
    labelEn: 'Past Due',
    color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    icon: AlertCircle
  },
  suspended: {
    label: 'Suspendida',
    labelEn: 'Suspended',
    color: 'bg-red-500/10 text-red-700 border-red-500/20',
    icon: XCircle
  },
  cancelled: {
    label: 'Cancelada',
    labelEn: 'Cancelled',
    color: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
    icon: XCircle
  },
  inactive: {
    label: 'Inactiva',
    labelEn: 'Inactive',
    color: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
    icon: XCircle
  }
};

export default function SubscriptionsPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<BusinessSubscription[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_subscriptions")
        .select(`
          *,
          businesses:business_id (
            business_name,
            owner_id
          ),
          profiles:owner_id (
            email,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSubscriptions(data || []);
    } catch (error: any) {
      console.error("Error fetching subscriptions:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? `No se pudieron cargar las suscripciones: ${error?.message || "Error desconocido"}` 
          : `Could not load subscriptions: ${error?.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (activeTab === "all") return true;
    if (activeTab === "trialing") return sub.status === "trialing";
    if (activeTab === "active") return sub.status === "active";
    if (activeTab === "past_due") return sub.status === "past_due";
    if (activeTab === "suspended") return sub.status === "suspended";
    return true;
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {language === "es" ? config.label : config.labelEn}
      </Badge>
    );
  };

  if (loading) {
    return (
      <HubLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "es" ? "Suscripciones" : "Subscriptions"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === "es" 
              ? "Gestiona las suscripciones de todos los negocios" 
              : "Manage subscriptions for all businesses"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {language === "es" ? "Resumen" : "Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {subscriptions.filter(s => s.status === "trialing").length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "es" ? "En Prueba" : "Trialing"}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {subscriptions.filter(s => s.status === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "es" ? "Activas" : "Active"}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {subscriptions.filter(s => s.status === "past_due").length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "es" ? "Vencidas" : "Past Due"}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {subscriptions.filter(s => s.status === "suspended").length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "es" ? "Suspendidas" : "Suspended"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {language === "es" ? "Lista de Suscripciones" : "Subscriptions List"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  {language === "es" ? "Todas" : "All"}
                </TabsTrigger>
                <TabsTrigger value="trialing">
                  {language === "es" ? "En Prueba" : "Trialing"}
                </TabsTrigger>
                <TabsTrigger value="active">
                  {language === "es" ? "Activas" : "Active"}
                </TabsTrigger>
                <TabsTrigger value="past_due">
                  {language === "es" ? "Vencidas" : "Past Due"}
                </TabsTrigger>
                <TabsTrigger value="suspended">
                  {language === "es" ? "Suspendidas" : "Suspended"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {language === "es" ? "Negocio" : "Business"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Propietario" : "Owner"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Estado" : "Status"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Plan" : "Plan"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Tarifa Mensual" : "Monthly Fee"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Próximo Pago" : "Next Payment"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Vencimiento" : "Due Date"}
                        </TableHead>
                        <TableHead>
                          {language === "es" ? "Días Atraso" : "Days Overdue"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscriptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            {language === "es" 
                              ? "No hay suscripciones para mostrar" 
                              : "No subscriptions to display"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSubscriptions.map((subscription) => (
                          <TableRow key={subscription.id}>
                            <TableCell className="font-medium">
                              {subscription.businesses?.business_name || "N/A"}
                            </TableCell>
                            <TableCell>
                              {subscription.profiles?.full_name || subscription.profiles?.email || "N/A"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(subscription.status)}
                            </TableCell>
                            <TableCell>
                              {subscription.subscription_plan}
                            </TableCell>
                            <TableCell>
                              ${subscription.monthly_fee.toFixed(2)} USD
                            </TableCell>
                            <TableCell>
                              {subscription.next_payment_date 
                                ? format(new Date(subscription.next_payment_date), "dd/MM/yyyy")
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {subscription.payment_due_date 
                                ? format(new Date(subscription.payment_due_date), "dd/MM/yyyy")
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {subscription.days_overdue > 0 ? (
                                <span className="text-red-600 font-medium">
                                  {subscription.days_overdue}
                                </span>
                              ) : (
                                "0"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </HubLayout>
  );
}

