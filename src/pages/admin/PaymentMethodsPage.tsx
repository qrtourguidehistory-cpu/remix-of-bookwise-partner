import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Banknote, Smartphone, Building2, Loader2, Save, ArrowLeft } from "lucide-react";

const PAYMENT_OPTIONS = [
  {
    id: "cash",
    type: "cash",
    labelEs: "Efectivo",
    labelEn: "Cash",
    icon: Banknote,
    descriptionEs: "Pago en efectivo al momento del servicio",
    descriptionEn: "Cash payment at time of service"
  },
  {
    id: "card",
    type: "card",
    labelEs: "Tarjeta de Crédito/Débito",
    labelEn: "Credit/Debit Card",
    icon: CreditCard,
    descriptionEs: "Aceptar pagos con tarjeta",
    descriptionEn: "Accept card payments"
  },
  {
    id: "bank_transfer",
    type: "bank_transfer",
    labelEs: "Transferencia Bancaria",
    labelEn: "Bank Transfer",
    icon: Building2,
    descriptionEs: "Transferencias desde cualquier banco",
    descriptionEn: "Transfers from any bank"
  },
  {
    id: "crypto",
    type: "crypto",
    labelEs: "Criptomonedas",
    labelEn: "Cryptocurrency",
    icon: Smartphone,
    descriptionEs: "Bitcoin, Ethereum y otras criptos",
    descriptionEn: "Bitcoin, Ethereum and other cryptos"
  }
];

export default function PaymentMethodsPage() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPaymentMethods = useCallback(async () => {
    if (!profile?.business_id) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("type")
        .eq("business_id", profile.business_id)
        .eq("is_active", true);

      if (error) throw error;
      setSelectedMethods(data?.map(m => m.type).filter(Boolean) || []);
    } catch (error: any) {
      toast.error(language === "es" ? "Error cargando métodos de pago" : "Error loading payment methods");
    } finally {
      setLoading(false);
    }
  }, [profile?.business_id, language]);

  // Use ref to keep stable reference for realtime subscription
  const loadPaymentMethodsRef = useRef(loadPaymentMethods);
  useEffect(() => {
    loadPaymentMethodsRef.current = loadPaymentMethods;
  }, [loadPaymentMethods]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!profile?.business_id) return;

    const channel = supabase
      .channel('payment-methods-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_methods',
          filter: `business_id=eq.${profile.business_id}`
        },
        () => {
          loadPaymentMethodsRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);


  const toggleMethod = (type: string) => {
    setSelectedMethods(prev => 
      prev.includes(type) 
        ? prev.filter(m => m !== type)
        : [...prev, type]
    );
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;
    
    setSaving(true);
    try {
      // Delete all existing methods for this business
      await supabase
        .from("payment_methods")
        .delete()
        .eq("business_id", profile.business_id);

      // Insert selected methods
      if (selectedMethods.length > 0) {
        const methodsToInsert = selectedMethods.map(type => {
          const option = PAYMENT_OPTIONS.find(o => o.type === type);
          return {
            business_id: profile.business_id,
            name: language === "es" ? option?.labelEs : option?.labelEn,
            type: type,
            is_active: true
          };
        });

        const { error } = await supabase
          .from("payment_methods")
          .insert(methodsToInsert);

        if (error) throw error;
      }

      toast.success(language === "es" ? "Métodos de pago guardados" : "Payment methods saved");
    } catch (error: any) {
      toast.error(language === "es" ? "Error guardando métodos de pago" : "Error saving payment methods");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {language === "es" ? "Volver" : "Back"}
            </Button>
            <h2 className="text-lg font-semibold">
              {language === "es" ? "Métodos de Pago" : "Payment Methods"}
            </h2>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {language === "es" ? "Guardar" : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        <p className="text-sm text-muted-foreground">
          {language === "es" 
            ? "Selecciona los métodos de pago que aceptas. Estos se mostrarán a tus clientes."
            : "Select the payment methods you accept. These will be shown to your clients."
          }
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {PAYMENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMethods.includes(option.type);
              
              return (
                <Card
                  key={option.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleMethod(option.type)}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleMethod(option.type)}
                      className="mt-1"
                    />
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${isSelected ? 'text-primary' : ''}`}>
                        {language === "es" ? option.labelEs : option.labelEn}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {language === "es" ? option.descriptionEs : option.descriptionEn}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {selectedMethods.length > 0 && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <h4 className="font-medium text-sm mb-2">
              {language === "es" ? "Métodos seleccionados:" : "Selected methods:"}
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedMethods.map(type => {
                const option = PAYMENT_OPTIONS.find(o => o.type === type);
                if (!option) return null;
                return (
                  <span 
                    key={type}
                    className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                  >
                    {language === "es" ? option.labelEs : option.labelEn}
                  </span>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
