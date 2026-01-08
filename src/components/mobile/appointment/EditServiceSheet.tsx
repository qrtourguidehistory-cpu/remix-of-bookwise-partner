import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X, ChevronRight, Heart, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatTime } from "@/lib/timeFormat";
import { toast } from "sonner";

import type { ServicePick } from "./AddServiceSheet";

interface EditServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  appointmentStartTime?: string | null;
  service: ServicePick | null;
  // Additional fields to identify the specific record
  existingStartTime?: string | null;
  existingStaffId?: string | null;
  existingCreatedAt?: string | null;
  onApplied?: () => void;
}

export function EditServiceSheet({
  open,
  onOpenChange,
  appointmentId,
  appointmentStartTime,
  service,
  existingStartTime,
  existingStaffId,
  existingCreatedAt,
  onApplied,
}: EditServiceSheetProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();

  const [staff, setStaff] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [staffId, setStaffId] = useState<string>("none");
  const [price, setPrice] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [discount, setDiscount] = useState<string>("none");
  const [discountValue, setDiscountValue] = useState<string>("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!profile?.business_id) return;

    const load = async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("business_id", profile.business_id)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setStaff((data || []) as any);
    };
    load();
  }, [open, profile?.business_id]);

  useEffect(() => {
    if (!open || !service) return;
    // Use existing staff_id if available, otherwise "none"
    setStaffId(service.existingStaffId || "none");
    setPrice(String(Number(service.price || 0)));
    setDuration(String(service.duration_minutes || 0));
    // Use existing start_time if available, otherwise appointmentStartTime
    setStartTime(service.existingStartTime || appointmentStartTime || "");
    setDiscount("none");
    setDiscountValue("0");
  }, [open, service, appointmentStartTime]);

  const computedTotal = useMemo(() => {
    const p = Number(price || 0);
    const dv = Number(discountValue || 0);
    if (discount === "percent") return Math.max(0, p - p * (dv / 100));
    if (discount === "amount") return Math.max(0, p - dv);
    return p;
  }, [price, discount, discountValue]);

  const canSave = !!service && !!appointmentId && !saving;

  const handleApply = async () => {
    if (!service) return;
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      const serviceData = {
        appointment_id: appointmentId,
        service_id: service.id,
        price: computedTotal,
        staff_id: staffId === "none" ? null : staffId,
        start_time: startTime || null,
        duration_minutes: duration ? Number(duration) : service.duration_minutes,
        discount_type: discount === "none" ? null : discount,
        discount_value: Number(discountValue || 0),
        quantity: 1,
      };

      // Check if we're editing an existing record or creating a new one
      if (existingCreatedAt && existingStartTime !== undefined) {
        // Update existing record - use composite key match
        const { error } = await (supabase
          .from("appointment_services" as any)
          .update({
            price: serviceData.price,
            staff_id: serviceData.staff_id,
            start_time: serviceData.start_time,
            duration_minutes: serviceData.duration_minutes,
            discount_type: serviceData.discount_type,
            discount_value: serviceData.discount_value,
          })
          .eq("appointment_id", appointmentId)
          .eq("service_id", service.id)
          .eq("created_at", existingCreatedAt) as any);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await (supabase
          .from("appointment_services" as any)
          .insert(serviceData) as any);

        if (error) throw error;
      }

      toast.success(language === "es" ? "Servicio aplicado" : "Service applied");
      onApplied?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast.error(error?.message || (language === "es" ? "Error al guardar servicio" : "Error saving service"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!service) return;
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      // Delete the record using composite key
      if (existingCreatedAt) {
        const { error } = await (supabase
          .from("appointment_services" as any)
          .delete()
          .eq("appointment_id", appointmentId)
          .eq("service_id", service.id)
          .eq("created_at", existingCreatedAt) as any);

        if (error) throw error;
      }

      toast.success(language === "es" ? "Servicio eliminado" : "Service deleted");
      onApplied?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting service:", error);
      toast.error(error?.message || (language === "es" ? "Error al eliminar servicio" : "Error deleting service"));
    } finally {
      setSaving(false);
    }
  };

  if (!service) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border h-[85vh]">
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Editar servicio" : "Edit service"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Edita el servicio agregado a la cita."
              : "Edit the service added to the appointment."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex items-center justify-between">
          <div className="text-2xl font-bold">{language === "es" ? "Editar servicio" : "Edit service"}</div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 space-y-6 pb-28">
          {/* Service selector row (visual only for now) */}
          <button className="w-full border rounded-xl p-4 flex items-center justify-between text-left">
            <div className="font-medium">
              {service.name}, {service.duration_minutes}min
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="space-y-2">
            <div className="text-sm font-semibold">{language === "es" ? "Miembro del equipo" : "Team member"}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-12 w-12">
                <Heart className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-12 flex-1">
                  <SelectValue placeholder={language === "es" ? "Seleccionar" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{language === "es" ? "Sin asignar" : "Unassigned"}</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.id.slice(0, 6)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold">{language === "es" ? "Precio" : "Service price"}</div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">DOP</div>
                <Input className="pl-12 h-12" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{language === "es" ? "Descuento" : "Discount"}</div>
              <Select value={discount} onValueChange={setDiscount}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={language === "es" ? "Sin descuento" : "No discount"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{language === "es" ? "Sin descuento" : "No discount"}</SelectItem>
                  <SelectItem value="percent">{language === "es" ? "% descuento" : "% discount"}</SelectItem>
                  <SelectItem value="amount">{language === "es" ? "Monto fijo" : "Fixed amount"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {discount !== "none" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">{language === "es" ? "Valor del descuento" : "Discount value"}</div>
              <Input className="h-12" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} inputMode="decimal" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold">{language === "es" ? "Hora de inicio" : "Start time"}</div>
              <Input className="h-12" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder={appointmentStartTime || "13:30"} />
              {!!startTime && (
                <div className="text-xs text-muted-foreground">
                  {language === "es" ? "Vista" : "Preview"}: {formatTime(startTime, "12h")}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{language === "es" ? "Duración" : "Duration"}</div>
              <Input className="h-12" value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
            </div>
          </div>

          <Button variant="outline" className="h-12 rounded-full justify-start gap-2">
            <Plus className="h-4 w-4" />
            {language === "es" ? "Agregar tiempo extra" : "Add extra time"}
          </Button>
        </div>

        <div className="sticky bottom-0 border-t bg-card p-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={handleDelete}
            disabled={saving}
            title={language === "es" ? "Eliminar" : "Delete"}
          >
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
          <Button className="h-12 flex-1 rounded-full" onClick={handleApply} disabled={!canSave}>
            {language === "es" ? "Aplicar" : "Apply"}{" "}
            <span className="ml-2 text-sm opacity-80">DOP {computedTotal.toFixed(0)}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
