import { Badge } from "@/components/ui/badge";
import { Coffee, Moon, Clock, CheckCircle2, XCircle, AlertCircle, Clock3 } from "lucide-react";

export function CalendarLegend() {
  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-[12px]">
      <h3 className="font-semibold text-xs">Leyenda</h3>
      
      <div className="grid grid-cols-2 gap-1 text-xs">
        {/* Status badges */}
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>Confirmada</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock3 className="h-3 w-3 text-yellow-500" />
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-blue-500" />
          <span>Completada</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-500" />
          <span>Cancelada</span>
        </div>
        
        {/* Time indicators */}
        <div className="flex items-center gap-1 col-span-2 pt-2 border-t">
          <div className="w-3 h-3 bg-muted/50 rounded" />
          <span>Fuera de horario</span>
        </div>
        <div className="flex items-center gap-1">
          <Coffee className="h-3 w-3 text-orange-600" />
          <span>Break/Comida</span>
        </div>
        <div className="flex items-center gap-1">
          <Moon className="h-3 w-3 text-destructive" />
          <span>Día libre</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500/10 rounded border-l-2 border-green-500" />
          <span>Disponible</span>
        </div>
      </div>
    </div>
  );
}