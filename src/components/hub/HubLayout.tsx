import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Calendar,
  Shield,
  Bell,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface HubLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Overview", nameEs: "Inicio", href: "/hub", icon: LayoutDashboard },
  { name: "Establishments", nameEs: "Establecimientos", href: "/hub/establishments", icon: Building2 },
  { name: "Clients", nameEs: "Clientes", href: "/hub/clients", icon: Users },
  { name: "Staff", nameEs: "Staff", icon: Users, href: "/hub/staff" },
  { name: "Appointments", nameEs: "Citas", href: "/hub/appointments", icon: Calendar },
];

const systemNavigation = [
  { name: "Moderation", nameEs: "Moderación", href: "/hub/moderation", icon: Shield, badge: true },
  { name: "Notifications", nameEs: "Notificaciones", href: "/hub/notifications", icon: Bell },
  { name: "Analytics", nameEs: "Analytics", href: "/hub/analytics", icon: BarChart3 },
  { name: "Settings", nameEs: "Configuración", href: "/hub/settings", icon: Settings },
];

export default function HubLayout({ children }: HubLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    const { count } = await supabase
      .from("business_approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingApprovals(count || 0);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  const NavItem = ({ item, mobile = false }: { item: typeof navigation[0] & { badge?: boolean }; mobile?: boolean }) => {
    const isActive = location.pathname === item.href || 
      (item.href !== "/hub" && location.pathname.startsWith(item.href));
    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={() => mobile && setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1">
          {language === "es" ? item.nameEs : item.name}
        </span>
        {item.badge && pendingApprovals > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {pendingApprovals}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold text-lg">Bookwise <span className="text-muted-foreground font-normal text-sm">Admin</span></span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-sm text-muted-foreground">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              {language === "es" ? "Cerrar sesión" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <span className="font-bold text-lg">Bookwise <span className="text-muted-foreground font-normal text-sm">Admin</span></span>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}

            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {language === "es" ? "Sistema" : "System"}
              </p>
              {systemNavigation.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          </nav>

          {/* User section */}
          <div className="hidden lg:block p-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium shrink-0">
                    SA
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium truncate">Super Admin</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  {language === "es" ? "Cerrar sesión" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

