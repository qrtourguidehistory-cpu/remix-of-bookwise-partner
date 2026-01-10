import AdminLayout from "@/components/admin/AdminLayout";
import StatCard from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Users, UserPlus, Bell, Plus, Eye, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  const business = profile?.businesses;
  const isPublic = business?.is_public === true;
  const hasSlug = Boolean(business?.slug);
  const onboardingComplete = business?.onboarding_completed === true;
  const isVisible = isPublic && hasSlug && onboardingComplete;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
        </div>

        {/* Public Profile Banner */}
        {!isVisible && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex-shrink-0 p-2 rounded-full bg-amber-500/20">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {t("businessNotVisible") || "Tu negocio no es visible para clientes"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {!onboardingComplete 
                    ? "Completa el onboarding para hacer visible tu negocio."
                    : !hasSlug 
                    ? "Configura una URL personalizada para tu negocio."
                    : !isPublic 
                    ? "Activa la visibilidad pública para que los clientes te encuentren."
                    : t("configurePublicProfile") || "Configura tu perfil público para que los clientes te encuentren en MiTurnow Cliente."}
                </p>
              </div>
              <Button asChild variant="default" className="flex-shrink-0">
                <Link to="/admin/settings/business-profile">
                  <Eye className="h-4 w-4 mr-2" />
                  {t("configureProfile") || "Configurar perfil"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Revenue"
            value="$1,234"
            icon={DollarSign}
            trend={{ value: "12%", positive: true }}
          />
          <StatCard
            title="Today's Appointments"
            value="24"
            icon={Calendar}
            trend={{ value: "8%", positive: true }}
          />
          <StatCard
            title="Staff Occupancy"
            value="78%"
            icon={Users}
            trend={{ value: "5%", positive: true }}
          />
          <StatCard
            title="New Clients"
            value="12"
            icon={UserPlus}
            trend={{ value: "3%", positive: false }}
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/admin/appointments">
                  <Plus className="h-4 w-4 mr-2" />
                  New Booking
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/staff">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Staff
                </Link>
              </Button>
              <Button variant="outline">
                <Bell className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <Bell className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Appointment Cancelled</p>
                  <p className="text-sm text-muted-foreground">
                    Client cancelled their 2:00 PM appointment today
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">5 min ago</span>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Bell className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">New Client Registered</p>
                  <p className="text-sm text-muted-foreground">
                    Sarah Johnson just created an account
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">12 min ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Appointments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/appointments">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  time: "10:00 AM",
                  client: "Emma Wilson",
                  service: "Hair Cut & Style",
                  staff: "Maria Garcia",
                },
                {
                  time: "11:30 AM",
                  client: "James Brown",
                  service: "Beard Trim",
                  staff: "John Smith",
                },
                {
                  time: "2:00 PM",
                  client: "Sofia Martinez",
                  service: "Full Body Massage",
                  staff: "Lisa Chen",
                },
              ].map((apt, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className="w-20 text-sm font-medium">{apt.time}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{apt.client}</p>
                    <p className="text-xs text-muted-foreground">{apt.service}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">{apt.staff}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
