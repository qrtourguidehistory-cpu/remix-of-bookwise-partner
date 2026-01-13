import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export default function SaleForm() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Array<{product_id: string; quantity: number; unit_price: number}>>([]);
  const [formData, setFormData] = useState({
    client_type: "walk-in",
    client_id: "",
    client_name: "",
    service_id: "",
    service_name: "",
    staff_id: "",
    price_usd: "",
    price_mxn: "",
    tip_amount: "",
    payment_method: "cash",
    notes: "",
  });

  useEffect(() => {
    if (profile?.business_id) {
      fetchData();
    }
  }, [profile?.business_id]);

  const fetchData = async () => {
    if (!profile?.business_id) return;
    
    const [clientsRes, servicesRes, staffRes, productsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("business_id", profile.business_id).order("full_name"),
      supabase.from("services").select("*").eq("business_id", profile.business_id).eq("is_active", true).order("name"),
      supabase.from("staff").select("*").eq("business_id", profile.business_id).eq("is_active", true).order("full_name"),
      supabase.from("inventory").select("*").eq("business_id", profile.business_id).eq("is_active", true).order("name"),
    ]);

    const clientsList = clientsRes.data || [];
    setClients(clientsList);

    if (servicesRes.data) setServices(servicesRes.data);
    if (staffRes.data) setStaff(staffRes.data);
    if (productsRes.data) setProducts(productsRes.data);
  };

  const handleServiceSelect = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      setFormData({
        ...formData,
        service_id: serviceId,
        service_name: service.name,
        price_usd: service.price_usd?.toString() || service.price?.toString() || "",
        price_mxn: service.price_mxn?.toString() || "",
      });
    }
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        client_id: clientId,
        client_name: client.full_name,
        client_type: "existing",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate business_id FIRST before creating saleData
    if (!profile?.business_id) {
      toast({
        title: "Error",
        description: "No business found",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // Calcular total de productos
      let productsTotal = 0;
      const inventoryUsed: Array<{product_id: string; product_name: string; quantity: number; unit_price: number; cost_price: number}> = [];
      
      for (const selected of selectedProducts) {
        const product = products.find(p => p.id === selected.product_id);
        if (product) {
          const subtotal = selected.quantity * selected.unit_price;
          productsTotal += subtotal;
          inventoryUsed.push({
            product_id: product.id,
            product_name: product.name,
            quantity: selected.quantity,
            unit_price: selected.unit_price,
            cost_price: product.cost_price || 0,
          });
          
          // Actualizar stock del producto
          const newStock = product.current_stock - selected.quantity;
          if (newStock < 0) {
            toast({
              title: "Error",
              description: language === "es" 
                ? `Stock insuficiente para ${product.name}` 
                : `Insufficient stock for ${product.name}`,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          
          // Actualizar stock
          const { error: stockError } = await supabase
            .from("inventory")
            .update({ current_stock: newStock })
            .eq("id", product.id);
          
          if (stockError) {
            console.error("Error updating stock:", stockError);
            // Continuar aunque falle la actualización de stock
          }
          
          // Registrar movimiento de inventario
          await supabase.from("inventory_movements").insert({
            business_id: profile.business_id,
            inventory_id: product.id,
            movement_type: "out",
            quantity: selected.quantity,
            reference_type: "sale",
            notes: `Venta a ${formData.client_name || "Walk-in"}`,
          });
        }
      }
      
      // Calcular precio total (servicio + productos)
      const servicePrice = parseFloat(formData.price_usd) || 0;
      const totalPrice = servicePrice + productsTotal;
      
      const saleData = {
        business_id: profile.business_id,
        client_id: formData.client_type === "existing" ? formData.client_id : null,
        client_name: formData.client_name || "Walk-in",
        client_type: formData.client_type,
        service_id: formData.service_id || null,
        service_name: formData.service_name || (selectedProducts.length > 0 ? "Venta de productos" : ""),
        staff_id: formData.staff_id || null,
        price_usd: totalPrice,
        price_mxn: parseFloat(formData.price_mxn) || 0,
        tip_amount: parseFloat(formData.tip_amount) || 0,
        payment_method: formData.payment_method,
        notes: formData.notes,
        sale_date: new Date().toISOString().split("T")[0],
        sale_time: new Date().toTimeString().split(" ")[0],
        inventory_used: selectedProducts.length > 0 ? inventoryUsed : null,
      };
      
      const { error } = await supabase.from("sales").insert(saleData);

      if (error) throw error;

      toast({
        title: t("success") || "Success",
        description: language === "es" ? "Venta registrada exitosamente" : "Sale recorded successfully",
      });

      navigate("/admin/sales");
    } catch (error) {
      console.error("Error saving sale:", error);
      toast({
        title: "Error",
        description: language === "es" ? "Error al guardar la venta" : "Failed to save sale",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Nueva Venta" : "New Sale"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>{language === "es" ? "Tipo de Cliente" : "Client Type"}</Label>
            <Select
              value={formData.client_type}
              onValueChange={(value) =>
                setFormData({ ...formData, client_type: value, client_id: "", client_name: "" })
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in</SelectItem>
                <SelectItem value="existing">{language === "es" ? "Cliente Existente" : "Existing Client"}</SelectItem>
                <SelectItem value="new">{language === "es" ? "Nuevo Cliente" : "New Client"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.client_type === "existing" && (
            <div>
              <Label>{language === "es" ? "Seleccionar Cliente" : "Select Client"}</Label>
              <Select value={formData.client_id} onValueChange={handleClientSelect}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={language === "es" ? "Elegir cliente..." : "Choose client..."} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.client_type === "new" && (
            <div>
              <Label>{language === "es" ? "Nombre del Cliente" : "Client Name"}</Label>
              <Input
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                required
                className="mt-2"
                placeholder={language === "es" ? "Nombre completo" : "Full name"}
              />
            </div>
          )}

          <div>
            <Label>{language === "es" ? "Servicio" : "Service"}</Label>
            <Select value={formData.service_id} onValueChange={handleServiceSelect}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={language === "es" ? "Seleccionar servicio..." : "Select service..."} />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - ${service.price_usd || service.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{language === "es" ? "Personal" : "Staff"}</Label>
            <Select value={formData.staff_id} onValueChange={(value) => setFormData({ ...formData, staff_id: value })}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={language === "es" ? "Seleccionar personal..." : "Select staff..."} />
              </SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{language === "es" ? "Precio USD" : "Price USD"} ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_usd}
                onChange={(e) => setFormData({ ...formData, price_usd: e.target.value })}
                required
                className="mt-2"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>{language === "es" ? "Precio RD$" : "Price RD$"}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_mxn}
                onChange={(e) => setFormData({ ...formData, price_mxn: e.target.value })}
                className="mt-2"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label>{language === "es" ? "Propina" : "Tip Amount"}</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.tip_amount}
              onChange={(e) => setFormData({ ...formData, tip_amount: e.target.value })}
              className="mt-2"
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>{language === "es" ? "Método de Pago" : "Payment Method"}</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{language === "es" ? "Efectivo" : "Cash"}</SelectItem>
                <SelectItem value="card">{language === "es" ? "Tarjeta" : "Card"}</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{language === "es" ? "Notas" : "Notes"}</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-2"
              rows={3}
              placeholder={language === "es" ? "Notas adicionales..." : "Additional notes..."}
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t("loading") || "Loading..." : language === "es" ? "Guardar Venta" : "Save Sale"}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}