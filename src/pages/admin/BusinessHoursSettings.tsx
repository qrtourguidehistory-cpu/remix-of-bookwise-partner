import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const daysOfWeek = [
  { value: 0, label: "Domingo", shortLabel: "Dom" },
  { value: 1, label: "Lunes", shortLabel: "Lun" },
  { value: 2, label: "Martes", shortLabel: "Mar" },
  { value: 3, label: "Miércoles", shortLabel: "Mié" },
  { value: 4, label: "Jueves", shortLabel: "Jue" },
  { value: 5, label: "Viernes", shortLabel: "Vie" },
  { value: 6, label: "Sábado", shortLabel: "Sáb" },
];

export default function BusinessHoursSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [businessHours, setBusinessHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.business_id) {
      fetchBusinessHours();
      
      // Subscribe to realtime updates for business_hours
      const channel = supabase
        .channel(`business-hours-${profile.business_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'business_hours',
            filter: `business_id=eq.${profile.business_id}`
          },
          (payload) => {
            // Refetch to get latest data
            fetchBusinessHours();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Successfully subscribed to realtime
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.business_id]);

  const fetchBusinessHours = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("day_of_week");

    if (error) {
      toast.error("Error al cargar horarios");
    } else if (data) {
      setBusinessHours(data);
    }
    setLoading(false);
  };

  const handleUpdateDay = async (dayOfWeek: number, field: string, value: any) => {
    if (!profile?.business_id) {
      toast.error("No se encontró el negocio");
      return;
    }

    const existingDay = businessHours.find(h => h.day_of_week === dayOfWeek && h.business_id === profile.business_id);
    
    // Map field names to database columns
    const dbField = field === 'is_open' ? 'is_closed' : 
                    field === 'start_time' ? 'open_time' :
                    field === 'end_time' ? 'close_time' : field;
    const dbValue = field === 'is_open' ? !value : value;
    
    if (existingDay) {
      const updateData: any = { [dbField]: dbValue };
      
      // When updating break times, ensure we preserve other fields
      // The dbField is already set to the correct database column name
      // dbValue is already the correct value (or inverted for is_open/is_closed)
      
      const { error } = await supabase
        .from("business_hours")
        .update(updateData)
        .eq("id", existingDay.id)
        .eq("business_id", profile.business_id);

      if (!error) {
        fetchBusinessHours();
        toast.success("Horario actualizado");
      } else {
        toast.error(error.message || "Error al actualizar");
      }
    } else {
      const currentDayHours = getDayHours(dayOfWeek);
      const newHours: any = {
        business_id: profile.business_id,
        day_of_week: dayOfWeek,
        open_time: field === 'start_time' ? value : (currentDayHours.start_time?.includes(':') ? currentDayHours.start_time : "08:00:00"),
        close_time: field === 'end_time' ? value : (currentDayHours.end_time?.includes(':') ? currentDayHours.end_time : "18:00:00"),
        is_closed: field === 'is_open' ? !value : false,
        break_start: field === 'break_start' ? value : null,
        break_end: field === 'break_end' ? value : null
      };
      
      // Don't override with dbField if it's the same as what we already set
      if (dbField !== 'open_time' && dbField !== 'close_time' && dbField !== 'is_closed') {
        newHours[dbField] = dbValue;
      }

      const { error, data } = await supabase
        .from("business_hours")
        .insert(newHours)
        .select()
        .single();

      if (!error && data) {
        fetchBusinessHours();
        toast.success("Horario creado");
      } else {
        toast.error(error?.message || "Error al crear horario");
      }
    }
  };

  const copyToAllDays = async (sourceDayOfWeek: number) => {
    if (!profile?.business_id) return;
    
    const sourceDay = businessHours.find(h => h.day_of_week === sourceDayOfWeek && h.business_id === profile.business_id);
    if (!sourceDay) return;

    const updates = daysOfWeek
      .filter(d => d.value !== sourceDayOfWeek)
      .map(async (day) => {
        const existingDay = businessHours.find(h => h.day_of_week === day.value && h.business_id === profile.business_id);
        const updateData = {
          open_time: sourceDay.open_time || sourceDay.start_time,
          close_time: sourceDay.close_time || sourceDay.end_time,
          is_closed: sourceDay.is_closed !== undefined ? sourceDay.is_closed : !sourceDay.is_open,
          break_start: sourceDay.break_start,
          break_end: sourceDay.break_end
        } as any;
        
        if (existingDay) {
          return supabase
            .from("business_hours")
            .update(updateData)
            .eq("id", existingDay.id)
            .eq("business_id", profile.business_id);
        } else {
          return supabase
            .from("business_hours")
            .insert({
              business_id: profile.business_id,
              day_of_week: day.value,
              ...updateData
            } as any);
        }
      });

    await Promise.all(updates);
    await fetchBusinessHours();
    toast.success("Horarios copiados a todos los días");
  };

  const getDayHours = (dayOfWeek: number) => {
    const day = businessHours.find(h => h.day_of_week === dayOfWeek && h.business_id === profile?.business_id);
    return day ? {
      day_of_week: day.day_of_week,
      start_time: day.open_time || day.start_time || "08:00:00",
      end_time: day.close_time || day.end_time || "18:00:00",
      is_open: day.is_closed !== undefined ? !day.is_closed : (day.is_open !== undefined ? day.is_open : true),
      break_start: day.break_start || null,
      break_end: day.break_end || null
    } : {
      day_of_week: dayOfWeek,
      start_time: "08:00:00",
      end_time: "18:00:00",
      is_open: true,
      break_start: null,
      break_end: null
    };
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4">Cargando...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Horarios del Negocio</h1>
        </div>

        <div className="space-y-4">
          {daysOfWeek.map((day) => {
            const hours = getDayHours(day.value);
            
            return (
              <Card key={day.value}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{day.label}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToAllDays(day.value)}
                        title="Copiar a todos los días"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={hours.is_open}
                        onCheckedChange={(checked) => handleUpdateDay(day.value, "is_open", checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                
                {hours.is_open && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs mb-2 block">Apertura</Label>
                        <TimePicker
                          value={hours.start_time || "08:00:00"}
                          onChange={(time) => handleUpdateDay(day.value, "start_time", time)}
                          placeholder="Seleccionar hora"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Cierre</Label>
                        <TimePicker
                          value={hours.end_time || "18:00:00"}
                          onChange={(time) => handleUpdateDay(day.value, "end_time", time)}
                          placeholder="Seleccionar hora"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <Label className="text-xs text-muted-foreground mb-2 block">Break / Comida (Opcional)</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs mb-2 block">Inicio Break</Label>
                          <TimePicker
                            value={hours.break_start ? hours.break_start : undefined}
                            onChange={(time) => handleUpdateDay(day.value, "break_start", time || null)}
                            placeholder="--:--"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2 block">Fin Break</Label>
                          <TimePicker
                            value={hours.break_end ? hours.break_end : undefined}
                            onChange={(time) => handleUpdateDay(day.value, "break_end", time || null)}
                            placeholder="--:--"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
}