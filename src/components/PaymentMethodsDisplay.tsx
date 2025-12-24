import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { CreditCard, Banknote, Smartphone } from "lucide-react";

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  icon: string | null;
}

interface PaymentMethodsDisplayProps {
  businessId: string;
}

const iconMap: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-5 h-5" />,
  card: <CreditCard className="w-5 h-5" />,
  digital: <Smartphone className="w-5 h-5" />,
};

export default function PaymentMethodsDisplay({ businessId }: PaymentMethodsDisplayProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, [businessId]);

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, name, type, icon")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("name") as any;

      if (error) throw error;
      setMethods((data as PaymentMethod[]) || []);
    } catch (error) {
      console.error("Error loading payment methods:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading payment methods...</div>;
  }

  if (methods.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">Accepted Payment Methods</h3>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <div
            key={method.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm"
          >
            {iconMap[method.type] || <CreditCard className="w-5 h-5" />}
            <span>{method.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
