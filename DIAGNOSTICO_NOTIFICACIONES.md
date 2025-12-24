# 🔍 DIAGNÓSTICO: Notificaciones no llegan a BookWise Cliente

## ✅ LO QUE ESTÁ FUNCIONANDO

1. **Notificaciones creadas**: Se están creando correctamente en `client_notifications`
   - 23 notificaciones para el usuario `be9bf819-27dc-4104-b104-3bf52eb1db2f`
   - Tipos: `early_arrival_request`, `review_request`, `confirmation`, `completed`
   - Todas tienen `user_id` correcto

2. **Políticas RLS**: Configuradas correctamente
   - Permiten acceso por `user_id = auth.uid()` incluso si `client_id` es null
   - Política: `"Users can view their own notifications"`

3. **Funciones backend**: Funcionando correctamente
   - `create_pending_review_on_appointment_completed()` crea notificaciones de review
   - `create_early_arrival_request()` crea solicitudes de "puede asistir"
   - `send-early-arrival-request` Edge Function envía notificaciones

## ❌ PROBLEMA IDENTIFICADO

**La app BookWise Cliente NO está consultando la tabla `client_notifications`.**

### Evidencia:
- Las notificaciones existen en la BD (23 notificaciones)
- Las políticas RLS permiten acceso
- Pero la app Cliente no las está mostrando

## 🔧 SOLUCIÓN

La app BookWise Cliente necesita implementar la consulta a `client_notifications`.

### Código requerido en la app Cliente:

```typescript
// En el componente de notificaciones de la app Cliente
const { data: notifications } = await supabase
  .from('client_notifications')
  .select('*')
  .eq('user_id', currentUser.id)  // ✅ Usar user_id, no client_id
  .order('created_at', { ascending: false })
  .limit(50);

// Suscripción Realtime para actualizaciones instantáneas
const channel = supabase
  .channel('client-notifications')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'client_notifications',
    filter: `user_id=eq.${currentUser.id}`
  }, () => {
    fetchNotifications(); // Refrescar notificaciones
  })
  .subscribe();
```

## 📋 NOTAS IMPORTANTES

1. **Usar `user_id`, no `client_id`**: Las notificaciones se crean con `user_id` del cliente
2. **Filtrar por `user_id`**: La política RLS permite acceso por `user_id = auth.uid()`
3. **Realtime**: Suscribirse a cambios para actualizaciones instantáneas
4. **Review notifications**: Tienen `meta.send_at` en el futuro, pero se crean inmediatamente
   - La app Cliente debe mostrar todas las notificaciones, no solo las que tienen `send_at` en el pasado

## 📄 DOCUMENTACIÓN COMPLETA

Ver `IMPLEMENTACION_CLIENTE_NOTIFICACIONES.md` para la implementación completa.


