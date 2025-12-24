import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export type ServicePick = {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number;
  price: number;
  // Optional fields to identify existing appointment_services record
  existingStartTime?: string | null;
  existingStaffId?: string | null;
  existingCreatedAt?: string | null;
};

interface AddServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectService: (service: ServicePick) => void;
}

export function AddServiceSheet({ open, onOpenChange, onSelectService }: AddServiceSheetProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [services, setServices] = useState<ServicePick[]>([]);
  const [recent, setRecent] = useState<ServicePick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!profile?.business_id) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("services")
          .select("id, name, category, duration_minutes, price")
          .eq("business_id", profile.business_id)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (error) throw error;
        setServices((data || []) as any);

        // Recently booked: last appointments created with a service_id
        const { data: recentApts } = await supabase
          .from("appointments")
          .select("service_id, services!appointments_service_id_fkey(id, name, category, duration_minutes, price)")
          .eq("business_id", profile.business_id)
          .not("service_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);

        const rec: ServicePick[] = [];
        (recentApts || []).forEach((row: any) => {
          const s = row.services;
          if (s?.id && !rec.find((x) => x.id === s.id)) {
            rec.push(s);
          }
        });
        setRecent(rec.slice(0, 2));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, profile?.business_id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServicePick[]>();
    filtered.forEach((s) => {
      const key = s.category || (language === "es" ? "Servicios" : "Services");
      map.set(key, [...(map.get(key) || []), s]);
    });
    return Array.from(map.entries());
  }, [filtered, language]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border h-[85vh]">
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Seleccionar servicio" : "Select service"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Busca y selecciona un servicio para agregar a la cita."
              : "Search and select a service to add to the appointment."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex items-center justify-between">
          <div className="text-2xl font-bold">
            {language === "es" ? "Seleccionar servicio" : "Select service"}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder={language === "es" ? "Buscar por nombre de servicio" : "Search by service name"}
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(85vh-120px)]">
          <div className="px-4 pb-8">
            {recent.length > 0 && !query.trim() && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-lg font-semibold">
                    {language === "es" ? "Recientes" : "Recently booked"}
                  </div>
                  <span className="text-xs rounded-full bg-muted px-2 py-0.5">{recent.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {recent.map((s) => (
                    <button
                      key={s.id}
                      className="w-full border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => {
                        onSelectService(s);
                        onOpenChange(false);
                      }}
                    >
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.duration_minutes} min
                      </div>
                      <div className="mt-2 font-medium">DOP {Number(s.price || 0).toFixed(0)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {grouped.map(([category, items]) => (
              <div key={category} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-lg font-semibold">{category}</div>
                  <span className="text-xs rounded-full bg-muted px-2 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      className={cn(
                        "w-full flex items-center justify-between text-left",
                        "border rounded-xl p-4 hover:bg-muted/40 transition-colors"
                      )}
                      onClick={() => {
                        onSelectService(s);
                        onOpenChange(false);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-sm text-muted-foreground">{s.duration_minutes} min</div>
                      </div>
                      <div className="font-medium shrink-0">DOP {Number(s.price || 0).toFixed(0)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {!loading && grouped.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                {language === "es" ? "No se encontraron servicios" : "No services found"}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}


