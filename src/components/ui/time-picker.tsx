import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // Format: "HH:MM:SS" or "HH:MM" (24h) or "12:30PM" (12h)
  onChange: (value: string) => void; // Returns in 24h format "HH:MM:SS"
  className?: string;
  placeholder?: string;
}

export function TimePicker({ value, onChange, className, placeholder = "Seleccionar hora" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  // Temporary values while selecting (not saved until "Listo" is clicked)
  const [tempHour, setTempHour] = useState(12);
  const [tempMinute, setTempMinute] = useState(0);
  const [tempPeriod, setTempPeriod] = useState<"AM" | "PM">("AM");
  // Saved values (from props)
  const [savedHour, setSavedHour] = useState(12);
  const [savedMinute, setSavedMinute] = useState(0);
  const [savedPeriod, setSavedPeriod] = useState<"AM" | "PM">("AM");
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);

  // Parse initial value and update both temp and saved values
  useEffect(() => {
    if (value) {
      // Try to parse 24h format (HH:MM:SS or HH:MM)
      const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        let p: "AM" | "PM" = "AM";
        
        if (h === 0) {
          h = 12;
          p = "AM";
        } else if (h === 12) {
          p = "PM";
        } else if (h > 12) {
          h = h - 12;
          p = "PM";
        } else {
          p = "AM";
        }
        
        setTempHour(h);
        setTempMinute(m);
        setTempPeriod(p);
        setSavedHour(h);
        setSavedMinute(m);
        setSavedPeriod(p);
      }
    } else {
      // Set defaults if no value
      setTempHour(12);
      setTempMinute(0);
      setTempPeriod("AM");
      setSavedHour(12);
      setSavedMinute(0);
      setSavedPeriod("AM");
    }
  }, [value]);

  // Reset temp values to saved values when dialog opens
  useEffect(() => {
    if (open) {
      setTempHour(savedHour);
      setTempMinute(savedMinute);
      setTempPeriod(savedPeriod);
    }
  }, [open, savedHour, savedMinute, savedPeriod]);

  // Scroll to selected value when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        // Scroll hours
        const hourElement = hoursRef.current?.querySelector(`[data-hour="${tempHour}"]`);
        if (hourElement) {
          hourElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Scroll minutes
        const minuteElement = minutesRef.current?.querySelector(`[data-minute="${tempMinute}"]`);
        if (minuteElement) {
          minuteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Scroll period
        const periodElement = periodRef.current?.querySelector(`[data-period="${tempPeriod}"]`);
        if (periodElement) {
          periodElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [open, tempHour, tempMinute, tempPeriod]);

  const handleTempChange = (newHour: number, newMinute: number, newPeriod: "AM" | "PM") => {
    setTempHour(newHour);
    setTempMinute(newMinute);
    setTempPeriod(newPeriod);
  };

  const handleConfirm = () => {
    // Save temp values to saved values
    setSavedHour(tempHour);
    setSavedMinute(tempMinute);
    setSavedPeriod(tempPeriod);
    
    // Convert to 24h format and call onChange
    // FIX: Correct conversion from 12-hour to 24-hour format
    let hour24: number;
    if (tempPeriod === "AM") {
      // AM: 12:xx AM = 00:xx, 1-11 AM = 01-11
      hour24 = tempHour === 12 ? 0 : tempHour;
    } else {
      // PM: 12:xx PM = 12:xx, 1-11 PM = 13-23
      hour24 = tempHour === 12 ? 12 : tempHour + 12;
    }
    
    const time24h = `${String(hour24).padStart(2, "0")}:${String(tempMinute).padStart(2, "0")}:00`;
    onChange(time24h);
    setOpen(false);
  };

  const displayValue = value 
    ? (() => {
        const timeMatch = value.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const isPM = h >= 12;
          const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return `${displayH}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
        }
        return value;
      })()
    : placeholder;

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        // Reset temp values to saved when closing without confirming
        setTempHour(savedHour);
        setTempMinute(savedMinute);
        setTempPeriod(savedPeriod);
      }
      setOpen(newOpen);
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 relative overflow-hidden" align="start">
        {/* Header with selected time display - editable */}
        <div className="flex items-center justify-center border-b bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            {/* Hour buttons */}
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-8 p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const newHour = tempHour >= 12 ? 1 : tempHour + 1;
                  handleTempChange(newHour, tempMinute, tempPeriod);
                  setTimeout(() => {
                    const el = hoursRef.current?.querySelector(`[data-hour="${newHour}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 50);
                }}
              >
                ▲
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-3xl font-bold min-w-[70px] h-14 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 cursor-pointer"
                onClick={() => {
                  const el = hoursRef.current?.querySelector(`[data-hour="${tempHour}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                {String(tempHour).padStart(2, "0")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-8 p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const newHour = tempHour <= 1 ? 12 : tempHour - 1;
                  handleTempChange(newHour, tempMinute, tempPeriod);
                  setTimeout(() => {
                    const el = hoursRef.current?.querySelector(`[data-hour="${newHour}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 50);
                }}
              >
                ▼
              </Button>
            </div>
            
            <span className="text-3xl font-bold text-primary">:</span>
            
            {/* Minute buttons */}
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-8 p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const newMinute = tempMinute >= 59 ? 0 : tempMinute + 1;
                  handleTempChange(tempHour, newMinute, tempPeriod);
                  setTimeout(() => {
                    const el = minutesRef.current?.querySelector(`[data-minute="${newMinute}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 50);
                }}
              >
                ▲
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-3xl font-bold min-w-[70px] h-14 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 cursor-pointer"
                onClick={() => {
                  const el = minutesRef.current?.querySelector(`[data-minute="${tempMinute}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                {String(tempMinute).padStart(2, "0")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-8 p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const newMinute = tempMinute <= 0 ? 59 : tempMinute - 1;
                  handleTempChange(tempHour, newMinute, tempPeriod);
                  setTimeout(() => {
                    const el = minutesRef.current?.querySelector(`[data-minute="${newMinute}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 50);
                }}
              >
                ▼
              </Button>
            </div>
            
            {/* AM/PM button */}
            <Button
              variant="ghost"
              size="lg"
              className="text-2xl font-bold min-w-[70px] h-14 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
              onClick={() => {
                handleTempChange(tempHour, tempMinute, tempPeriod === "AM" ? "PM" : "AM");
                setTimeout(() => {
                  const el = periodRef.current?.querySelector(`[data-period="${tempPeriod === "AM" ? "PM" : "AM"}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
              }}
            >
              {tempPeriod}
            </Button>
          </div>
        </div>
        
        <div className="flex bg-muted/30 relative">
          {/* Hours column */}
          <ScrollArea className="h-[320px] w-24 border-r">
            <div ref={hoursRef} className="py-[120px]">
              {hours.map((h) => (
                <button
                  key={h}
                  data-hour={h}
                  type="button"
                  onClick={() => {
                    handleTempChange(h, tempMinute, tempPeriod);
                    setTimeout(() => {
                      const el = hoursRef.current?.querySelector(`[data-hour="${h}"]`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  className={cn(
                    "w-full py-4 text-center text-xl font-semibold transition-all rounded-lg mx-1 my-1",
                    tempHour === h 
                      ? "bg-primary text-primary-foreground font-bold scale-110 shadow-lg" 
                      : "hover:bg-accent hover:scale-105"
                  )}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Minutes column */}
          <ScrollArea className="h-[320px] w-24 border-r">
            <div ref={minutesRef} className="py-[120px]">
              {minutes.map((m) => (
                <button
                  key={m}
                  data-minute={m}
                  type="button"
                  onClick={() => {
                    handleTempChange(tempHour, m, tempPeriod);
                    setTimeout(() => {
                      const el = minutesRef.current?.querySelector(`[data-minute="${m}"]`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  className={cn(
                    "w-full py-4 text-center text-xl font-semibold transition-all rounded-lg mx-1 my-1",
                    tempMinute === m 
                      ? "bg-primary text-primary-foreground font-bold scale-110 shadow-lg" 
                      : "hover:bg-accent hover:scale-105"
                  )}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* AM/PM column */}
          <ScrollArea className="h-[320px] w-20">
            <div ref={periodRef} className="py-[120px]">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  data-period={p}
                  type="button"
                  onClick={() => {
                    handleTempChange(tempHour, tempMinute, p);
                    setTimeout(() => {
                      const el = periodRef.current?.querySelector(`[data-period="${p}"]`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  className={cn(
                    "w-full py-6 text-center text-lg font-bold transition-all rounded-lg mx-1 my-4",
                    tempPeriod === p 
                      ? "bg-primary text-primary-foreground scale-110 shadow-lg" 
                      : "hover:bg-accent hover:scale-105"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        <div className="border-t p-3 flex justify-end gap-2 bg-muted/20">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              // Reset to saved values
              setTempHour(savedHour);
              setTempMinute(savedMinute);
              setTempPeriod(savedPeriod);
              setOpen(false);
            }}
          >
            Cancelar
          </Button>
          <Button 
            size="sm" 
            onClick={handleConfirm} 
            className="bg-primary hover:bg-primary/90"
          >
            Listo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

