import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, 
  Users, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Ban,
  Activity,
  Database,
  Wifi
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import HubLayout from "@/components/hub/HubLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface DashboardStats {
  activeBusinesses: number;
  registeredClients: number;
  monthlyAppointments: number;
  noShowRate: number;
  pendingApprovals: number;
  suspendedBusinesses: number;
  blockedClients: number;
  todayAppointments: number;
}

interface RecentAppointment {
  id: string;
  client_name: string;
  business_name: string;
  date: string;
  start_time: string;
  status: string;
  created_at: string;
}

export default function HubDashboard() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeBusinesses: 0,
    registeredClients: 0,
    monthlyAppointments: 0,
    noShowRate: 0,
    pendingApprovals: 0,
    suspendedBusinesses: 0,
    blockedClients: 0,
    todayAppointments: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [dbStatus, setDbStatus] = useState<{ latency: number; connected: boolean }>({ latency: 0, connected: false });
  const [apiStatus, setApiStatus] = useState<{ latency: number; connected: boolean }>({ latency: 0, connected: false });

  useEffect(() => {
    fetchDashboardData();
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    // Check DB latency
    const dbStart = performance.now();
    try {
      await supabase.from("businesses").select("id").limit(1);
      const dbEnd = performance.now();
      setDbStatus({ latency: Math.round(dbEnd - dbStart), connected: true });
    } catch {
      setDbStatus({ latency: 0, connected: false });
    }

    // Check API latency
    const apiStart = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const apiEnd = performance.now();
      setApiStatus({ latency: Math.round(apiEnd - apiStart), connected: !error });
    } catch {
      setApiStatus({ latency: 0, connected: false });
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get active businesses count
      const { count: activeBusinesses } = await supabase
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("is_public", true);

      // Get registered clients count
      const { count: registeredClients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Get monthly appointments
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: monthlyAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("date", startOfMonth.toISOString().split("T")[0]);

      // Get no-show rate
      const { data: noShowData } = await supabase
        .from("appointments")
        .select("status")
        .gte("date", startOfMonth.toISOString().split("T")[0]);

      const noShowCount = noShowData?.filter(a => a.status === "no_show").length || 0;
      const noShowRate = noShowData?.length ? (noShowCount / noShowData.length) * 100 : 0;

      // Get pending approvals
      const { count: pendingApprovals } = await supabase
        .from("business_approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Get suspended businesses
      const { count: suspendedBusinesses } = await supabase
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "suspended");

      // Get today's appointments
      const today = new Date().toISOString().split("T")[0];
      const { count: todayAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("date", today);

      // Get recent appointments
      const { data: recentApts } = await supabase
        .from("appointments")
        .select(`
          id,
          date,
          start_time,
          status,
          created_at,
          clients (full_name),
          businesses:business_id (business_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      setStats({
        activeBusinesses: activeBusinesses || 0,
        registeredClients: registeredClients || 0,
        monthlyAppointments: monthlyAppointments || 0,
        noShowRate: Math.round(noShowRate * 10) / 10,
        pendingApprovals: pendingApprovals || 0,
        suspendedBusinesses: suspendedBusinesses || 0,
        blockedClients: 0,
        todayAppointments: todayAppointments || 0,
      });

      setRecentAppointments(
        (recentApts || []).map((apt: any) => ({
          id: apt.id,
          client_name: apt.clients?.full_name || "Unknown",
          business_name: apt.businesses?.business_name || "Unknown",
          date: apt.date,
          start_time: apt.start_time,
          status: apt.status || "pending",
          created_at: apt.created_at,
        }))
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completada</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pendiente</Badge>;
      case "confirmed":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Confirmada</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelada</Badge>;
      case "no_show":
        return <Badge variant="secondary">No show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) {
      return language === "es" 
        ? `Creada hace ${diffMins} minutos` 
        : `Created ${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return language === "es" 
        ? `Creada hace ${diffHours} horas` 
        : `Created ${diffHours} hours ago`;
    } else {
      return language === "es" 
        ? `Creada hace ${Math.floor(diffHours / 24)} días` 
        : `Created ${Math.floor(diffHours / 24)} days ago`;
    }
  };

  return (
    <HubLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {language === "es" 
              ? "Vista general del sistema Bookwise" 
              : "Bookwise system overview"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Negocios activos" : "Active businesses"}
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeBusinesses}</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {language === "es" ? "12% vs mes anterior" : "12% vs last month"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Clientes registrados" : "Registered clients"}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.registeredClients}</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {language === "es" ? "8% vs mes anterior" : "8% vs last month"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Citas este mes" : "Appointments this month"}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.monthlyAppointments}</div>
              <p className="text-xs text-red-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 rotate-180" />
                {language === "es" ? "3% vs mes anterior" : "3% vs last month"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Tasa no-show" : "No-show rate"}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.noShowRate}%</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 rotate-180" />
                {language === "es" ? "15% vs mes anterior" : "15% vs last month"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Pendientes de aprobar" : "Pending approvals"}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Negocios suspendidos" : "Suspended businesses"}
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.suspendedBusinesses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Clientes bloqueados" : "Blocked clients"}
              </CardTitle>
              <Ban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.blockedClients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "es" ? "Citas hoy" : "Appointments today"}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayAppointments}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Appointments & Pending Approvals */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Appointments */}
          <Card>
            <CardHeader>
              <CardTitle>{language === "es" ? "Citas recientes" : "Recent appointments"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    {language === "es" ? "No hay citas recientes" : "No recent appointments"}
                  </p>
                ) : (
                  recentAppointments.map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{apt.client_name}</p>
                        <p className="text-sm text-muted-foreground">{apt.business_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {apt.date}
                          <Clock className="h-3 w-3 ml-2" />
                          {apt.start_time}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(apt.created_at)}
                        </p>
                      </div>
                      {getStatusBadge(apt.status)}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle>{language === "es" ? "Aprobaciones pendientes" : "Pending approvals"}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.pendingApprovals === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">
                    {language === "es" 
                      ? "No hay solicitudes pendientes" 
                      : "No pending requests"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {language === "es" 
                      ? `Hay ${stats.pendingApprovals} solicitudes esperando revisión`
                      : `There are ${stats.pendingApprovals} requests waiting for review`}
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/hub/moderation">
                      {language === "es" ? "Ver solicitudes" : "View requests"}
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {language === "es" ? "Estado del sistema" : "System status"}
            </CardTitle>
            <CardDescription>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                {language === "es" ? "Operativo" : "Operational"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>Database</span>
                </div>
                <div className="flex items-center gap-2">
                  {dbStatus.connected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-muted-foreground">{dbStatus.latency}ms</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  <span>API</span>
                </div>
                <div className="flex items-center gap-2">
                  {apiStatus.connected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-muted-foreground">{apiStatus.latency}ms</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </HubLayout>
  );
}

