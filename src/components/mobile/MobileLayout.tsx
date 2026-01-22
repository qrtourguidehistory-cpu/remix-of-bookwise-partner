import { ReactNode, useState, useEffect, createContext, useContext, useRef } from "react";
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
import { Capacitor } from "@capacitor/core";
import { initializePartnerPush, setNavigationCallback } from "@/services/partnerPushService";

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

  // Tipos de notificaciones operativas esenciales para Partner
  // El Partner NO necesita todas las notificaciones del cliente
  // Solo notificaciones que requieren acción operativa
  const ALLOWED_PARTNER_TYPES = [
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
    // Tipos del sistema (approval, etc.)
    'approval_approved',
    'approval_rejected',
  ] as const;

  // ✅ Solicitar permisos de notificaciones al abrir la app
  const notificationPermissionRequested = useRef(false);
  
  useEffect(() => {
    if (!profile?.id || notificationPermissionRequested.current) return;

    const requestNotificationPermissions = async () => {
      try {
        notificationPermissionRequested.current = true;
        console.log('[MobileLayout] 🔔 Solicitando permisos de notificaciones...');

        // Llamar initializePartnerPush que maneja tanto web como nativo
        await initializePartnerPush(profile.id);
        
        console.log('[MobileLayout] ✅ Permisos de notificaciones procesados');
      } catch (error) {
        console.error('[MobileLayout] ❌ Error solicitando permisos de notificaciones:', error);
      }
    };

    // Solo solicitar si el usuario está autenticado y es partner
    if (profile?.business_id) {
      requestNotificationPermissions();
    }
  }, [profile?.id, profile?.business_id]);

  // ✅ Configurar callback de navegación para push notifications
  useEffect(() => {
    setNavigationCallback((path: string) => {
      console.log('[MobileLayout] 🧭 Navegando desde notificación push:', path);
      navigate(path);
    });

    return () => {
      // Cleanup: remover callback cuando el componente se desmonta
      setNavigationCallback(() => {});
    };
  }, [navigate]);

  useEffect(() => {
    if (!profile?.id) return;

    const isPartner = !!profile?.business_id;

    if (isPartner) {
      // ✅ CORRECCIÓN: Partner solo se suscribe a 'notifications', NO a 'client_notifications'
      // Obtener owner_id del negocio (los triggers insertan con owner_id, no profile.id)
      let ownerId: string | null = null;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      let isSubscribed = false;
      let cleanupExecuted = false;

      const setupRealtimeSubscription = async () => {
        // ⚠️ PREVENIR SUSCRIPCIONES DUPLICADAS
        if (isSubscribed || cleanupExecuted) {
          console.log('⚠️ [REALTIME] Suscripción ya activa o limpieza ejecutada, ignorando setup');
          return;
        }

        try {
          // Obtener owner_id del negocio
          const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('owner_id')
            .eq('id', profile.business_id!)
            .maybeSingle();

          if (businessError) {
            console.error('❌ [REALTIME] Error obteniendo owner_id:', businessError);
            return;
          }

          if (!business || !business.owner_id) {
            console.warn('⚠️ [REALTIME] No se encontró negocio o owner_id para:', profile.business_id);
            return;
          }

          ownerId = business.owner_id;
          console.log('✅ [REALTIME] Owner ID obtenido:', ownerId);

          // Cargar notificaciones iniciales con owner_id
          await fetchNotifications(ownerId);

          // ✅ USAR NOMBRE FIJO DEL CANAL (NO Date.now()) para evitar duplicados
          const channelName = `notifications-partner-${ownerId}`;
          
          // ⚠️ LIMPIAR CANAL ANTERIOR SI EXISTE
          const existingChannel = supabase.channel(channelName);
          if (existingChannel) {
            try {
              await supabase.removeChannel(existingChannel);
              console.log('🧹 [REALTIME] Canal anterior removido');
            } catch (err) {
              console.warn('⚠️ [REALTIME] No se pudo remover canal anterior (puede no existir):', err);
            }
          }

          // Crear nuevo canal con nombre fijo
          channel = supabase.channel(channelName, {
            config: {
              broadcast: { self: false },
              presence: { key: ownerId },
            },
          });

          // Suscribirse a cambios en tiempo real
          channel
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${ownerId}`,
              },
              (payload) => {
                console.log('🔔 [REALTIME] Nueva notificación recibida:', payload);
                
                // Fallback defensivo: Agregar directamente sin refetch completo
                const newNotif = payload.new as any;
                
                // Validar que sea un tipo operativo esencial
                if (!ALLOWED_PARTNER_TYPES.includes(newNotif.type)) {
                  console.log(`⚠️ [REALTIME] Tipo ignorado: ${newNotif.type}`);
                  return;
                }

                // Procesar y agregar la nueva notificación al estado
                const timeAgo = formatDistanceToNow(new Date(newNotif.created_at), {
                  addSuffix: false,
                  locale: language === 'es' ? es : enUS,
                });

                let type: Notification['type'] = 'appointment';
                if (newNotif.type === 'approval_rejected') {
                  type = 'cancellation';
                } else if (newNotif.type === 'approval_approved') {
                  type = 'reminder';
                }

                const processedNotif: Notification = {
                  id: newNotif.id,
                  title: newNotif.title || (language === 'es' ? 'Notificación' : 'Notification'),
                  message: newNotif.message || '',
                  time: timeAgo,
                  type,
                  read: false,
                  notificationId: newNotif.id,
                  notificationTable: 'notifications',
                  link: newNotif.link,
                };

                // Agregar al inicio del array (más reciente primero)
                setNotifications((prev) => {
                  // Evitar duplicados
                  if (prev.some((n) => n.id === newNotif.id)) {
                    console.log('⚠️ [REALTIME] Notificación duplicada ignorada:', newNotif.id);
                    return prev;
                  }
                  return [processedNotif, ...prev];
                });

                setHasUnread(true);
              }
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${ownerId}`,
              },
              (payload) => {
                console.log('🔔 [REALTIME] Notificación actualizada:', payload);
                // Actualizar notificación existente (ej: marcada como leída)
                const updatedNotif = payload.new as any;
                setNotifications((prev) =>
                  prev.map((n) =>
                    n.id === updatedNotif.id
                      ? { ...n, read: updatedNotif.read || false }
                      : n
                  )
                );
              }
            )
            .subscribe((status) => {
              console.log('📡 [REALTIME] Estado de suscripción:', status);
              if (status === 'SUBSCRIBED') {
                isSubscribed = true;
                console.log('✅ [REALTIME] Suscrito correctamente a notifications');
              } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ [REALTIME] Error en canal:', status);
                isSubscribed = false;
              }
            });

          isSubscribed = true;
        } catch (error) {
          console.error('❌ [REALTIME] Error en setup:', error);
          isSubscribed = false;
        }
      };

      setupRealtimeSubscription();

      // ✅ NO RE-SUSCRIBIR AUTOMÁTICAMENTE AL VOLVER DE BACKGROUND
      // El cleanup del useEffect se encarga de limpiar correctamente

      return () => {
        cleanupExecuted = true;
        isSubscribed = false;
        if (channel) {
          console.log('🧹 [REALTIME] Limpiando suscripción');
          supabase
            .removeChannel(channel)
            .then(() => {
              console.log('✅ [REALTIME] Canal removido exitosamente');
            })
            .catch((err) => {
              console.error('❌ [REALTIME] Error removiendo canal:', err);
            });
        }
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

  const fetchNotifications = async (ownerId?: string) => {
    const isPartner = !!profile?.business_id;

    if (!isPartner || !profile?.id) return;

    try {
      // Obtener owner_id si no se proporciona
      let finalOwnerId = ownerId;
      if (!finalOwnerId) {
        const { data: business } = await supabase
          .from('businesses')
          .select('owner_id')
          .eq('id', profile.business_id!)
          .single();
        finalOwnerId = business?.owner_id;
      }

      if (!finalOwnerId) {
        console.error('❌ [FETCH] No se pudo obtener owner_id');
        return;
      }

      // ✅ CORRECCIÓN: Partner solo consulta la tabla 'notifications'
      // ❌ NO consultar client_notifications (esas son para clientes)
      // Usar owner_id en lugar de profile.id
      const { data: partnerNotifs, error: partnerNotifError } = await (supabase
        .from('notifications' as any)
        .select(`
          id,
          type,
          title,
          message,
          read,
          created_at,
          link,
          meta,
          appointment_id
        `)
        .eq('user_id', finalOwnerId) // ✅ Usar owner_id, no profile.id
        .order('created_at', { ascending: false })
        .limit(500) as any);

      if (partnerNotifError) {
        console.error('Error fetching partner notifications:', partnerNotifError);
        setNotifications([]);
        return;
      }

      // Filtro defensivo: Solo procesar tipos operativos esenciales
      const filteredNotifs = (partnerNotifs || []).filter((notif: any) => {
        const notifType = notif.type || '';
        const isAllowed = ALLOWED_PARTNER_TYPES.includes(notifType);
        
        if (!isAllowed) {
          console.log(`⚠️ [PARTNER NOTIFICATIONS] Tipo ignorado: ${notifType} - No es operativo esencial`);
        }
        
        return isAllowed;
      });

      // Process partner notifications (solo tipos operativos esenciales)
      const processedNotifs: Notification[] = filteredNotifs.map((notif: any) => {
        // Mapear tipos de BD a tipos de UI para visualización
        let type: Notification['type'] = 'appointment';
        if (notif.type === 'approval_rejected') {
          type = 'cancellation';
        } else if (notif.type === 'approval_approved') {
          type = 'reminder';
        } else if (
          notif.type === 'new_appointment' || 
          notif.type === 'appointment_status_change' ||
          notif.type === 'early_arrival_request' ||
          notif.type === 'early_arrival_approved' ||
          notif.type === 'early_arrival_rejected' ||
          notif.type === 'review_received' ||
          notif.type === 'payment_received' ||
          notif.type === 'credit_payment' ||
          notif.type === 'payment_reminder' ||
          notif.type === 'monthly_payment_reminder'
        ) {
          type = 'appointment'; // Todos los tipos operativos se muestran como 'appointment'
        }

        const timeAgo = formatDistanceToNow(new Date(notif.created_at), {
          addSuffix: false,
          locale: language === 'es' ? es : enUS
        });

        // Extract appointment_id from meta or direct field
        const meta = notif.meta as any;
        const appointmentId = notif.appointment_id || meta?.appointment_id || meta?.appointmentId;
        const appointmentDate = meta?.appointment_date || meta?.appointmentDate;

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
          appointmentId,
          appointmentDate,
        };
      });

      setNotifications(processedNotifs);
      setHasUnread(processedNotifs.some(n => !n.read));
    } catch (error) {
      console.error('Error fetching partner notifications:', error);
      setNotifications([]);
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
    // NO marcar como leídas automáticamente - solo al hacer clic individual
    // Esto asegura que el historial se mantenga visible
  };

  const openAppointmentDetail = (appointmentId: string, appointmentDate?: string) => {
    // Close notifications sheet
    setNotificationsOpen(false);
    
    // Navigate to calendar first if not already there
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/calendar') && !currentPath.includes('/mobile/calendar')) {
      navigate('/mobile/calendar');
      // Wait a bit for navigation, then dispatch event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openAppointmentDetail', {
          detail: { appointmentId, appointmentDate }
        }));
      }, 100);
    } else {
      // Already on calendar page, dispatch immediately
      window.dispatchEvent(new CustomEvent('openAppointmentDetail', {
        detail: { appointmentId, appointmentDate }
      }));
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Close notifications sheet first
    setNotificationsOpen(false);

    // Handle navigation based on notification type
    // Try to extract appointment ID from link or use appointmentId
    let aptId = notification.appointmentId;
    let aptDate = notification.appointmentDate;
    
    // If no appointmentId but we have a link, try to extract from link
    if (!aptId && notification.link) {
      // Try different patterns
      const patterns = [
        /\/admin\/calendar\/appointment\/([a-f0-9-]+)/i,
        /\/mobile\/calendar\/appointment\/([a-f0-9-]+)/i,
        /appointments\/([a-f0-9-]+)/i,
        /appointment[_-]?id[=:]([a-f0-9-]+)/i,
        /appointmentId=([a-f0-9-]+)/i
      ];
      
      for (const pattern of patterns) {
        const match = notification.link.match(pattern);
        if (match && match[1]) {
          aptId = match[1];
          break;
        }
      }
      
      // Try to extract date from link
      const dateMatch = notification.link.match(/[?&]date=([^&]+)/i);
      if (dateMatch && dateMatch[1]) {
        aptDate = decodeURIComponent(dateMatch[1]);
      }
    }
    
    // If we have appointment ID, navigate to calendar and open it
    if (aptId) {
      // Navigate to calendar first
      navigate('/mobile/calendar');
      
      // Wait a bit for navigation, then open appointment detail
      setTimeout(() => {
        openAppointmentDetail(aptId, aptDate);
        
        // Mark as read ONLY after successfully opening the appointment
        if (!notification.read && notification.notificationId) {
          const markAsRead = async () => {
            try {
              const table = notification.notificationTable || 'notifications';
              await (supabase
                .from(table as any)
                .update({ read: true } as any)
                .eq('id', notification.notificationId) as any);

              // Update local state
              setNotifications(prev => 
                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
              );
              setHasUnread(notifications.some(n => n.id !== notification.id && !n.read));
            } catch (error) {
              console.error('Error marking notification as read:', error);
            }
          };
          markAsRead();
        }
      }, 300);
    } else if (notification.link && !notification.link.includes('/admin/appointments')) {
      // Navigate to the link if it's not an appointment detail link and not the appointments page
      navigate(notification.link);
      
      // Mark as read after navigation
      if (!notification.read && notification.notificationId) {
        try {
          const table = notification.notificationTable || 'notifications';
          await (supabase
            .from(table as any)
            .update({ read: true } as any)
            .eq('id', notification.notificationId) as any);

          setNotifications(prev => 
            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
          );
          setHasUnread(notifications.some(n => n.id !== notification.id && !n.read));
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      }
    } else {
      // Fallback: navigate to calendar
      navigate('/mobile/calendar');
    }
  };

  return (
    <AppointmentDetailContext.Provider value={{ openAppointmentDetail }}>
      <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 shadow-sm pt-safe">
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-content-with-nav">
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
                  {language === 'es' ? 'No hay notificaciones' : 'No notifications'}
                </div>
              ) : (
                <>
                  {/* Mostrar todas las notificaciones, no solo las no leídas */}
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 border border-border rounded-lg ${
                        notification.type === 'appointment' && notification.appointmentId 
                          ? 'cursor-pointer hover:bg-accent/50 transition-colors' 
                          : 'cursor-pointer hover:bg-accent/50 transition-colors'
                      } ${notification.read ? 'opacity-60 bg-muted/30' : 'bg-card border-primary/20'}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <span className="h-2 w-2 bg-primary rounded-full" />
                            )}
                            <h4 className={`font-semibold text-sm ${!notification.read ? 'font-bold' : ''}`}>
                              {notification.title}
                            </h4>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        </div>
                        <Badge variant="outline" className="text-xs whitespace-nowrap ml-2">
                          {notification.time}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppointmentDetailContext.Provider>
  );
}
