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
 * Crear notificación para Partner
 * Se inserta en client_notifications con business_id
 */
export async function createPartnerNotification(
  data: PartnerNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_notifications')
      .insert({
        business_id: data.business_id,
        user_id: data.user_id || null,
        appointment_id: data.appointment_id || null,
        client_id: data.client_id || null,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        link: data.link || null,
        meta: data.meta || null,
      });

    if (error) {
      console.error('Error creating partner notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating partner notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notificación cuando se crea una nueva cita
 */
export async function notifyNewAppointment(
  businessId: string,
  userId: string,
  appointmentId: string,
  clientId: string,
  clientName: string,
  appointmentDate: string,
  appointmentTime: string,
  language: 'es' | 'en' = 'es'
): Promise<void> {
  await createPartnerNotification({
    business_id: businessId,
    user_id: userId,
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
  userId: string,
  appointmentId: string,
  clientId: string,
  clientName: string,
  oldStatus: string,
  newStatus: string,
  language: 'es' | 'en' = 'es'
): Promise<void> {
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
    user_id: userId,
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

