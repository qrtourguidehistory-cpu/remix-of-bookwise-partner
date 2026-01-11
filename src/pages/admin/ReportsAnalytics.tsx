import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, TrendingUp, DollarSign, Users, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { exportAnalyticsToPDF, exportAnalyticsToExcel, exportAnalyticsToCSV, AnalyticsReportData } from "@/lib/exportUtils";
import { toast } from "sonner";
import { exportAnalyticsToPDF, exportAnalyticsToExcel, exportAnalyticsToCSV, AnalyticsReportData } from "@/lib/exportUtils";
import { toast } from "sonner";

interface RevenueData {
  total: number;
  cash: number;
  card: number;
  online: number;
}

interface ServiceRevenue {
  service: string;
  revenue: number;
  percentage: number;
}

interface StaffPerformance {
  staff: string;
  bookings: number;
  revenue: number;
  rating: number;
}

interface PopularService {
  service: string;
  count: number;
  trend: string;
}

export default function ReportsAnalytics() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState("7days");
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueData>({
    total: 0,
    cash: 0,
    card: 0,
    online: 0,
  });
  const [serviceRevenue, setServiceRevenue] = useState<ServiceRevenue[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [popularServices, setPopularServices] = useState<PopularService[]>([]);
  const [operationalMetrics, setOperationalMetrics] = useState({
    staffUtilization: 0,
    noShowRate: 0,
    avgServiceDuration: 0,
    peakBookingTime: "N/A",
  });

  useEffect(() => {
    if (profile?.business_id) {
      fetchData();
    }
  }, [profile?.business_id, period]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "30days":
        startDate = subDays(now, 30);
        break;
      case "90days":
        startDate = subDays(now, 90);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = subDays(now, 7);
    }

    return {
      start: startOfDay(startDate).toISOString(),
      end: endOfDay(now).toISOString(),
    };
  };

  const fetchData = async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    const { start, end } = getDateRange();

    try {
      // Fetch sales data
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("price_usd, payment_method")
        .eq("business_id", profile.business_id)
        .gte("created_at", start)
        .lte("created_at", end);

      if (salesError) throw salesError;

      // Calculate revenue
      const revenueData: RevenueData = {
        total: 0,
        cash: 0,
        card: 0,
        online: 0,
      };

      (sales || []).forEach((sale) => {
        const amount = sale.price_usd || 0;
        revenueData.total += amount;
        if (sale.payment_method === "cash") {
          revenueData.cash += amount;
        } else if (sale.payment_method === "card") {
          revenueData.card += amount;
        } else if (sale.payment_method === "online") {
          revenueData.online += amount;
        }
      });

      setRevenue(revenueData);

      // Fetch service revenue
      const { data: serviceSales, error: serviceError } = await supabase
        .from("sales")
        .select("price_usd, service_name")
        .eq("business_id", profile.business_id)
        .gte("created_at", start)
        .lte("created_at", end)
        .not("service_name", "is", null);

      if (!serviceError && serviceSales) {
        const serviceMap = new Map<string, number>();
        serviceSales.forEach((sale) => {
          const service = sale.service_name || "Unknown";
          const amount = sale.price_usd || 0;
          serviceMap.set(service, (serviceMap.get(service) || 0) + amount);
        });

        const serviceRevenueData: ServiceRevenue[] = Array.from(serviceMap.entries())
          .map(([service, revenue]) => ({
            service,
            revenue: Math.round(revenue * 100) / 100,
            percentage: revenueData.total > 0 ? Math.round((revenue / revenueData.total) * 100) : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        setServiceRevenue(serviceRevenueData);
      }

      // Fetch appointments for operational metrics
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("status, start_time, end_time, service_id, staff_id")
        .eq("business_id", profile.business_id)
        .gte("appointment_date", start.split("T")[0])
        .lte("appointment_date", end.split("T")[0]);

      if (!appointmentsError && appointments) {
        const totalAppointments = appointments.length;
        const noShows = appointments.filter((apt) => apt.status === "cancelled").length;
        const noShowRate = totalAppointments > 0 ? (noShows / totalAppointments) * 100 : 0;

        // Calculate average service duration (simplified)
        const durations = appointments
          .filter((apt) => apt.start_time && apt.end_time)
          .map((apt) => {
            const start = new Date(`2000-01-01T${apt.start_time}`);
            const end = new Date(`2000-01-01T${apt.end_time}`);
            return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
          });
        const avgDuration = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

        // Calculate peak booking time (simplified - using hour)
        const hourCounts = new Map<number, number>();
        appointments.forEach((apt) => {
          if (apt.start_time) {
            const hour = parseInt(apt.start_time.split(":")[0]);
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          }
        });
        let peakHour = 14; // Default 2 PM
        let maxCount = 0;
        hourCounts.forEach((count, hour) => {
          if (count > maxCount) {
            maxCount = count;
            peakHour = hour;
          }
        });
        const peakTime = `${peakHour}:00 - ${peakHour + 2}:00`;

        // Calculate staff utilization (simplified)
        const { data: staffData } = await supabase
          .from("staff")
          .select("id")
          .eq("business_id", profile.business_id);

        const totalStaff = staffData?.length || 1;
        const staffWithAppointments = new Set(
          appointments.map((apt) => apt.staff_id).filter(Boolean)
        ).size;
        const utilization = (staffWithAppointments / totalStaff) * 100;

        setOperationalMetrics({
          staffUtilization: Math.round(utilization),
          noShowRate: Math.round(noShowRate * 10) / 10,
          avgServiceDuration: avgDuration,
          peakBookingTime: peakTime,
        });
      }

      // Fetch staff performance
      const { data: staffAppointments, error: staffError } = await (supabase
        .from("appointments")
        .select("staff_id, payment_amount")
        .eq("business_id", profile.business_id)
        .gte("appointment_date", start.split("T")[0])
        .lte("appointment_date", end.split("T")[0])
        .eq("status", "completed") as any);

      if (!staffError && staffAppointments) {
        const staffMap = new Map<string, { bookings: number; revenue: number }>();
        (staffAppointments as any[]).forEach((apt: any) => {
          if (apt.staff_id) {
            const existing = staffMap.get(apt.staff_id) || { bookings: 0, revenue: 0 };
            existing.bookings += 1;
            existing.revenue += apt.payment_amount || 0;
            staffMap.set(apt.staff_id, existing);
          }
        });

        // Get staff names and ratings
        const staffIds = Array.from(staffMap.keys());
        if (staffIds.length > 0) {
          const { data: staffData } = await supabase
            .from("staff")
            .select("id, full_name")
            .eq("business_id", profile.business_id)
            .in("id", staffIds);

          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("staff_id, rating")
            .eq("business_id", profile.business_id)
            .in("staff_id", staffIds);

          const staffRatings = new Map<string, number[]>();
          reviewsData?.forEach((review) => {
            if (review.staff_id) {
              const ratings = staffRatings.get(review.staff_id) || [];
              ratings.push(review.rating);
              staffRatings.set(review.staff_id, ratings);
            }
          });

          const performanceData: StaffPerformance[] = (staffData || [])
            .map((staff) => {
              const stats = staffMap.get(staff.id) || { bookings: 0, revenue: 0 };
              const ratings = staffRatings.get(staff.id) || [];
              const avgRating =
                ratings.length > 0
                  ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                  : 0;

              return {
                staff: staff.full_name || "Unknown",
                bookings: stats.bookings,
                revenue: Math.round(stats.revenue * 100) / 100,
                rating: Math.round(avgRating * 10) / 10,
              };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3);

          setStaffPerformance(performanceData);
        }
      }

      // Fetch popular services
      const { data: serviceAppointments, error: serviceAppError } = await supabase
        .from("appointments")
        .select("service_id")
        .eq("business_id", profile.business_id)
        .gte("appointment_date", start.split("T")[0])
        .lte("appointment_date", end.split("T")[0]);

      if (!serviceAppError && serviceAppointments) {
        const serviceCounts = new Map<string, number>();
        serviceAppointments.forEach((apt) => {
          if (apt.service_id) {
            serviceCounts.set(apt.service_id, (serviceCounts.get(apt.service_id) || 0) + 1);
          }
        });

        const serviceIds = Array.from(serviceCounts.keys());
        if (serviceIds.length > 0) {
          const { data: servicesData } = await supabase
            .from("services")
            .select("id, name")
            .eq("business_id", profile.business_id)
            .in("id", serviceIds);

          const popularData: PopularService[] = (servicesData || [])
            .map((service) => ({
              service: service.name || "Unknown",
              count: serviceCounts.get(service.id) || 0,
              trend: "+0%", // Simplified - would need historical data for real trends
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          setPopularServices(popularData);
        }
      }
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleExportPDF = async () => {
    try {
      const exportData: AnalyticsReportData = {
        period: period === "7days" ? "Last 7 days" : period === "30days" ? "Last 30 days" : period === "90days" ? "Last 90 days" : "This year",
        revenue,
        serviceRevenue,
        staffPerformance,
        popularServices,
        operationalMetrics
      };
      
      const businessName = profile?.businesses?.business_name || "Business";
      await exportAnalyticsToPDF(exportData, businessName);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error("Error exporting PDF");
    }
  };

  const handleExportExcel = async () => {
    try {
      const exportData: AnalyticsReportData = {
        period: period === "7days" ? "Last 7 days" : period === "30days" ? "Last 30 days" : period === "90days" ? "Last 90 days" : "This year",
        revenue,
        serviceRevenue,
        staffPerformance,
        popularServices,
        operationalMetrics
      };
      
      const businessName = profile?.businesses?.business_name || "Business";
      await exportAnalyticsToExcel(exportData, businessName);
      toast.success("Excel exported successfully");
    } catch (error) {
      console.error("Export Excel error:", error);
      toast.error("Error exporting Excel");
    }
  };

  const handleExportCSV = async () => {
    try {
      const exportData: AnalyticsReportData = {
        period: period === "7days" ? "Last 7 days" : period === "30days" ? "Last 30 days" : period === "90days" ? "Last 90 days" : "This year",
        revenue,
        serviceRevenue,
        staffPerformance,
        popularServices,
        operationalMetrics
      };
      
      const businessName = profile?.businesses?.business_name || "Business";
      await exportAnalyticsToCSV(exportData, businessName);
      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export CSV error:", error);
      toast.error("Error exporting CSV");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="text-center py-8">Loading analytics...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">Business insights and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
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
          </div>
        </div>

        {/* Revenue Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.total)}</p>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>Revenue</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Cash Payments</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.cash)}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenue.total > 0
                      ? Math.round((revenue.cash / revenue.total) * 100)
                      : 0}
                    % of total
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Card Payments</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.card)}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenue.total > 0
                      ? Math.round((revenue.card / revenue.total) * 100)
                      : 0}
                    % of total
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Online Payments</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.online)}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenue.total > 0
                      ? Math.round((revenue.online / revenue.total) * 100)
                      : 0}
                    % of total
                  </p>
                </div>
              </div>
              <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">Revenue Chart Placeholder</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Revenue by Service */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Revenue by Service</CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {serviceRevenue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No service revenue data
                </div>
              ) : (
                <div className="space-y-4">
                  {serviceRevenue.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.service}</span>
                        <span className="font-medium">{formatCurrency(item.revenue)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Staff Performance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Staff Performance</CardTitle>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {staffPerformance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No staff performance data
                </div>
              ) : (
                <div className="space-y-4">
                  {staffPerformance.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.staff}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.bookings} bookings • {formatCurrency(item.revenue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item.rating || 0}</span>
                          <span className="text-yellow-500">★</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Operational Metrics */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Operational Metrics</CardTitle>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Average Staff Utilization</span>
                  <span className="font-bold">{operationalMetrics.staffUtilization}%</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">No-Show Rate</span>
                  <span className="font-bold">{operationalMetrics.noShowRate}%</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Average Service Duration</span>
                  <span className="font-bold">{operationalMetrics.avgServiceDuration} min</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Peak Booking Time</span>
                  <span className="font-bold">{operationalMetrics.peakBookingTime}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Popular Services */}
          <Card>
            <CardHeader>
              <CardTitle>Most Popular Services</CardTitle>
            </CardHeader>
            <CardContent>
              {popularServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No popular services data
                </div>
              ) : (
                <div className="space-y-3">
                  {popularServices.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.service}</p>
                        <p className="text-sm text-muted-foreground">{item.count} bookings</p>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          item.trend.startsWith("+") ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {item.trend}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
