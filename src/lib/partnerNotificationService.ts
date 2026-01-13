/**
 * Servicio para crear notificaciones en la app Partner
 * Asegura que todas las notificaciones se persistan correctamente
 */

import { supabase } from "@/lib/supabaseClient";

export interface PartnerNotificationData {
  business_id: string;
  user_id?: string; // ID del usuario partner
  type: 
    | 'new_appointment' 
    | 'appointment_status_change' 
    | 'early_arrival_request' 
    | 'early_arrival_approved'
    | 'early_arrival_rejected'
    | 'review_received'
    | 'payment_received'
    | 'payment_reminder'
    | 'credit_payment'
    | 'monthly_payment_reminder';
  title: string;
  message: string;
  appointment_id?: string;
  client_id?: string;
  link?: string;
  meta?: Record<string, any>;
}

/**
 * Tipos operativos esenciales para Partner
 * El Partner solo necesita notificaciones que requieren acción operativa
 */
const OPERATIVE_PARTNER_TYPES = [
  'new_appointment',           // Nueva cita creada
  'appointment_status_change',  // Cambio crítico de estado
  'early_arrival_request',      // Solicitud especial (asistencia anticipada)
  'early_arrival_approved',     // Aprobación de solicitud especial
  'early_arrival_rejected',     // Rechazo de solicitud especial
  'review_received',            // Review recibida (puede requerir respuesta)
  'payment_received',           // Pago recibido (operativo)
  'payment_reminder',           // Recordatorio de pago mensual (operativo)
  'credit_payment',             // Pago de crédito (operativo)
  'monthly_payment_reminder',   // Recordatorio mensual (operativo)
] as const;

/**
 * Valida que el tipo de notificación sea operativo esencial para Partner
 */
function isOperativeType(type: string): boolean {
  return OPERATIVE_PARTNER_TYPES.includes(type as any);
}

/**
 * Crear notificación para Partner
 * ✅ CORRECCIÓN: Se inserta en 'notifications' (tabla de partners), NO en 'client_notifications'
 * Maneja errores explícitamente y mapea tipos a valores permitidos
 */
export async function createPartnerNotification(
  data: PartnerNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validar que el tipo sea operativo esencial para Partner
    if (!isOperativeType(data.type)) {
      console.warn(`⚠️ [PARTNER NOTIFICATION] Tipo no operativo ignorado: ${data.type}`);
      return { success: false, error: `Tipo de notificación no operativo: ${data.type}` };
    }

    // La tabla notifications no tiene constraint de tipos, usamos el tipo interno directamente
    const insertData = {
      user_id: data.user_id || null,
      type: data.type,
      title: data.title,
      message: data.message,
      read: false,
      link: data.link || null,
    };

    console.log(`📨 [PARTNER NOTIFICATION] Insertando en 'notifications':`, {
      type: data.type,
      user_id: data.user_id,
      business_id: data.business_id,
      appointment_id: data.appointment_id,
    });

    const { data: insertedData, error } = await supabase
      .from('notifications')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ [PARTNER NOTIFICATION] Error al insertar notificación:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        type: data.type,
        insertData,
      });
      return { success: false, error: error.message };
    }

    console.log(`✅ [PARTNER NOTIFICATION] Notificación creada exitosamente:`, {
      id: insertedData?.id,
      type: data.type,
    });

    return { success: true };
  } catch (error: any) {
    console.error('❌ [NOTIFICATION] Excepción al crear notificación:', {
      error: error.message,
      stack: error.stack,
      originalType: data.type,
      data,
    });
    return { success: false, error: error.message || 'Error desconocido al crear notificación' };
  }
}

/**
 * Notificación cuando se crea una nueva cita
 */
export async function notifyNewAppointment(
  businessId: string,
  userId: string, // Este es el profile.id, pero necesitamos obtener owner_id del negocio
  appointmentId: string,
  clientId: string,
  clientName: string,
  appointmentDate: string,
  appointmentTime: string,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  // Obtener owner_id del negocio
  let ownerId = userId;
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single();
    
    if (business?.owner_id) {
      ownerId = business.owner_id;
    }
  } catch (err) {
    console.error('Error getting business owner_id:', err);
    // Continuar con userId como fallback
  }

  await createPartnerNotification({
    business_id: businessId,
    user_id: ownerId,
    appointment_id: appointmentId,
    client_id: clientId,
    type: 'new_appointment',
    title: language === 'es' 
      ? 'Nueva cita recibida' 
      : 'New appointment received',
    message: language === 'es'
      ? `${clientName} ha reservado una cita para el ${appointmentDate} a las ${appointmentTime}`
      : `${clientName} has booked an appointment for ${appointmentDate} at ${appointmentTime}`,
    link: `/appointments/${appointmentId}`,
  });
}

/**
 * Notificación cuando cambia el status de una cita
 */
