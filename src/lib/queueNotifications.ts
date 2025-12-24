import { supabase } from "@/integrations/supabase/client";

type Language = "es" | "en";

export async function notifyNextClientWhenAppointmentStarted(params: {
  businessId: string;
  currentAppointment: {
    id: string;
    appointment_date?: string | null;
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    staff_id?: string | null;
  };
  language?: Language;
}): Promise<
  | { ok: true; skipped?: false; nextAppointmentId: string }
  | { ok: true; skipped: true; reason: "no_next" | "no_phone" | "missing_context" }
  | { ok: false; reason: string }
> {
  const language = params.language ?? "es";
  const appointmentDate = params.currentAppointment.appointment_date ?? params.currentAppointment.date ?? null;
  const afterTime = params.currentAppointment.end_time ?? params.currentAppointment.start_time ?? null;

  if (!appointmentDate || !afterTime) {
    return { ok: true, skipped: true, reason: "missing_context" };
  }

  let query = supabase
    .from("appointments")
    .select(
      `
      id,
      start_time,
      client_id,
      clients!appointments_client_id_fkey(full_name, phone)
    `
    )
    .eq("business_id", params.businessId)
    .eq("appointment_date", appointmentDate)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", afterTime)
    .order("start_time", { ascending: true })
    .limit(1);

  if (params.currentAppointment.staff_id) {
    query = query.eq("staff_id", params.currentAppointment.staff_id);
  }

  const { data: nextAppointment, error } = await query.maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!nextAppointment) return { ok: true, skipped: true, reason: "no_next" };

  const clientName = nextAppointment.clients?.full_name ?? (language === "es" ? "Cliente" : "Client");
  const phone = nextAppointment.clients?.phone ?? null;

  if (!phone) return { ok: true, skipped: true, reason: "no_phone" };

  const dateText = (() => {
    try {
      return new Date(appointmentDate).toLocaleDateString(language === "es" ? "es-ES" : "en-US");
    } catch {
      return appointmentDate;
    }
  })();

  // This is intentionally softer than the "next_in_queue" reminder copy ("puedes venir ahora"),
  // because it's triggered when the previous appointment is marked as started (not completed).
  const message =
    language === "es"
      ? `Hola ${clientName}, eres el siguiente. Por favor ve preparándote. Tu cita es el ${dateText} a las ${nextAppointment.start_time}.`
      : `Hi ${clientName}, you're next. Please get ready. Your appointment is on ${dateText} at ${nextAppointment.start_time}.`;

  const { error: invokeError } = await supabase.functions.invoke("send-sms-reminder", {
    body: {
      to: phone,
      message,
      appointmentId: nextAppointment.id,
      businessId: params.businessId,
    },
  });

  if (invokeError) return { ok: false, reason: invokeError.message };

  return { ok: true, nextAppointmentId: nextAppointment.id };
}


