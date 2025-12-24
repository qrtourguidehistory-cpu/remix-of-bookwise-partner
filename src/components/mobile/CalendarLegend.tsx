import { Badge } from "@/components/ui/badge";
import { Coffee, Moon, Clock, CheckCircle2, XCircle, AlertCircle, Clock3 } from "lucide-react";

export function CalendarLegend() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-sm">Leyenda</h3>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Status badges */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>Confirmada</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-3 w-3 text-yellow-500" />
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3 text-blue-500" />
          <span>Completada</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-3 w-3 text-red-500" />
          <span>Cancelada</span>
        </div>
        
        {/* Time indicators */}
        <div className="flex items-center gap-2 col-span-2 pt-2 border-t">
          <div className="w-4 h-4 bg-muted/50 rounded" />
          <span>Fuera de horario</span>
        </div>
        <div className="flex items-center gap-2">
          <Coffee className="h-3 w-3 text-orange-600" />
          <span>Break/Comida</span>
        </div>
        <div className="flex items-center gap-2">
          <Moon className="h-3 w-3 text-destructive" />
          <span>Día libre</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500/10 rounded border-l-2 border-green-500" />
          <span>Disponible</span>
        </div>
      </div>
    </div>
  );
}