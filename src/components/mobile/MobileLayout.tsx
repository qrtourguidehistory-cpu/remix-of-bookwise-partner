import { ReactNode, useState, useEffect, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileBottomNav } from "./MobileBottomNav";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";

// Context for handling appointment detail view from notifications
interface AppointmentDetailContextType {
  openAppointmentDetail: (appointmentId: string, appointmentDate?: string) => void;
}

const AppointmentDetailContext = createContext<AppointmentDetailContextType | null>(null);

export const useAppointmentDetail = () => {
  const context = useContext(AppointmentDetailContext);
  return context;
};

interface MobileLayoutProps {
  children: ReactNode;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'appointment' | 'cancellation' | 'reminder';
  appointmentId?: string;
  appointmentDate?: string;
  read?: boolean;
  notificationId?: string; // Original notification id for marking as read
  notificationTable?: 'client_notifications' | 'notifications'; // Which table the notification comes from
  link?: string; // Link to navigate when clicking notification
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    const isPartner = !!profile?.business_id;

    if (isPartner) {
      // For partners: fetch and subscribe to business notifications
      fetchNotifications();
      
      const channel = supabase
        .channel('client-notifications-partner')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'client_notifications',
            filter: `business_id=eq.${profile.business_id}`
          },
          () => {
            fetchNotifications();
            setHasUnread(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // For clients: fetch and subscribe to user notifications
      fetchClientNotifications();
      
      const channel = supabase
        .channel('client-notifications-client')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'client_notifications',
            filter: `user_id=eq.${profile.id}`
          },
          () => {
            fetchClientNotifications();
            setHasUnread(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.business_id, profile?.id, language]);

  const fetchNotifications = async () => {
    const isPartner = !!profile?.business_id;

    if (!isPartner || !profile?.id) return;

    try {
      // For partners: fetch ALL notifications (historial completo) from both tables
      // Fetch client_notifications for this business (appointment-related)
      const { data: clientNotifs, error: clientNotifError } = await (supabase
        .from('client_notifications' as any)
        .select(`
          id,
          type,
          title,
          message,
          read,
          created_at,
          appointment_id,
          appointments (
            id,
            status,
            appointment_date,
            start_time,
            clients (full_name)
          )
        `)
        .eq('business_id', profile.business_id)
        .order('created_at', { ascending: false })
        .limit(500) as any); // Increased limit for full history

      // Fetch notifications for this user (approval-related and other system notifications)
      const { data: userNotifs, error: userNotifError } = await (supabase
        .from('notifications' as any)
        .select(`
          id,
          type,
          title,
          message,
          read,
          created_at,
          link
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(500) as any); // Increased limit for full history

      if (clientNotifError) {
        console.error('Error fetching client notifications:', clientNotifError);
      }
      if (userNotifError) {
        console.error('Error fetching user notifications:', userNotifError);
      }

      // Process client_notifications
      const clientNotifsProcessed: Notification[] = (clientNotifs || []).map((notif: any) => {
        const apt = notif.appointments;
        
        let type: Notification['type'] = 'appointment';
        if (notif.type === 'cancellation' || notif.type === 'cancelled') {
          type = 'cancellation';
        } else if (notif.type === 'reminder' || notif.type === 'confirmation') {
          type = 'reminder';
        } else if (notif.type === 'new_appointment' || notif.type === 'early_arrival' || notif.type === 'early_arrival_request') {
          type = 'appointment';
        } else if (notif.type === 'review_response') {
          type = 'reminder'; // Review responses are shown as reminders
        } else if (notif.type === 'review_response') {
          type = 'reminder'; // Review responses are shown as reminders
        }

        const timeAgo = formatDistanceToNow(new Date(notif.created_at), {
          addSuffix: false,
          locale: language === 'es' ? es : enUS
        });

        return {
          id: notif.id,
          title: notif.title || (language === 'es' ? 'Notificación' : 'Notification'),
          message: notif.message || '',
          time: timeAgo,
          type,
          appointmentId: apt?.id || notif.appointment_id,
          appointmentDate: apt?.date || apt?.appointment_date,
          read: notif.read || false,
          notificationId: notif.id,
          notificationTable: 'client_notifications',
        };
      });

      // Process user notifications (approval, system notifications)
      const userNotifsProcessed: Notification[] = (userNotifs || []).map((notif: any) => {
        let type: Notification['type'] = 'appointment';
        if (notif.type === 'approval_approved') {
          type = 'reminder'; // Use reminder type for approval notifications
        } else if (notif.type === 'approval_rejected') {
          type = 'cancellation';
        }

        const timeAgo = formatDistanceToNow(new Date(notif.created_at), {
          addSuffix: false,
          locale: language === 'es' ? es : enUS
        });

        return {
          id: notif.id,
          title: notif.title || (language === 'es' ? 'Notificación' : 'Notification'),
          message: notif.message || '',
          time: timeAgo,
          type,
          read: notif.read || false,
          notificationId: notif.id,
          notificationTable: 'notifications',
          link: notif.link,
        };
      });

      // Combine and sort by created_at
      const allNotifs = [...clientNotifsProcessed, ...userNotifsProcessed].sort((a, b) => {
        // Sort by time (newest first) - approximate from time string
        return 0; // Will be sorted by created_at in the query
      });

      setNotifications(allNotifs);
      setHasUnread(allNotifs.some(n => !n.read));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchClientNotifications = async () => {
    if (!profile?.id) return;

    try {
      // For clients: fetch notifications from client_notifications table
      // Fetch ALL notifications (historial completo), not just recent ones
      const { data: clientNotifs, error: notifError } = await (supabase
        .from('client_notifications' as any)
        .select(`
          id,
          type,
          title,
          message,
          read,
          created_at,
          appointment_id,
          appointments (
            id,
            status,
            appointment_date,
            start_time
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(500) as any); // Increased limit for full history

      if (notifError) {
        console.error('Error fetching client notifications:', notifError);
        setNotifications([]);
        return;
      }

      // Process client_notifications for clients
      const notifs: Notification[] = (clientNotifs || []).map((notif: any) => {
        const apt = notif.appointments;
        
        // Map notification types
        let type: Notification['type'] = 'appointment';
        if (notif.type === 'cancellation' || notif.type === 'status_change') {
          type = 'cancellation';
        } else if (notif.type === 'reminder' || notif.type === 'confirmation') {
          type = 'reminder';
        }

        const timeAgo = formatDistanceToNow(new Date(notif.created_at), {
          addSuffix: false,
          locale: language === 'es' ? es : enUS
        });

        return {
          id: notif.id,
          title: notif.title || (language === 'es' ? 'Notificación' : 'Notification'),
          message: notif.message || '',
          time: timeAgo,
          type,
          appointmentId: apt?.id || notif.appointment_id,
          appointmentDate: apt?.date || apt?.appointment_date,
          read: notif.read || false,
          notificationId: notif.id,
        };
      });

      setNotifications(notifs);
      setHasUnread(notifs.some(n => !n.read));
    } catch (error) {
      console.error('Error fetching client notifications:', error);
    }
  };

  const handleOpenNotifications = async () => {
    setNotificationsOpen(true);
    
    // Mark all unread notifications as read when opening the panel
    const unreadNotifications = notifications.filter(n => !n.read && n.notificationId);
    if (unreadNotifications.length > 0) {
      try {
        // Group by table to batch updates
        const byTable: Record<string, string[]> = {};
        unreadNotifications.forEach(notif => {
          const table = notif.notificationTable || 'client_notifications';
          if (!byTable[table]) {
            byTable[table] = [];
          }
          if (notif.notificationId) {
            byTable[table].push(notif.notificationId);
          }
        });

        // Update each table
        for (const [table, ids] of Object.entries(byTable)) {
          await (supabase
            .from(table as any)
            .update({ read: true } as any)
            .in('id', ids) as any);
        }

        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setHasUnread(false);
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    } else {
      setHasUnread(false);
    }
  };

  const openAppointmentDetail = (appointmentId: string, appointmentDate?: string) => {
    // Close notifications sheet
    setNotificationsOpen(false);
    
    // Dispatch a custom event that calendar components can listen to
    window.dispatchEvent(new CustomEvent('openAppointmentDetail', {
      detail: { appointmentId, appointmentDate }
    }));
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Note: Notifications are already marked as read when opening the panel
    // This function only handles navigation

    // Handle navigation based on notification type
    if (notification.link) {
      // Close notifications sheet
      setNotificationsOpen(false);
      // Navigate to the link
      navigate(notification.link);
    } else if (notification.type === 'appointment' && notification.appointmentId) {
      // Open appointment detail if applicable
      openAppointmentDetail(notification.appointmentId, notification.appointmentDate);
    }
  };

  return (
    <AppointmentDetailContext.Provider value={{ openAppointmentDetail }}>
      <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 shadow-sm" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <h1 className="text-xl font-bold text-primary">{t("appName")}</h1>
            <Button variant="ghost" size="icon" className="relative" onClick={handleOpenNotifications}>
              <Bell className="h-5 w-5" />
              {hasUnread && (
                <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
              )}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom) + 16px)' }}>
          {children}
        </main>

        {/* Bottom Navigation */}
        <MobileBottomNav />

        {/* Notifications Sheet */}
        <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <SheetContent side="bottom" className="bg-card max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>{t("notifications")}</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 mt-6 overflow-y-auto max-h-[55vh]">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === 'es' ? 'No hay notificaciones recientes' : 'No recent notifications'}
                </div>
              ) : (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border border-border rounded-lg ${
                      notification.type === 'appointment' && notification.appointmentId 
                        ? 'cursor-pointer hover:bg-accent/50 transition-colors' 
                        : 'cursor-pointer'
                    } ${notification.read ? 'opacity-75' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{notification.title}</h4>
                          {notification.read && (
                            <Badge variant="secondary" className="text-xs">Leída</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap ml-2">
                        {notification.time}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppointmentDetailContext.Provider>
  );
}
