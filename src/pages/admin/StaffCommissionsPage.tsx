import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DollarSign, Plus, Check } from "lucide-react";

export default function StaffCommissionsPage() {
  const { profile } = useAuth();
  const [configs, setConfigs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    staff_id: "",
    service_id: "",
    commission_percentage: "",
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.business_id) return;

    try {
      const [configsRes, paymentsRes, staffRes, servicesRes] = await Promise.all([
        supabase
          .from("commission_configs")
          .select("*, staff(*), services(*)")
          .eq("business_id", profile.business_id),
        supabase
          .from("commission_payments")
          .select("*, staff(*)")
          .eq("business_id", profile.business_id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("staff")
          .select("*")
          .eq("business_id", profile.business_id)
          .eq("is_active", true),
        supabase
          .from("services")
          .select("*")
          .eq("business_id", profile.business_id)
          .eq("is_active", true),
      ]);

      if (configsRes.error) throw configsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setConfigs(configsRes.data || []);
      setPayments(paymentsRes.data || []);
      setStaff(staffRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error: any) {
      toast.error("Error loading commission data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!profile?.business_id || !formData.staff_id || !formData.commission_percentage) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { error } = await supabase.from("commission_configs").insert({
        business_id: profile.business_id,
        staff_id: formData.staff_id,
        service_id: formData.service_id || null,
        commission_percentage: parseFloat(formData.commission_percentage),
      });

      if (error) throw error;
      toast.success("Commission configuration saved");
      setSheetOpen(false);
      setFormData({ staff_id: "", service_id: "", commission_percentage: "" });
      loadData();
    } catch (error: any) {
      toast.error("Error saving configuration");
      console.error(error);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from("commission_payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);

      if (error) throw error;
      toast.success("Marked as paid");
      loadData();
    } catch (error: any) {
      toast.error("Error updating payment");
      console.error(error);
    }
  };

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">Staff Commissions</h2>
        </div>
      </div>
      <div className="p-4">
        <Tabs defaultValue="configuration" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="configuration" className="space-y-4">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Commission Rule
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Add Commission Configuration</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Staff Member *</Label>
                    <Select
                      value={formData.staff_id}
                      onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Service (optional - leave empty for global)</Label>
                    <Select
                      value={formData.service_id}
                      onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All services (global)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All services (global)</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Commission Percentage *</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.commission_percentage}
                      onChange={(e) =>
                        setFormData({ ...formData, commission_percentage: e.target.value })
                      }
                      placeholder="e.g., 15"
                    />
                  </div>

                  <Button onClick={handleSaveConfig} className="w-full">
                    Save Configuration
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : configs.length === 0 ? (
              <Card className="p-8 text-center">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No commission rules yet</h3>
                <p className="text-sm text-muted-foreground">
                  Set up commission percentages for your staff
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {configs.map((config) => (
                  <Card key={config.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{config.staff?.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {config.services?.name || "All services"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {config.commission_percentage}%
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {payments.filter((p) => p.status === "pending").length === 0 ? (
              <Card className="p-8 text-center">
                <Check className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">All caught up!</h3>
                <p className="text-sm text-muted-foreground">No pending commission payments</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {payments
                  .filter((p) => p.status === "pending")
                  .map((payment) => (
                    <Card key={payment.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{payment.staff?.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(payment.period_start).toLocaleDateString()} -{" "}
                            {new Date(payment.period_end).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary">
                            ${payment.commission_amount.toFixed(2)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            on ${payment.total_sales.toFixed(2)} sales
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleMarkAsPaid(payment.id)}
                        className="w-full mt-2"
                        size="sm"
                      >
                        Mark as Paid
                      </Button>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {payments.filter((p) => p.status === "paid").length === 0 ? (
              <Card className="p-8 text-center">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No payment history</h3>
                <p className="text-sm text-muted-foreground">
                  Paid commissions will appear here
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {payments
                  .filter((p) => p.status === "paid")
                  .map((payment) => (
                    <Card key={payment.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{payment.staff?.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Paid on {new Date(payment.paid_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            ${payment.commission_amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
