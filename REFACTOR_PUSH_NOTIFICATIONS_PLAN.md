# 🗺️ FASE 0 — MAPA DEFINITIVO DE EVENTOS

## ✅ Eventos Válidos de Push Notifications

| Evento | Origen | Receptor | App | Edge Function |
|--------|--------|----------|-----|---------------|
| Nueva cita creada | `INSERT appointments` | Partner | Partner App | `notify-new-appointment` |
| Cita confirmada | `UPDATE appointments.status = 'confirmed'` | Cliente | Cliente App | `notify-appointment-confirmed` |
| Cita completada | `UPDATE appointments.status = 'completed'` | Cliente | Cliente App | `notify-appointment-completed` |
| Próximo en cola | `UPDATE appointments.status = 'started'` | Cliente (siguiente) | Cliente App | `notify-next-in-queue` |

## ❗ Reglas Absolutas

1. **NO existen otros eventos de push fuera de esta lista**
2. **Cada evento tendrá UNA sola Edge Function dedicada**
3. **Envío token por token (nunca batch masivo)**
4. **Basado exclusivamente en `client_devices`**

---

## 📋 Plan de Ejecución

### FASE 1: Limpieza Quirúrgica ✅ COMPLETADO
- [x] Eliminar triggers duplicados en `appointments`
- [x] Eliminar triggers obsoletos en `client_notifications`
- [x] Eliminar funciones SQL obsoletas
- [x] Corregir constraint UNIQUE en `client_devices`

**Migración:** `refactor_push_notifications_phase_1_cleanup_fixed`

### FASE 2: Congelar Envíos Automáticos ✅ COMPLETADO
- [x] Modificar triggers para que solo registren eventos (NO envíen push)

**Migración:** `refactor_push_notifications_phase_2_freeze_auto_sends`

### FASE 3: Nuevo Sistema de Push ✅ COMPLETADO
- [x] Crear `notify-appointment-confirmed`
- [x] Crear `notify-appointment-completed`
- [x] Crear `notify-next-in-queue`
- [x] Crear `notify-new-appointment`

**Ubicación:** `supabase/functions/notify-*/`

---

## ✅ REFACTOR COMPLETADO

Ver `REFACTOR_PUSH_NOTIFICATIONS_COMPLETADO.md` para detalles completos.