export async function notifyAppointmentStatusChange(
  businessId: string,
  userId: string, // Este es el profile.id, pero necesitamos obtener owner_id del negocio
  appointmentId: string,
  clientId: string,
  clientName: string,
  oldStatus: string,
  newStatus: string,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  // Obtener owner_id del negocio
  let ownerId = userId;
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single();
    
    if (business?.owner_id) {
      ownerId = business.owner_id;
    }
  } catch (err) {
    console.error('Error getting business owner_id:', err);
    // Continuar con userId como fallback
  }

  const statusLabels: Record<string, { es: string; en: string }> = {
    pending: { es: 'Pendiente', en: 'Pending' },
    confirmed: { es: 'Confirmada', en: 'Confirmed' },
    started: { es: 'Iniciada', en: 'Started' },
    completed: { es: 'Completada', en: 'Completed' },
    cancelled: { es: 'Cancelada', en: 'Cancelled' },
    no_show: { es: 'No asistió', en: 'No show' },
  };

  const oldLabel = statusLabels[oldStatus]?.[language] || oldStatus;
  const newLabel = statusLabels[newStatus]?.[language] || newStatus;

  await createPartnerNotification({
    business_id: businessId,
    user_id: ownerId,
    appointment_id: appointmentId,
    client_id: clientId,
    type: 'appointment_status_change',
    title: language === 'es' 
      ? 'Estado de cita actualizado' 
      : 'Appointment status updated',
    message: language === 'es'
      ? `La cita de ${clientName} cambió de "${oldLabel}" a "${newLabel}"`
      : `${clientName}'s appointment changed from "${oldLabel}" to "${newLabel}"`,
    link: `/appointments/${appointmentId}`,
    meta: { old_status: oldStatus, new_status: newStatus },
  });
}

/**
 * Notificación cuando se solicita asistencia anticipada
 */
export async function notifyEarlyArrivalRequest(
  businessId: string,
  userId: string,
  appointmentId: string,
  clientId: string,
  clientName: string,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
    appointment_id: appointmentId,
    client_id: clientId,
    type: 'early_arrival_request',
    title: language === 'es' 
      ? 'Solicitud de asistencia anticipada' 
      : 'Early arrival request',
    message: language === 'es'
      ? `${clientName} ha solicitado asistir antes de su hora programada`
      : `${clientName} has requested to arrive before their scheduled time`,
    link: `/appointments/${appointmentId}`,
  });
}

/**
 * Notificación cuando se aprueba/rechaza asistencia anticipada
 */
export async function notifyEarlyArrivalResponse(
  businessId: string,
  userId: string,
  appointmentId: string,
  clientId: string,
  clientName: string,
  approved: boolean,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
    appointment_id: appointmentId,
    client_id: clientId,
    type: approved ? 'early_arrival_approved' : 'early_arrival_rejected',
    title: language === 'es' 
      ? approved ? 'Asistencia anticipada aprobada' : 'Asistencia anticipada rechazada'
      : approved ? 'Early arrival approved' : 'Early arrival rejected',
    message: language === 'es'
      ? approved
        ? `${clientName} puede asistir antes de su hora programada`
        : `${clientName} no puede asistir antes de su hora programada`
      : approved
        ? `${clientName} can arrive before their scheduled time`
        : `${clientName} cannot arrive before their scheduled time`,
    link: `/appointments/${appointmentId}`,
    meta: { approved },
  });
}

/**
 * Notificación cuando se recibe una review
 */
export async function notifyReviewReceived(
  businessId: string,
  userId: string,
  appointmentId: string,
  clientId: string,
  clientName: string,
  rating: number,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
    appointment_id: appointmentId,
    client_id: clientId,
    type: 'review_received',
    title: language === 'es' 
      ? 'Nueva reseña recibida' 
      : 'New review received',
    message: language === 'es'
      ? `${clientName} dejó una reseña de ${rating} estrellas`
      : `${clientName} left a ${rating}-star review`,
    link: `/appointments/${appointmentId}`,
    meta: { rating },
  });
}

/**
 * Notificación cuando se recibe un pago
 */
export async function notifyPaymentReceived(
  businessId: string,
  userId: string,
  appointmentId: string,
  clientId: string,
  clientName: string,
  amount: number,
  currency: string = 'USD',
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
    appointment_id: appointmentId,
    client_id: clientId,
    type: 'payment_received',
    title: language === 'es' 
      ? 'Pago recibido' 
      : 'Payment received',
    message: language === 'es'
      ? `Se recibió un pago de ${currency} ${amount.toFixed(2)} de ${clientName}`
      : `Payment of ${currency} ${amount.toFixed(2)} received from ${clientName}`,
    link: `/appointments/${appointmentId}`,
    meta: { amount, currency },
  });
}

/**
 * Notificación de recordatorio de pago mensual
 */
export async function notifyMonthlyPaymentReminder(
  businessId: string,
  userId: string,
  amount: number,
  dueDate: string,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
    type: 'monthly_payment_reminder',
    title: language === 'es' 
      ? 'Recordatorio de pago mensual' 
      : 'Monthly payment reminder',
    message: language === 'es'
      ? `Su pago mensual de $${amount.toFixed(2)} vence el ${dueDate}. Se cobrará automáticamente.`
      : `Your monthly payment of $${amount.toFixed(2)} is due on ${dueDate}. It will be charged automatically.`,
    link: '/settings/billing',
    meta: { amount, due_date: dueDate },
  });
}

/**
 * Notificación de pago de crédito
 */
export async function notifyCreditPayment(
  businessId: string,
  userId: string,
  amount: number,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
    type: 'credit_payment',
    title: language === 'es' 
      ? 'Pago de crédito procesado' 
      : 'Credit payment processed',
    message: language === 'es'
      ? `Se procesó un pago de crédito de $${amount.toFixed(2)}`
      : `A credit payment of $${amount.toFixed(2)} was processed`,
    link: '/settings/billing',
    meta: { amount },
  });
}

