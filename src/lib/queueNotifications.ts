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
  | { ok: true; skipped: true; reason: "no_next" | "no_phone" | "missing_context" | "no_user_id" }
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
      clients!appointments_client_id_fkey(id, user_id, full_name, phone, email)
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
  const clientUserId = nextAppointment.clients?.user_id ?? null;

  // Message for notification in app
  const notificationMessage =
    language === "es"
      ? `El staff inició una cita y eres el siguiente en turno. Por favor ve acercándote al establecimiento.`
      : `Staff started an appointment and you're next in line. Please start heading to the establishment.`;

  // Message for SMS (softer, more detailed)
  const dateText = (() => {
    try {
      return new Date(appointmentDate).toLocaleDateString(language === "es" ? "es-ES" : "en-US");
    } catch {
      return appointmentDate;
    }
  })();

  const smsMessage =
    language === "es"
      ? `Hola ${clientName}, eres el siguiente. Por favor ve preparándote. Tu cita es el ${dateText} a las ${nextAppointment.start_time}.`
      : `Hi ${clientName}, you're next. Please get ready. Your appointment is on ${dateText} at ${nextAppointment.start_time}.`;

  // Create notification in client_notifications if user_id exists
  if (clientUserId) {
    const { error: notificationError } = await supabase
      .from("client_notifications")
      .insert({
        user_id: clientUserId,
        appointment_id: nextAppointment.id,
        business_id: params.businessId,
        type: "next_in_queue",
        title: language === "es" ? "Eres el siguiente" : "You're next",
        message: notificationMessage,
        read: false,
      });

    if (notificationError) {
      console.error("Error creating client notification:", notificationError);
      // Continue even if notification creation fails
    }
  }

  // Send SMS if phone exists
  if (phone) {
    const { error: invokeError } = await supabase.functions.invoke("send-sms-reminder", {
      body: {
        to: phone,
        message: smsMessage,
        appointmentId: nextAppointment.id,
        businessId: params.businessId,
      },
    });

    if (invokeError) {
      console.error("Error sending SMS:", invokeError);
      // Continue even if SMS fails
    }
  }

  return { ok: true, nextAppointmentId: nextAppointment.id };
}


