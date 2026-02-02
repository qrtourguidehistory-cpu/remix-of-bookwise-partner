import { supabase } from "@/integrations/supabase/client";

type Language = "es" | "en";

/**
 * Función genérica para notificar al siguiente cliente en la cola.
 * Busca la siguiente cita y envía una push notification con mensajes personalizados.
 */
async function notifyNextClientInQueue(params: {
  businessId: string;
  currentAppointment: {
    id: string;
    appointment_date?: string | null;
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    staff_id?: string | null;
  };
  title: string;
  body: string;
  language?: Language;
  useStartTime?: boolean; // Si es true, usa start_time como referencia; si es false, usa end_time
}): Promise<
  | { ok: true; skipped?: false; nextAppointmentId: string }
  | { ok: true; skipped: true; reason: "no_next" | "missing_context" | "no_user_id" }
  | { ok: false; reason: string }
> {
  const appointmentDate = params.currentAppointment.appointment_date ?? params.currentAppointment.date ?? null;
  // Si useStartTime es true, usar start_time; si es false o undefined, usar end_time como fallback a start_time
  const afterTime = params.useStartTime
    ? (params.currentAppointment.start_time ?? null)
    : (params.currentAppointment.end_time ?? params.currentAppointment.start_time ?? null);

  if (!appointmentDate || !afterTime) {
    return { ok: true, skipped: true, reason: "missing_context" };
  }

  // Validar que tenemos un appointment_id válido (no debe ser null o undefined)
  // Esto previene errores cuando se llama durante la creación de una cita
  if (!params.currentAppointment.id) {
    console.warn("⚠️ notifyNextClientInQueue: appointment_id no válido, saltando notificación");
    return { ok: true, skipped: true, reason: "missing_context" };
  }

  // Buscar la siguiente cita para el mismo profesional, en el mismo día
  let query = supabase
    .from("appointments")
    .select(
      `
      id,
      start_time,
      client_id,
      clients!appointments_client_id_fkey(id, user_id, full_name)
    `
    )
    .eq("business_id", params.businessId)
    .eq("appointment_date", appointmentDate)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", afterTime)
    .neq("id", params.currentAppointment.id) // Excluir la cita actual
    .order("start_time", { ascending: true })
    .limit(1);

  // Filtrar por el mismo profesional si está disponible
  if (params.currentAppointment.staff_id) {
    query = query.eq("staff_id", params.currentAppointment.staff_id);
  }

  const { data: nextAppointment, error } = await query.maybeSingle();

  if (error) {
    console.error("Error finding next appointment:", error);
    return { ok: false, reason: error.message };
  }

  if (!nextAppointment) {
    return { ok: true, skipped: true, reason: "no_next" };
  }

  const clientUserId = nextAppointment.clients?.user_id ?? null;

  if (!clientUserId) {
    return { ok: true, skipped: true, reason: "no_user_id" };
  }

  // Enviar push notification usando la Edge Function send-push-notification
  try {
    const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: clientUserId,
        title: params.title,
        body: params.body,
        role: "client",
      },
    });

    if (pushError) {
      console.error("Error sending push notification:", pushError);
      return { ok: false, reason: pushError.message };
    }

    console.log(`✅ Push notification sent to next client (user_id: ${clientUserId}, appointment_id: ${nextAppointment.id})`);
  } catch (err: any) {
    console.error("Unexpected error sending push notification:", err);
    return { ok: false, reason: err.message || "Unknown error" };
  }

  return { ok: true, nextAppointmentId: nextAppointment.id };
}

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

  // Enviar push notification usando la función genérica
  // Para "started", usamos start_time como referencia (useStartTime: true)
  // IMPORTANTE: Solo enviar si tenemos un appointment_id válido (no durante creación)
  if (clientUserId && params.currentAppointment.id) {
    try {
      await notifyNextClientInQueue({
        businessId: params.businessId,
        currentAppointment: {
          id: params.currentAppointment.id,
          appointment_date: appointmentDate,
          start_time: params.currentAppointment.start_time,
          end_time: params.currentAppointment.end_time,
          staff_id: params.currentAppointment.staff_id,
        },
        title: language === "es" ? "¡Eres el próximo en turno! 🕒" : "You're next in line! 🕒",
        body: language === "es"
          ? "El establecimiento ha iniciado el turno anterior. Por favor, acércate al establecimiento para estar listo a tu hora."
          : "The establishment has started the previous turn. Please head to the establishment to be ready at your time.",
        language,
        useStartTime: true, // Para "started", usar start_time como referencia
      });
    } catch (err) {
      console.error("Error sending push notification for started appointment:", err);
      // Continue even if push notification fails - no debe bloquear la actualización del estado
    }
  }

  return { ok: true, nextAppointmentId: nextAppointment.id };
}

/**
 * Notifica al siguiente cliente cuando una cita se completa.
 * Busca la siguiente cita para el mismo profesional, en el mismo día, con estado confirmed o pending.
 * Envía una push notification usando la función genérica notifyNextClientInQueue.
 */
export async function notifyNextClientWhenAppointmentCompleted(params: {
  businessId: string;
  currentAppointment: {
    id: string;
    appointment_date?: string | null;
    date?: string | null;
    end_time?: string | null;
    staff_id?: string | null;
  };
  language?: Language;
}): Promise<
  | { ok: true; skipped?: false; nextAppointmentId: string }
  | { ok: true; skipped: true; reason: "no_next" | "missing_context" | "no_user_id" }
  | { ok: false; reason: string }
> {
  const language = params.language ?? "es";

  return await notifyNextClientInQueue({
    businessId: params.businessId,
    currentAppointment: {
      id: params.currentAppointment.id,
      appointment_date: params.currentAppointment.appointment_date ?? params.currentAppointment.date ?? null,
      end_time: params.currentAppointment.end_time,
      staff_id: params.currentAppointment.staff_id,
    },
    title: "¡Es tu turno!",
    body: language === "es"
      ? "El profesional ya está disponible para atenderte. Te esperamos."
      : "The professional is now available to serve you. We're waiting for you.",
    language,
  });
}


