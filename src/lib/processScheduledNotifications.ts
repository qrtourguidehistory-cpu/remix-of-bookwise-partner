import { supabase } from './supabaseClient';
import { sendNotificationToClient } from './notificationService';

/**
 * Formatea una fecha desde string (YYYY-MM-DD) a formato corto (DD/MM/YYYY)
 * Evita problemas de zona horaria al no convertir a Date
 */
function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Process scheduled notifications that are due to be sent
 * This should be called periodically (e.g., every minute via cron job or Edge Function)
 */
export async function processScheduledNotifications(): Promise<void> {
  try {
    const now = new Date();
    
    // Find all scheduled notifications that are due
    const { data: scheduledNotifications, error } = await (supabase
      .from('appointment_notifications' as any)
      .select('*')
      .eq('status', 'scheduled')
      .lte('send_at', now.toISOString()) as any);

    if (error) {
      console.error('Error fetching scheduled notifications:', error);
      return;
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      return;
    }

    // Process each scheduled notification
    for (const notification of scheduledNotifications) {
      try {
        const notif = notification as any;
        // Get appointment details
        const { data: appointment } = await (supabase
          .from('appointments')
          .select(`
            id,
            client_id,
            appointment_date,
            start_time,
            business_id,
            status,
            clients(full_name, email, phone)
          `)
          .eq('id', notif.appointment_id)
          .single() as any);

        if (!appointment) {
          // Mark notification as cancelled if appointment doesn't exist
          await (supabase
            .from('appointment_notifications' as any)
            .update({ status: 'cancelled' } as any)
            .eq('id', notif.id) as any);
          continue;
        }

        const apt = appointment as any;
        // Skip if appointment is cancelled or completed (for reminders)
        if (notif.meta?.type === 'reminder' && 
            (apt.status === 'cancelled' || apt.status === 'completed')) {
          await (supabase
            .from('appointment_notifications' as any)
            .update({ status: 'cancelled' } as any)
            .eq('id', notif.id) as any);
          continue;
        }

        // Send the notification
        const appointmentDate = apt.appointment_date;
        // ✅ CORREGIDO: Formatear fecha directamente desde string para evitar problemas de zona horaria
        const success = await sendNotificationToClient({
          appointmentId: apt.id,
          clientId: apt.client_id,
          clientEmail: apt.clients?.email,
          clientPhone: apt.clients?.phone,
          clientName: apt.clients?.full_name,
          type: notif.meta?.type || 'reminder',
          appointmentDate: appointmentDate ? formatDateShort(appointmentDate) : undefined,
          appointmentTime: apt.start_time,
          businessId: apt.business_id,
        });

        // Update notification status
        await (supabase
          .from('appointment_notifications' as any)
          .update({ 
            status: success ? 'sent' : 'failed',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', notif.id) as any);

      } catch (err) {
        console.error(`Error processing notification ${(notification as any).id}:`, err);
        // Mark as failed
        await (supabase
          .from('appointment_notifications' as any)
          .update({ status: 'failed' } as any)
          .eq('id', (notification as any).id) as any);
      }
    }
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
  }
}

