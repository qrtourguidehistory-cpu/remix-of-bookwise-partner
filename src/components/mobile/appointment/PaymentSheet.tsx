import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, Banknote, Gift, Scissors, DollarSign, CheckCircle2, CreditCard, ArrowLeftRight, Coins, Receipt } from "lucide-react";

export type PaymentMethod = "cash" | "card" | "transfer" | "crypto" | "credit";

interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onPay: (method: PaymentMethod) => Promise<void> | void;
}

export function PaymentSheet({ open, onOpenChange, total, onPay }: PaymentSheetProps) {
  const { language } = useLanguage();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!open) {
      setMethod("cash");
      setPaying(false);
      setPaid(false);
    }
  }, [open]);

  const options: Array<{ value: PaymentMethod; label: string; Icon: React.ComponentType<{ className?: string }>; isSmall?: boolean }> =
    useMemo(
      () => [
        { value: "cash", label: language === "es" ? "Efectivo" : "Cash", Icon: Banknote },
        { value: "card", label: language === "es" ? "Tarjeta D/C" : "Card", Icon: CreditCard },
        { value: "transfer", label: language === "es" ? "Transferencia" : "Transfer", Icon: ArrowLeftRight },
        { value: "crypto", label: language === "es" ? "Crypto moneda" : "Crypto", Icon: Coins },
        { value: "credit", label: language === "es" ? "Crédito" : "Credit", Icon: Receipt, isSmall: true },
      ],
      [language]
    );

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      await onPay(method);
      setPaid(true);
      // Auto-close after a short confirmation
      setTimeout(() => onOpenChange(false), 1200);
    } finally {
      setPaying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border h-[85vh]" hideDefaultClose>
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Seleccionar pago" : "Select payment"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Elige un método de pago y confirma."
              : "Choose a payment method and confirm."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
            <div className="text-2xl font-bold">{language === "es" ? "Seleccionar pago" : "Select payment"}</div>
          </div>
          <div className="text-sm font-semibold">DOP {total.toFixed(0)}</div>
        </div>

        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {options.filter(opt => !opt.isSmall).map(({ value, label, Icon }) => {
              const selected = value === method;
              return (
                <button
                  key={value}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-border"
                  )}
                >
                  <Icon className={cn("h-7 w-7", selected ? "text-primary" : "text-muted-foreground")} />
                  <div className="font-medium">{label}</div>
                </button>
              );
            })}
          </div>
          {/* Small credit option */}
          <div className="mt-3">
            {options.filter(opt => opt.isSmall).map(({ value, label, Icon }) => {
              const selected = value === method;
              return (
                <button
                  key={value}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "w-full border rounded-xl p-4 flex items-center justify-center gap-2",
                    selected ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border"
                  )}
                >
                  <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                  <div className={cn("font-medium text-sm", selected ? "text-primary" : "")}>{label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 mt-10 text-muted-foreground text-sm">
          {paid ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>{language === "es" ? "Pago confirmado" : "Full payment added"}</span>
            </div>
          ) : (
            <div>{language === "es" ? "Pago completo agregado" : "Full payment added"}</div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4">
          <Button className="w-full h-12 rounded-full" onClick={handlePay} disabled={paying}>
            {language === "es" ? "Pagar ahora" : "Pay now"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}


