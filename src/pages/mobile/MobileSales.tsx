import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, Plus, FileDown, FileText, ArrowRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { exportSalesToPDF, exportSalesToExcel, exportSalesToCSV, SalesReportData } from "@/lib/exportUtils";
import { format } from "date-fns";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useOptimizedSalesRealtime } from "@/hooks/useOptimizedRealtime";
import { useAutoPurge } from "@/hooks/useAutoPurge";

export default function MobileSales() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);

  // ✅ FIX: Declarar fetchSales antes de usarlo en useEffect
  const fetchSales = useCallback(async () => {
    if (!profile?.business_id) return;
    
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // OPTIMIZACIÓN: Solo seleccionar columnas necesarias
    const { data, error } = await supabase
      .from("sales")
      .select("id, sale_date, sale_time, client_name, service_name, price_usd, tip_amount, price_mxn, payment_method, created_at")
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data && !error) {
      setSales(data);
      
      // OPTIMIZACIÓN: Cálculos memoizados (ver abajo)
      const todaySum = data
        .filter((sale) => sale.sale_date === today)
        .reduce((sum, sale) => sum + (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0), 0);
      setTodayTotal(todaySum);

      const weekSum = data
        .filter((sale) => sale.sale_date >= weekAgo)
        .reduce((sum, sale) => sum + (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0), 0);
      setWeekTotal(weekSum);
    }
  }, [profile?.business_id]);

  useEffect(() => {
    if (profile?.business_id) {
      fetchSales();
    }
  }, [profile?.business_id, fetchSales]);

  // OPTIMIZACIÓN: Cálculos memoizados para evitar recálculos innecesarios
  const salesTotals = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    const todaySum = sales
      .filter((sale) => sale.sale_date === today)
      .reduce((sum, sale) => sum + (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0), 0);
    
    const weekSum = sales
      .filter((sale) => sale.sale_date >= weekAgo)
      .reduce((sum, sale) => sum + (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0), 0);
    
    return { todaySum, weekSum };
  }, [sales]);

  // Sincronizar con estado cuando cambian los cálculos memoizados
  useEffect(() => {
    setTodayTotal(salesTotals.todaySum);
    setWeekTotal(salesTotals.weekSum);
  }, [salesTotals]);

  // OPTIMIZACIÓN: Auto-purga de estado al salir de la página
  useAutoPurge(() => {
    setSales([]);
    setTodayTotal(0);
    setWeekTotal(0);
  }, []);

  // OPTIMIZACIÓN: Realtime optimizado solo para ventas
  useOptimizedSalesRealtime(
    profile?.business_id,
    fetchSales,
    true // Solo activo cuando está en esta página
  );

  const handleExportPDF = async () => {
    try {
      const reportData: SalesReportData[] = sales.map(sale => ({
        date: format(new Date(sale.sale_date), "PP"),
        client: sale.client_name,
        service: sale.service_name,
        staff: sale.staff_id || "N/A",
        amount: (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0),
        paymentMethod: sale.payment_method || "N/A"
      }));
      
      const businessName = profile?.businesses?.business_name || profile?.business_id || "Business";
      await exportSalesToPDF(reportData, businessName);
      toast.success(language === "es" ? "PDF exportado exitosamente" : "PDF exported successfully");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error(language === "es" ? "Error al exportar PDF" : "Error exporting PDF");
    }
  };

  const handleExportExcel = async () => {
    try {
      const reportData: SalesReportData[] = sales.map(sale => ({
        date: format(new Date(sale.sale_date), "PP"),
        client: sale.client_name,
        service: sale.service_name,
        staff: sale.staff_id || "N/A",
        amount: (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0),
        paymentMethod: sale.payment_method || "N/A"
      }));
      
      const businessName = profile?.businesses?.business_name || profile?.business_id || "Business";
      await exportSalesToExcel(reportData, businessName);
      toast.success(language === "es" ? "Excel exportado exitosamente" : "Excel exported successfully");
    } catch (error) {
      console.error("Export Excel error:", error);
      toast.error(language === "es" ? "Error al exportar Excel" : "Error exporting Excel");
    }
  };

  const handleExportCSV = async () => {
    try {
      const reportData: SalesReportData[] = sales.map(sale => ({
        date: format(new Date(sale.sale_date), "PP"),
        client: sale.client_name,
        service: sale.service_name,
        staff: sale.staff_id || "N/A",
        amount: (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0),
        paymentMethod: sale.payment_method || "N/A"
      }));
      
      const businessName = profile?.businesses?.business_name || profile?.business_id || "Business";
      await exportSalesToCSV(reportData, businessName);
      toast.success(language === "es" ? "CSV exportado exitosamente" : "CSV exported successfully");
    } catch (error) {
      console.error("Export CSV error:", error);
      toast.error(language === "es" ? "Error al exportar CSV" : "Error exporting CSV");
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-6 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">{language === "es" ? "Ventas" : "Sales"}</h1>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileDown className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportPDF}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate("/admin/sales/new")} size="sm" className="rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1" />
              {language === "es" ? "Nueva Venta" : "New Sale"}
            </Button>
          </div>
        </div>

        {/* Daily Sales Summary Button */}
        <Card className="mb-4 cursor-pointer shadow-md border border-border rounded-xl bg-card hover:bg-accent hover:shadow-lg transition-shadow" onClick={() => navigate("/admin/reports")}>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shadow-sm">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-base text-foreground">
                  {language === "es" ? "Resúmenes de Ventas Diarias" : "Daily Sales Summaries"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === "es" 
                    ? "Ver y crear reportes de ventas diarias" 
                    : "View and create daily sales reports"}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-lg">
              <ArrowRight className="h-4 w-4 text-foreground" />
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 shadow-md border border-border rounded-xl bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">{language === "es" ? "Hoy" : "Today"}</span>
            </div>
            <div className="text-2xl font-bold text-primary">${todayTotal.toFixed(2)}</div>
          </Card>
          <Card className="p-4 shadow-md border border-border rounded-xl bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{language === "es" ? "Esta Semana" : "This Week"}</span>
            </div>
            <div className="text-2xl font-bold text-primary">${weekTotal.toFixed(2)}</div>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">{language === "es" ? "Ventas Recientes" : "Recent Sales"}</h2>
          <div className="space-y-4">
            {sales.length === 0 ? (
              <Card className="p-8 shadow-md border border-border rounded-xl text-center bg-card">
                <p className="text-muted-foreground">
                  {language === "es" ? "No hay ventas registradas" : "No sales recorded yet"}
                </p>
              </Card>
            ) : (
              sales.map((sale) => (
                <Card key={sale.id} className="p-4 shadow-md border border-border rounded-xl bg-card">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate text-foreground">{sale.client_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">{sale.service_name}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-lg font-bold ${sale.payment_method === 'credit' ? 'text-warning' : 'text-success'}`}>
                        ${(parseFloat(sale.price_usd) + parseFloat(sale.tip_amount || 0)).toFixed(2)}
                      </div>
                      {sale.price_mxn > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          MX${parseFloat(sale.price_mxn).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>
                      {new Date(sale.sale_date).toLocaleDateString()} {sale.sale_time}
                    </span>
                    <span className={`capitalize ${sale.payment_method === 'credit' ? 'font-semibold text-warning' : ''}`}>{sale.payment_method}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
