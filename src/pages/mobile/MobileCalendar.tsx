import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { CalendarHeader, FilterState } from "@/components/mobile/CalendarHeader";
import { DayView } from "@/components/mobile/DayView";
import { WeekView } from "@/components/mobile/WeekView";
import { MonthView } from "@/components/mobile/MonthView";
import { StaffCalendarView } from "@/components/mobile/StaffCalendarView";
import { CalendarLegend } from "@/components/mobile/CalendarLegend";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { isSameDay, parseISO } from "date-fns";

export default function MobileCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month" | "staff">("day");
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    statuses: [],
    staffIds: [],
    serviceIds: []
  });
  const [appointmentToOpen, setAppointmentToOpen] = useState<string | null>(null);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);

  // Listen for appointment detail open events from notifications
  useEffect(() => {
    const handleOpenAppointment = (event: CustomEvent) => {
      const { appointmentId, appointmentDate } = event.detail;
      if (appointmentId) {
        // If we have a date, navigate to that date
        if (appointmentDate) {
          try {
            const date = parseISO(appointmentDate);
            setCurrentDate(date);
            setView("day");
          } catch (e) {
            // If date parsing fails, use current date
          }
        } else {
          setView("day");
        }
        // Set the appointment to open
        setAppointmentToOpen(appointmentId);
      }
    };

    window.addEventListener('openAppointmentDetail', handleOpenAppointment as EventListener);
    return () => {
      window.removeEventListener('openAppointmentDetail', handleOpenAppointment as EventListener);
    };
  }, []);

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleReturnToToday = () => {
    setCurrentDate(new Date());
    setView("day");
  };

  return (
    <MobileLayout>
      <CalendarHeader
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      {view === "day" && (
        <DayView 
          date={currentDate} 
          filters={filters} 
          appointmentToOpen={appointmentToOpen}
          onAppointmentOpened={() => setAppointmentToOpen(null)}
        />
      )}
      {view === "week" && <WeekView date={currentDate} filters={filters} />}
      {view === "month" && <MonthView date={currentDate} onDateSelect={handleDateSelect} />}
      {view === "staff" && <StaffCalendarView date={currentDate} filters={filters} />}
      
      {/* Legend */}
      <div className="px-4 pb-4">
        <CalendarLegend />
      </div>
      
      {/* Floating button to return to today - only show when not on today */}
      {!isToday && (
        <Button
          onClick={handleReturnToToday}
          size="icon"
          className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg z-50"
          title="Regresar a hoy"
        >
          <Calendar className="h-5 w-5" />
        </Button>
      )}
    </MobileLayout>
  );
}
