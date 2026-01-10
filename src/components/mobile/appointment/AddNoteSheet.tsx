import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { X, Save } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AppointmentNote {
  id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  profiles: {
    full_name: string | null;
  } | null;
}

interface AddNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  businessId: string;
  onNoteAdded?: () => void;
  existingNote?: AppointmentNote | null;
}

export function AddNoteSheet({
  open,
  onOpenChange,
  appointmentId,
  businessId,
  onNoteAdded,
  existingNote,
}: AddNoteSheetProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    if (open && appointmentId) {
      // Note: appointment_notes table doesn't exist yet
      // For now, we use the appointments.notes field
      if (existingNote) {
        setNoteText(existingNote.note_text);
      } else {
        setNoteText("");
      }
    }
  }, [open, appointmentId, existingNote]);

  const handleSave = async () => {
    if (!noteText.trim()) {
      toast.error(language === "es" ? "La nota no puede estar vacía" : "Note cannot be empty");
      return;
    }

    if (!profile?.id || !businessId) {
      toast.error(language === "es" ? "Error: perfil no encontrado" : "Error: profile not found");
      return;
    }

    setLoading(true);
    try {
      // Update the appointment's notes field directly
      const { error } = await supabase
        .from("appointments")
        .update({
          notes: noteText.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .eq("business_id", businessId);

      if (error) throw error;
      
      toast.success(language === "es" ? "Nota guardada" : "Note saved");
      setNoteText("");
      onNoteAdded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error(language === "es" ? "Error al guardar nota" : "Error saving note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border h-[90vh] overflow-y-auto" hideDefaultClose>
        <SheetHeader>
          <div className="flex items-center justify-between mb-4">
            <SheetTitle>
              {existingNote
                ? language === "es"
                  ? "Editar nota"
                  : "Edit note"
                : language === "es"
                  ? "Agregar nota"
                  : "Add note"}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="note-text">
              {language === "es" ? "Nota" : "Note"}
            </Label>
            <Textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={
                language === "es"
                  ? "Escribe una nota para recordar sobre esta cita..."
                  : "Write a note to remember about this appointment..."
              }
              className="min-h-[120px] mt-2"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {noteText.length}/1000
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading || !noteText.trim()}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading
              ? language === "es"
                ? "Guardando..."
                : "Saving..."
              : existingNote
                ? language === "es"
                  ? "Actualizar nota"
                  : "Update note"
                : language === "es"
                  ? "Guardar nota"
                  : "Save note"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
