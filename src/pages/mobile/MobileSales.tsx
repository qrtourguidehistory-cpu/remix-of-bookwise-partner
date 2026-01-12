import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function MobileSales() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);

  useEffect(() => {
    if (profile?.business_id) {
      fetchSales();
    }
  }, [profile?.business_id]);

  const fetchSales = async () => {
    if (!profile?.business_id) return;
    
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data && !error) {
      setSales(data);
      
      // Calculate today's total
      const todaySum = data
        .filter((sale) => sale.sale_date === today)
        .reduce((sum, sale) => sum + (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0), 0);
      setTodayTotal(todaySum);

      // Calculate week's total
      const weekSum = data
        .filter((sale) => sale.sale_date >= weekAgo)
        .reduce((sum, sale) => sum + (Number(sale.price_usd) || 0) + (Number(sale.tip_amount) || 0), 0);
      setWeekTotal(weekSum);
    }
  };

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
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center justify-between mb-4">
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
            <Button onClick={() => navigate("/admin/sales/new")} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {language === "es" ? "Nueva Venta" : "New Sale"}
            </Button>
          </div>
        </div>

        {/* Daily Sales Summary Button */}
        <Card className="mb-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/admin/reports")}>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">
                  {language === "es" ? "Resúmenes de Ventas Diarias" : "Daily Sales Summaries"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === "es" 
                    ? "Ver y crear reportes de ventas diarias" 
                    : "View and create daily sales reports"}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 bg-card border-border/20">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">{language === "es" ? "Hoy" : "Today"}</span>
            </div>
            <div className="text-2xl font-bold">${todayTotal.toFixed(2)}</div>
          </Card>
          <Card className="p-4 bg-card border-border/20">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{language === "es" ? "Esta Semana" : "This Week"}</span>
            </div>
            <div className="text-2xl font-bold">${weekTotal.toFixed(2)}</div>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">{language === "es" ? "Ventas Recientes" : "Recent Sales"}</h2>
          <div className="space-y-3">
            {sales.length === 0 ? (
              <Card className="p-8 bg-card border-border/20 text-center">
                <p className="text-muted-foreground">
                  {language === "es" ? "No hay ventas registradas" : "No sales recorded yet"}
                </p>
              </Card>
            ) : (
              sales.map((sale) => (
                <Card key={sale.id} className="p-4 bg-card border-border/20">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{sale.client_name}</div>
                      <div className="text-sm text-muted-foreground">{sale.service_name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${sale.payment_method === 'credit' ? 'text-orange-600' : 'text-green-500'}`}>
                        ${(parseFloat(sale.price_usd) + parseFloat(sale.tip_amount || 0)).toFixed(2)}
                      </div>
                      {sale.price_mxn > 0 && (
                        <div className="text-xs text-muted-foreground">
                          MX${parseFloat(sale.price_mxn).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                      {new Date(sale.sale_date).toLocaleDateString()} {sale.sale_time}
                    </span>
                    <span className={`capitalize ${sale.payment_method === 'credit' ? 'font-semibold text-orange-600' : ''}`}>{sale.payment_method}</span>
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
