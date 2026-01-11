import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar as CalendarIcon, MoreVertical, Plus, ChevronDown, FileDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDailySalesSummaries } from "@/hooks/useDailySalesSummaries";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportDailySummaryToPDF, exportDailySummaryToExcel, exportDailySummaryToCSV } from "@/lib/exportUtils";
import { toast } from "sonner";

interface TransactionSummary {
  itemType: string;
  salesQty: number;
  refundQty: number;
  grossTotal: number;
}

interface CashMovement {
  paymentType: string;
  paymentsCollected: number;
  refundsPaid: number;
}

export default function DailySalesSummary() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { getSummaryByDate, generateSummaryFromSales } = useDailySalesSummaries();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<any>(null);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary[]>([]);
  const [cashMovement, setCashMovement] = useState<CashMovement[]>([]);
  const [creditSummary, setCreditSummary] = useState<{ qty: number; total: number }>({ qty: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDailyData();
  }, [selectedDate, profile?.business_id]);

  const loadDailyData = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    try {
      // Load summary if exists
      const existingSummary = await getSummaryByDate(dateStr);
      setSummary(existingSummary);

      // Load sales for the day
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .eq("business_id", profile.business_id)
        .eq("sale_date", dateStr);

      if (salesError) throw salesError;

      // Load appointments for the day (completed services) and include service pricing
      const { data: appointments, error: appointmentsError } = await (supabase
        .from("appointments")
        .select("id, service_id, payment_amount, payment_method, status, services!appointments_service_id_fkey(name, price, price_usd)")
        .eq("business_id", profile.business_id)
        .eq("appointment_date", dateStr)
        .eq("status", "completed") as any);

      if (appointmentsError) throw appointmentsError;

      // Note: appointment_services table doesn't exist yet
      // When implemented, this would load add-on services for appointments
      const addonServices: any[] = [];

      // Calculate Services (completed appointments)
      const servicesQty = (appointments as any[])?.length || 0;
      const servicesTotal = (appointments as any[])?.reduce(
        (sum: number, a: any) => sum + (Number(a.payment_amount || 0)), 0
      ) || 0;

      // Calculate credit (appointments marked as credit: no payment_method && no payment_amount)
      const creditAppointments = (appointments as any[])?.filter(a => !a.payment_method && !a.payment_amount) || [];
      const creditQty = creditAppointments.length;
      const creditTotal = creditAppointments.reduce((sum: number, a: any) => {
        const price = Number(a.services?.price_usd ?? a.services?.price ?? 0);
        return sum + price;
      }, 0);

      // expose credit summary for UI
      setCreditSummary({ qty: creditQty, total: creditTotal });

      // Calculate Service Add-ons
      const serviceAddonsQty = addonServices.length;
      const serviceAddonsTotal = addonServices.reduce(
        (sum, as) => sum + (Number(as.price || 0) * (as.quantity || 1)), 0
      );

      // Calculate Products (sales with inventory_used or without service_id)
      const products = sales?.filter(
        s => (s.inventory_used && Object.keys(s.inventory_used).length > 0) || 
             (!s.service_id && !s.service_name)
      ) || [];
      const productsQty = products.length;
      const productsTotal = products.reduce(
        (sum, s) => sum + (Number(s.price_usd) || 0), 0
      );

      // Calculate Tips (transactions with tips)
      const tipsTransactions = sales?.filter(s => Number(s.tip_amount || 0) > 0) || [];
      const tipsQty = tipsTransactions.length;
      const tipsTotalAmount = tipsTransactions.reduce(
        (sum, s) => sum + (Number(s.tip_amount) || 0), 0
      );

      // Calculate Late Cancellation Fees (check notes for keywords)
      const cancellationKeywords = language === "es" 
        ? ["cancelación", "cancelacion", "tardía", "tardia", "fee", "tarifa"]
        : ["cancellation", "late", "fee"];
      const lateCancellationFees = sales?.filter(s => {
        const notes = (s.notes || "").toLowerCase();
        return cancellationKeywords.some(keyword => notes.includes(keyword.toLowerCase()));
      }) || [];
      const lateCancellationFeesQty = lateCancellationFees.length;
      const lateCancellationFeesTotal = lateCancellationFees.reduce(
        (sum, s) => sum + (Number(s.price_usd) || 0), 0
      );

      // Build transaction summary with only the 5 required types
      const transactionData: TransactionSummary[] = [
        {
          itemType: language === "es" ? "Servicios" : "Services",
          salesQty: servicesQty,
          refundQty: 0, // TODO: Track refunds per type
          grossTotal: servicesTotal,
        },
        {
          itemType: language === "es" ? "Productos" : "Products",
          salesQty: productsQty,
          refundQty: 0,
          grossTotal: productsTotal,
        },
        {
          itemType: language === "es" ? "Propinas" : "Tips",
          salesQty: tipsQty,
          refundQty: 0,
          grossTotal: tipsTotalAmount,
        },
        {
          itemType: language === "es" ? "Tarifa de cancelación tardía" : "Late cancellation fees",
          salesQty: lateCancellationFeesQty,
          refundQty: 0,
          grossTotal: lateCancellationFeesTotal,
        },
        {
          itemType: language === "es" ? "Complemento de servicio" : "Service add-ons",
          salesQty: serviceAddonsQty,
          refundQty: 0,
          grossTotal: serviceAddonsTotal,
        },
        // Add credit summary for appointments taken on credit (pending)
        {
          itemType: language === "es" ? "Créditos (pendientes)" : "Credit (pending)",
          salesQty: creditQty,
          refundQty: 0,
          grossTotal: creditTotal,
        },
      ];

      setTransactionSummary(transactionData);

      // Calculate cash movement summary
      const cashSales = sales?.filter(s => s.payment_method === "cash") || [];
      const cardSales = sales?.filter(s => s.payment_method === "card") || [];
      const onlineSales = sales?.filter(s => s.payment_method === "online") || [];
      
      const cashTotal = cashSales.reduce((sum, s) => sum + (Number(s.price_usd) || 0), 0);
      const cardTotal = cardSales.reduce((sum, s) => sum + (Number(s.price_usd) || 0), 0);
      const onlineTotal = onlineSales.reduce((sum, s) => sum + (Number(s.price_usd) || 0), 0);
      const tipsTotal = sales?.reduce((sum, s) => sum + (Number(s.tip_amount) || 0), 0) || 0;
      const refundsTotal = existingSummary?.refunds_total || 0;

      const cashMovementData: CashMovement[] = [
        {
          paymentType: language === "es" ? "Efectivo" : "Cash",
          paymentsCollected: cashTotal,
          refundsPaid: 0,
        },
        {
          paymentType: language === "es" ? "Otro" : "Other",
          paymentsCollected: 0,
          refundsPaid: 0,
        },
        {
          paymentType: language === "es" ? "Canjes de tarjetas de regalo" : "Gift card redemptions",
          paymentsCollected: 0,
          refundsPaid: 0,
        },
        {
          paymentType: language === "es" ? "Pagos recaudados" : "Payments collected",
          paymentsCollected: cashTotal + cardTotal + onlineTotal,
          refundsPaid: refundsTotal,
        },
        {
          paymentType: language === "es" ? "De los cuales propinas" : "Of which tips",
          paymentsCollected: tipsTotal,
          refundsPaid: 0,
        },
      ];

      setCashMovement(cashMovementData);
    } catch (error) {
      console.error("Error loading daily data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromSales = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const generated = await generateSummaryFromSales(dateStr);
    if (generated) {
      await loadDailyData();
    }
  };

  const getBusinessName = () => {
    return (profile?.businesses?.business_name) || "Business";
  };

  const handleExportPDF = async () => {
    try {
      const exportData = {
        date: format(selectedDate, "PPP", { locale: dateLocale }),
        transactionSummary: transactionSummary || [],
        cashMovement: cashMovement || [],
      };
      await exportDailySummaryToPDF(exportData, getBusinessName());
      toast.success(language === "es" ? "PDF exportado exitosamente" : "PDF exported successfully");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error(language === "es" ? "Error al exportar PDF" : "Error exporting PDF");
    }
  };

  const handleExportExcel = async () => {
    try {
      const exportData = {
        date: format(selectedDate, "PPP", { locale: dateLocale }),
        transactionSummary: transactionSummary || [],
        cashMovement: cashMovement || [],
      };
      await exportDailySummaryToExcel(exportData, getBusinessName());
      toast.success(language === "es" ? "Excel exportado exitosamente" : "Excel exported successfully");
    } catch (error) {
      console.error("Export Excel error:", error);
      toast.error(language === "es" ? "Error al exportar Excel" : "Error exporting Excel");
    }
  };

  const handleExportCSV = async () => {
    try {
      const exportData = {
        date: format(selectedDate, "PPP", { locale: dateLocale }),
        transactionSummary: transactionSummary || [],
        cashMovement: cashMovement || [],
      };
      exportDailySummaryToCSV(exportData, getBusinessName());
      toast.success(language === "es" ? "CSV exportado exitosamente" : "CSV exported successfully");
    } catch (error) {
      console.error("Export CSV error:", error);
      toast.error(language === "es" ? "Error al exportar CSV" : "Error exporting CSV");
    }
  };

  const formatCurrency = (amount: number) => {
    return `DOP ${amount.toFixed(2)}`;
  };

  const dateLocale = language === "es" ? es : enUS;

  return (
    <MobileLayout>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {language === "es" ? "Exportar PDF" : "Export PDF"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {language === "es" ? "Exportar Excel" : "Export Excel"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {language === "es" ? "Exportar CSV" : "Export CSV"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => navigate("/admin/sales/new")} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {language === "es" ? "Agregar" : "Add"}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-6">
          {/* Title and Description */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              {language === "es" ? "Ventas diarias" : "Daily sales"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {language === "es"
                ? "Ver, filtrar y exportar las transacciones y movimiento de efectivo del día."
                : "View, filter and export the transactions and cash movement for the day."}
            </p>
          </div>

          {/* Date Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span>
                    {format(selectedDate, "d MMM, yyyy", { locale: dateLocale })}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Transaction Summary Table */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              {language === "es" ? "Resumen de transacciones" : "Transaction summary"}
            </h2>
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 text-sm font-medium">
                        {language === "es" ? "Tipo de artículo" : "Item type"}
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        {language === "es" ? "Cantidad de ventas" : "Sales qty"}
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        {language === "es" ? "Cantidad de reembolsos" : "Refund qty"}
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        {language === "es" ? "Total bruto" : "Gross total"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionSummary.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="p-3 text-sm">{item.itemType}</td>
                        <td className="p-3 text-sm text-right">{item.salesQty}</td>
                        <td className="p-3 text-sm text-right">{item.refundQty}</td>
                        <td className="p-3 text-sm text-right font-medium">
                          {formatCurrency(item.grossTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Cash Movement Summary */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              {language === "es" ? "Resumen de movimiento de efectivo" : "Cash movement summary"}
            </h2>
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 text-sm font-medium">
                        {language === "es" ? "Tipo de pago" : "Payment type"}
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        {language === "es" ? "Pagos recaudados" : "Payments collected"}
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        {language === "es" ? "Reembolsos pagados" : "Refunds paid"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashMovement.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="p-3 text-sm">{item.paymentType}</td>
                        <td className="p-3 text-sm text-right">
                          {formatCurrency(item.paymentsCollected)}
                        </td>
                        <td className="p-3 text-sm text-right">
                          {formatCurrency(item.refundsPaid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Pending Credits summary (appointments on credit) */}
            {creditSummary.qty > 0 && (
              <div className="mt-4">
                <div className="border rounded-lg overflow-hidden bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{language === 'es' ? 'Créditos pendientes' : 'Pending credits'}</p>
                      <p className="text-sm text-muted-foreground">{creditSummary.qty} {language === 'es' ? 'venta(s) a crédito' : 'credit sale(s)'} • {formatCurrency(creditSummary.total)}</p>
                    </div>
                    <div>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/clients/credits')}>
                        {language === 'es' ? 'Ver créditos' : 'View credits'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
