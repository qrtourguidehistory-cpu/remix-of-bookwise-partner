import type React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export type CheckoutLine = {
  id: string;
  name: string;
  subtitle?: string;
  amount: number;
};

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientEmail?: string;
  lines: CheckoutLine[];
  subtotal: number;
  tax: number;
  total: number;
  onContinue: () => void;
}

export function CheckoutSheet({
  open,
  onOpenChange,
  clientName,
  clientEmail,
  lines,
  subtotal,
  tax,
  total,
  onContinue,
}: CheckoutSheetProps) {
  const { language } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border h-[85vh]" hideDefaultClose>
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Checkout" : "Checkout"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Resumen de cobro y total a pagar."
              : "Checkout summary and total to pay."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex items-center justify-between">
          <div className="text-2xl font-bold">{language === "es" ? "Cobrar" : "Add to cart"}</div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 space-y-4 pb-24">
          <div className="border rounded-xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">{clientName}</div>
              {clientEmail && <div className="text-sm text-muted-foreground truncate">{clientEmail}</div>}
              <div className="mt-2">
                <Button variant="outline" size="sm" className="rounded-full">
                  {language === "es" ? "Acciones" : "Actions"}
                </Button>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
              {(clientName || "?").charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((l) => (
              <div key={l.id} className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  {l.subtitle && <div className="text-sm text-muted-foreground truncate">{l.subtitle}</div>}
                </div>
                <div className="font-medium shrink-0">DOP {l.amount.toFixed(0)}</div>
              </div>
            ))}
            <Button variant="outline" className="w-full rounded-full h-12 justify-start gap-2">
              <ShoppingCart className="h-5 w-5" />
              {language === "es" ? "Agregar al carrito" : "Add to cart"}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{language === "es" ? "Subtotal" : "Subtotal"}</span>
              <span>DOP {subtotal.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{language === "es" ? "Impuestos" : "Tax"}</span>
              <span>DOP {tax.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>{language === "es" ? "Total" : "Total"}</span>
              <span>DOP {total.toFixed(0)}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{language === "es" ? "A pagar" : "To pay"}</div>
            <div className="font-semibold">DOP {total.toFixed(0)}</div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4 pb-safe-nav">
          <Button className="w-full h-12 rounded-full" onClick={onContinue}>
            {language === "es" ? "Continuar a pago" : "Continue to payment"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}


