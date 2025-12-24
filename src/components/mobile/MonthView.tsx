import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";

interface MonthViewProps {
  date: Date;
  onDateSelect?: (date: Date) => void;
}

interface DayActivity {
  appointments: number;
  sales: number;
  pending: number;
  cancelled: number;
}

export function MonthView({ date, onDateSelect }: MonthViewProps) {
  const { profile } = useAuth();
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ["L", "M", "X", "J", "V", "S", "D"];

  // Add empty slots for days before month starts
  const firstDayOfWeek = monthStart.getDay();
  const emptySlots = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  // Fetch appointments for the month
  const { data: appointments } = useQuery({
    queryKey: ['month-appointments', format(monthStart, 'yyyy-MM'), profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      
      const startOfMonthStr = format(monthStart, 'yyyy-MM-dd');
      const endOfMonthStr = format(monthEnd, 'yyyy-MM-dd');
      const endExclusiveStr = format(addDays(monthEnd, 1), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date, status')
        .eq('business_id', profile.business_id)
        // Range supports DATE or TIMESTAMP columns
        .gte('appointment_date', startOfMonthStr)
        .lt('appointment_date', endExclusiveStr);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.business_id,
  });

  // Fetch sales for the month
  const { data: sales } = useQuery({
    queryKey: ['month-sales', format(monthStart, 'yyyy-MM')],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select('sale_date')
        .eq('business_id', profile.business_id)
        .gte('sale_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('sale_date', format(monthEnd, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data;
    },
  });

  // Group activities by date
  const getActivitiesForDay = (day: Date): DayActivity => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    const dayAppointments = appointments?.filter(a => {
      if (!a.appointment_date) return false;
      const aptDate = new Date(a.appointment_date).toISOString().split('T')[0];
      return aptDate === dateStr;
    }) || [];
    const daySales = sales?.filter(s => s.sale_date === dateStr) || [];
    
    return {
      appointments: dayAppointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length,
      sales: daySales.length,
      pending: dayAppointments.filter(a => a.status === 'pending').length,
      cancelled: dayAppointments.filter(a => a.status === 'cancelled').length,
    };
  };

  return (
    <div className="p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <TooltipProvider>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: emptySlots }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}
          
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, date);
            const isTodayDate = isToday(day);
            const activities = getActivitiesForDay(day);
            const hasAnyActivity = activities.appointments > 0 || activities.sales > 0 || 
                                   activities.pending > 0 || activities.cancelled > 0;
            
            const tooltipContent = hasAnyActivity ? (
              <div className="text-xs space-y-1">
                <p className="font-semibold">{format(day, "PPP")}</p>
                {activities.appointments > 0 && (
                  <p className="text-blue-400">📅 {activities.appointments} cita{activities.appointments > 1 ? 's' : ''} confirmada{activities.appointments > 1 ? 's' : ''}</p>
                )}
                {activities.pending > 0 && (
                  <p className="text-yellow-400">⏳ {activities.pending} pendiente{activities.pending > 1 ? 's' : ''}</p>
                )}
                {activities.cancelled > 0 && (
                  <p className="text-red-400">❌ {activities.cancelled} cancelada{activities.cancelled > 1 ? 's' : ''}</p>
                )}
                {activities.sales > 0 && (
                  <p className="text-green-400">💰 {activities.sales} venta{activities.sales > 1 ? 's' : ''}</p>
                )}
              </div>
            ) : null;
            
            return (
              <Tooltip key={day.toISOString()} delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDateSelect?.(day)}
                    className={cn(
                      "aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative",
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                      isTodayDate && "bg-primary text-primary-foreground font-bold",
                      !isTodayDate && "hover:bg-muted"
                    )}
                  >
                    <span>{format(day, "d")}</span>
                    
                    {/* Activity indicators */}
                    {isCurrentMonth && hasAnyActivity && (
                      <div className="absolute bottom-1 flex gap-0.5">
                        {activities.appointments > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {activities.sales > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        )}
                        {activities.pending > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        )}
                        {activities.cancelled > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                {tooltipContent && (
                  <TooltipContent side="top">
                    {tooltipContent}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
