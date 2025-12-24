# 📱 IMPLEMENTACIÓN: Notificaciones en BookWise Cliente

## 🎯 Objetivo
Implementar la consulta a `client_notifications` en la app BookWise Cliente para mostrar todas las notificaciones, incluyendo las de "puede asistir" (early_arrival_request).

---

## 📋 PASO 1: Componente de Notificaciones

Crea o actualiza el componente que muestra las notificaciones:

```typescript
// src/components/Notifications/NotificationList.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface ClientNotification {
  id: string;
  user_id: string;
  client_id: string | null;
  appointment_id: string | null;
  request_id: string | null;
  business_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  meta: any;
  action_url: string | null;
  created_at: string;
}

export function NotificationList() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [language] = useState<'es' | 'en'>('es');

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('client_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setHasUnread((data || []).some(n => !n.read));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const channel = supabase
      .channel('client-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('client_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setHasUnread(prev => prev && notifications.some(n => !n.read && n.id !== notificationId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: ClientNotification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle early_arrival_request
    if (notification.type === 'early_arrival_request') {
      // Open modal to respond to early arrival request
      openEarlyArrivalModal(notification);
    } else if (notification.appointment_id) {
      // Navigate to appointment detail
      navigateToAppointment(notification.appointment_id);
    }
  };

  // Open early arrival response modal
  const openEarlyArrivalModal = (notification: ClientNotification) => {
    const requestId = notification.meta?.request_id;
    if (!requestId) return;

    // Show modal with "Puedo asistir ahora" / "No puedo, mantengo mi horario" options
    // Implementation depends on your modal system
    showEarlyArrivalResponseModal({
      requestId,
      appointmentId: notification.appointment_id,
      message: notification.message,
    });
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setIsOpen(true)}>
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="bg-card max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Notificaciones</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-6 overflow-y-auto max-h-[55vh]">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
                    notification.read ? 'opacity-75' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                        {notification.read && (
                          <Badge variant="secondary" className="text-xs">Leída</Badge>
                        )}
                        {notification.type === 'early_arrival_request' && (
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                            Requiere respuesta
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      {notification.type === 'early_arrival_request' && !notification.read && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              respondToEarlyArrival(notification.meta?.request_id, 'accepted');
                            }}
                          >
                            Puedo asistir ahora
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              respondToEarlyArrival(notification.meta?.request_id, 'rejected');
                            }}
                          >
                            No puedo, mantengo mi horario
                          </Button>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: false,
                        locale: language === 'es' ? es : enUS
                      })}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Helper function to respond to early arrival request
async function respondToEarlyArrival(requestId: string, response: 'accepted' | 'rejected') {
  try {
    const { data, error } = await supabase.rpc('respond_to_early_arrival_request', {
      p_request_id: requestId,
      p_response: response,
    });

    if (error) throw error;

    if (data && data[0]?.success) {
      // Show success message
      // Refresh notifications
      // If accepted, appointment times will be updated automatically
    }
  } catch (error) {
    console.error('Error responding to early arrival request:', error);
  }
}
```

---

## 📋 PASO 2: Servicio para Responder a Solicitudes

```typescript
// src/lib/earlyArrivalService.ts
import { supabase } from './supabaseClient';

export async function respondToEarlyArrivalRequest(
  requestId: string,
  response: 'accepted' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('respond_to_early_arrival_request', {
      p_request_id: requestId,
      p_response: response,
    });

    if (error) {
      console.error('Error responding to early arrival request:', error);
      return { success: false, error: error.message };
    }

    const result = Array.isArray(data) ? data[0] : data;
    
    if (!result || !result.success) {
      return { success: false, error: result?.error || 'Unknown error' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in respondToEarlyArrivalRequest:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
```

---

## 📋 PASO 3: Modal de Respuesta (Opcional)

```typescript
// src/components/Notifications/EarlyArrivalResponseModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { respondToEarlyArrivalRequest } from '@/lib/earlyArrivalService';

interface EarlyArrivalResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  message: string;
  onSuccess?: () => void;
}

export function EarlyArrivalResponseModal({
  open,
  onOpenChange,
  requestId,
  message,
  onSuccess,
}: EarlyArrivalResponseModalProps) {
  const [loading, setLoading] = useState(false);

  const handleResponse = async (response: 'accepted' | 'rejected') => {
    setLoading(true);
    try {
      const result = await respondToEarlyArrivalRequest(requestId, response);
      
      if (result.success) {
        onSuccess?.();
        onOpenChange(false);
        // Show success toast
      } else {
        // Show error toast
      }
    } catch (error) {
      console.error('Error responding:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitud de adelanto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => handleResponse('accepted')}
              disabled={loading}
              className="flex-1"
            >
              Puedo asistir ahora
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResponse('rejected')}
              disabled={loading}
              className="flex-1"
            >
              No puedo, mantengo mi horario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear componente `NotificationList.tsx`
- [ ] Implementar consulta a `client_notifications` con filtro por `user_id`
- [ ] Agregar suscripción Realtime para actualizaciones instantáneas
- [ ] Implementar función para marcar notificaciones como leídas
- [ ] Agregar manejo especial para notificaciones `early_arrival_request`
- [ ] Crear servicio `respondToEarlyArrivalRequest`
- [ ] Agregar botones de respuesta en la UI
- [ ] Integrar el componente en el layout principal de la app
- [ ] Probar que las notificaciones aparecen correctamente
- [ ] Probar que las respuestas a "puede asistir" funcionan

---

## 🔍 VERIFICACIÓN

Para verificar que todo funciona:

1. **Crear una solicitud desde Partner**: Haz clic en "Puede asistir" en una cita
2. **Verificar en BD**: 
   ```sql
   SELECT * FROM client_notifications 
   WHERE type = 'early_arrival_request' 
   ORDER BY created_at DESC LIMIT 1;
   ```
3. **Verificar en App Cliente**: La notificación debe aparecer inmediatamente
4. **Responder**: Hacer clic en "Puedo asistir ahora" o "No puedo"
5. **Verificar respuesta**: El `appointment_requests.status` debe cambiar a `accepted` o `rejected`

---

## 📝 NOTAS IMPORTANTES

- Las notificaciones se crean automáticamente cuando se envía "puede asistir"
- Las notificaciones incluyen `meta.request_id` para responder
- Si el cliente acepta, los horarios de la cita se actualizan automáticamente
- Las notificaciones permanecen visibles aunque estén marcadas como leídas

