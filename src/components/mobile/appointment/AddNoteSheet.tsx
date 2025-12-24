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
      fetchNotes();
      if (existingNote) {
        setNoteText(existingNote.note_text);
      } else {
        setNoteText("");
      }
    }
  }, [open, appointmentId, existingNote]);

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from("appointment_notes")
        .select(`
          *,
          profiles!appointment_notes_created_by_fkey(full_name)
        `)
        .eq("appointment_id", appointmentId)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      toast.error(language === "es" ? "Error al cargar notas" : "Error loading notes");
    } finally {
      setLoadingNotes(false);
    }
  };

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
      if (existingNote) {
        // Update existing note
        const { error } = await supabase
          .from("appointment_notes")
          .update({
            note_text: noteText.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingNote.id)
          .eq("business_id", businessId);

        if (error) throw error;
        toast.success(language === "es" ? "Nota actualizada" : "Note updated");
      } else {
        // Create new note
        const { error } = await supabase
          .from("appointment_notes")
          .insert({
            appointment_id: appointmentId,
            business_id: businessId,
            created_by: profile.id,
            note_text: noteText.trim(),
          });

        if (error) throw error;
        toast.success(language === "es" ? "Nota agregada" : "Note added");
      }

      setNoteText("");
      onNoteAdded?.();
      fetchNotes();
      if (!existingNote) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error(language === "es" ? "Error al guardar nota" : "Error saving note");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm(language === "es" ? "¿Eliminar esta nota?" : "Delete this note?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("appointment_notes")
        .delete()
        .eq("id", noteId)
        .eq("business_id", businessId);

      if (error) throw error;
      toast.success(language === "es" ? "Nota eliminada" : "Note deleted");
      fetchNotes();
      if (existingNote?.id === noteId) {
        setNoteText("");
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error(language === "es" ? "Error al eliminar nota" : "Error deleting note");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border h-[90vh] overflow-y-auto">
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

          {/* Existing Notes List */}
          {notes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">
                {language === "es" ? "Notas anteriores" : "Previous notes"}
              </h3>
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>
                            {note.profiles?.full_name || language === "es" ? "Usuario" : "User"}
                          </span>
                          <span>•</span>
                          <span>
                            {format(
                              new Date(note.created_at),
                              language === "es" ? "d MMM yyyy, h:mm a" : "MMM d, yyyy, h:mm a",
                              { locale: language === "es" ? es : undefined }
                            )}
                          </span>
                          {note.updated_at !== note.created_at && (
                            <>
                              <span>•</span>
                              <span className="italic">
                                {language === "es" ? "editada" : "edited"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(note.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {note.id === existingNote?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => {
                          setNoteText(note.note_text);
                        }}
                      >
                        {language === "es" ? "Editar" : "Edit"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

