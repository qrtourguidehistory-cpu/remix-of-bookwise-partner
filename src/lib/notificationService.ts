import { supabase } from "@/integrations/supabase/client";

export interface NotificationData {
  appointmentId: string;
  clientId?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientName?: string | null;
  type: 'confirmation' | 'completion' | 'cancellation' | 'reminder' | 'next_in_queue' | 'review_request' | 'moved';
  appointmentDate?: string;
  appointmentTime?: string;
  businessId: string;
  message?: string;
}

/**
 * Send notification to client via email/SMS/push
 * This is a placeholder - integrate with your actual notification service
 */
export async function sendNotificationToClient(data: NotificationData): Promise<boolean> {
  try {
    // Get notification settings for the business, create default if not exists
    let { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('business_id', data.businessId)
      .single();

    if (!settings) {
      // Create default notification settings
      const { data: newSettings, error: createError } = await supabase
        .from('notification_settings')
        .insert({
          business_id: data.businessId,
          email_notifications: true,
          sms_notifications: true,
          push_notifications: true,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating notification settings:', createError);
        // Continue with default settings even if insert fails
        settings = {
          email_notifications: true,
          sms_notifications: true,
          push_notifications: true,
        } as any;
      } else {
        settings = newSettings;
      }
    }

    // Get client info if clientId is provided
    let clientEmail = data.clientEmail;
    let clientPhone = data.clientPhone;
    let clientName = data.clientName;

    if (data.clientId && !clientEmail && !clientPhone) {
      const { data: client } = await supabase
        .from('clients')
        .select('email, phone, full_name')
        .eq('id', data.clientId)
        .single();

      if (client) {
        clientEmail = client.email || undefined;
        clientPhone = client.phone || undefined;
        clientName = client.full_name || undefined;
      }
    }

    // Generate message based on type
    const message = data.message || generateNotificationMessage(data.type, {
      clientName: clientName || 'Cliente',
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
    });

    // Always log notification to appointment_notifications table (even if settings don't exist)
    const { error: insertError } = await (supabase
      .from('appointment_notifications' as any)
      .insert({
        appointment_id: data.appointmentId,
        send_at: new Date().toISOString(),
        status: 'sent',
        meta: {
          type: data.type,
          client_email: clientEmail,
          client_phone: clientPhone,
          client_name: clientName,
          message,
          channels: {
            email: (settings as any)?.email_notifications && clientEmail ? true : false,
            sms: (settings as any)?.sms_notifications && clientPhone ? true : false,
            push: (settings as any)?.push_notifications ? true : false,
          },
        },
      } as any) as any);

    if (insertError) {
      console.error('Error inserting notification:', insertError);
      return false;
    }

    // TODO: Integrate with actual email/SMS/push notification services
    // For now, we just log to the database
    console.log('Notification sent:', {
      type: data.type,
      appointmentId: data.appointmentId,
      clientEmail,
      clientPhone,
      message,
    });

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Schedule a notification to be sent at a specific time
 */
export async function scheduleNotification(
  appointmentId: string,
  sendAt: Date,
  type: NotificationData['type'],
  businessId: string,
  meta?: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await (supabase
      .from('appointment_notifications' as any)
      .insert({
        appointment_id: appointmentId,
        send_at: sendAt.toISOString(),
        status: 'scheduled',
        meta: {
          type,
          ...meta,
        },
      } as any) as any);

    if (error) {
      console.error('Error scheduling notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return false;
  }
}

/**
 * Generate notification message based on type
 */
function generateNotificationMessage(
  type: NotificationData['type'],
  context: {
    clientName: string;
    appointmentDate?: string;
    appointmentTime?: string;
  }
): string {
  const { clientName, appointmentDate, appointmentTime } = context;

  switch (type) {
    case 'confirmation':
      return `Hola ${clientName}, tu cita ha sido confirmada para el ${appointmentDate} a las ${appointmentTime}. ¡Te esperamos!`;

    case 'completion':
      return `Hola ${clientName}, tu cita ha sido completada. ¡Gracias por visitarnos!`;

    case 'cancellation':
      return `Hola ${clientName}, lamentamos informarte que tu cita del ${appointmentDate} a las ${appointmentTime} ha sido cancelada. Por favor, contáctanos para reagendar.`;

    case 'reminder':
      return `Hola ${clientName}, recordatorio: tienes una cita el ${appointmentDate} a las ${appointmentTime}. ¡Te esperamos!`;

    case 'next_in_queue':
      return `Hola ${clientName}, puedes venir ahora. Tu turno está listo. Tu cita es el ${appointmentDate} a las ${appointmentTime}.`;

    case 'review_request':
      return `Hola ${clientName}, nos encantaría conocer tu opinión sobre tu última visita. ¿Podrías dejarnos una reseña?`;

    case 'moved':
      return `Hola ${clientName}, tu cita ha sido movida al ${appointmentDate} a las ${appointmentTime}. ¡Te esperamos en la nueva fecha y hora!`;

    default:
      return `Hola ${clientName}, tienes una actualización sobre tu cita.`;
  }
}

/**
 * Get the next appointment in queue (same date, after current appointment)
 */
export async function getNextAppointmentInQueue(
  completedAppointmentId: string,
  businessId: string
): Promise<any | null> {
  try {
    // Get the completed appointment details
    const { data: completedAppointment } = await (supabase
      .from('appointments')
      .select('appointment_date, start_time, end_time')
      .eq('id', completedAppointmentId)
      .single() as any);

    if (!completedAppointment) return null;

    const appointmentDate = (completedAppointment as any).appointment_date;
    const endTime = (completedAppointment as any).end_time;

    if (!appointmentDate || !endTime) return null;

    // Find next appointment on the same date, starting after the completed one
    const { data: nextAppointment } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        client_name,
        client_email,
        client_phone,
        start_time,
        appointment_date,
        date,
        services!appointments_service_id_fkey(name)
      `)
      .eq('business_id', businessId)
      .eq('appointment_date', appointmentDate)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', endTime)
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    return nextAppointment || null;
  } catch (error) {
    console.error('Error getting next appointment in queue:', error);
    return null;
  }
}

