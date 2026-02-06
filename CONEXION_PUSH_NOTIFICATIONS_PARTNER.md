# 🔌 CONEXIÓN DE PUSH NOTIFICATIONS – APP PARTNER

**Fecha:** 2026-02-03  
**Objetivo:** Identificar puntos exactos donde agregar llamadas a Edge Functions

---

## 📋 RESUMEN DE EDGE FUNCTIONS DISPONIBLES

| Edge Function | Evento | Receptor | Input |
|---------------|--------|----------|-------|
| `notify-appointment-confirmed` | Cita confirmada | Cliente | `{ appointment_id }` |
| `notify-appointment-completed` | Cita completada | Cliente | `{ appointment_id }` |
| `notify-next-in-queue` | Próximo en cola | Cliente (siguiente) | `{ appointment_id, business_id, staff_id, current_appointment_end_time }` |
| `notify-new-appointment` | Nueva cita creada | Partner | `{ appointment_id }` |

**⚠️ NOTA:** No existe `notify-appointment-rescheduled`. Para reprogramar citas, se puede usar `notify-appointment-confirmed` si la cita está confirmada.

---

## 1️⃣ CONFIRMAR CITA

### 📍 **Archivo:** `src/components/mobile/DayView.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 568-583

**Código actual:**
```typescript
const { error, data } = await supabase
  .from("appointments")
  .update({ status: dbStatus as "pending" | "confirmed" | "completed" | "cancelled" | "no_show" })
  .eq("id", selectedAppointment.id)
  .eq("business_id", profile.business_id)
  .select()
  .single();

if (error) {
  // ... manejo de error
  return;
}

// Toast con ID fijo para evitar duplicados
toast.success("Estado actualizado", {
  id: 'appointment-status-updated',
  duration: 3000,
});
```

**✅ Código final agregado (después de línea 589):**
```typescript
// ✅ Notificar al cliente cuando la cita se confirma
if (dbStatus === "confirmed" && oldStatus !== "confirmed" && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-confirmed', {
      body: { appointment_id: selectedAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment confirmed (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/StaffCalendarView.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 442-459

**Código actual:**
```typescript
const { error, data } = await supabase
  .from("appointments")
  .update({ status: dbStatus as "pending" | "confirmed" | "completed" | "cancelled" | "no_show" })
  .eq("id", selectedAppointment.id)
  .eq("business_id", profile.business_id)
  .select()
  .single();

if (error) {
  // ... manejo de error
  return;
}

// Toast con ID fijo para evitar duplicados
toast.success("Estado actualizado", {
  id: 'appointment-status-updated',
  duration: 3000,
});
```

**✅ Código final agregado (después de línea 465):**
```typescript
// ✅ Notificar al cliente cuando la cita se confirma
if (dbStatus === "confirmed" && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-confirmed', {
      body: { appointment_id: selectedAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment confirmed (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/AppointmentDialog.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 744-750

**Código actual:**
```typescript
const { error } = await supabase
  .from("appointments")
  .update({ status: newStatus })
  .eq("id", appointment.id)
  .eq("business_id", profile.business_id);

if (error) throw error;
```

**✅ Código final agregado (después de línea 772, después del toast):**
```typescript
// ✅ Notificar al cliente cuando la cita se confirma
if (newStatus === "confirmed" && oldStatus !== "confirmed" && appointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-confirmed', {
      body: { appointment_id: appointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment confirmed (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/WeekView.tsx`
### 📍 **Función:** `onQuickAction` (callback)
### 📍 **Línea aproximada:** 338-352

**Código actual:**
```typescript
const { error } = await supabase
  .from("appointments")
  .update({ status })
  .eq("id", selectedAppointment.id)
  .eq("business_id", profile.business_id);

if (error) {
  // ... manejo de error
  return;
}
```

**✅ Código final agregado (después del update exitoso, antes de línea 355):**
```typescript
// ✅ Notificar al cliente cuando la cita se confirma
if (status === 'confirmed' && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-confirmed', {
      body: { appointment_id: selectedAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment confirmed (non-blocking):", err);
  }
}
```

---

## 2️⃣ REPROGRAMAR / MOVER CITA

### 📍 **Archivo:** `src/components/mobile/DayView.tsx`
### 📍 **Función:** `handleDragEnd`
### 📍 **Línea aproximada:** 528-542

**Código actual:**
```typescript
const { error } = await supabase
  .from("appointments")
  .update({
    start_time: newStartTime24,
    end_time: newEndTime24
  })
  .eq("id", appointmentId)
  .eq("business_id", profile.business_id);

if (error) {
  toast.error("No se pudo mover la cita");
} else {
  toast.success(`Cita reorganizada a ${newTimeSlot}`);
  fetchAppointments();
}
```

**✅ Código final agregado (después de línea 540, dentro del else):**
```typescript
// ✅ Notificar al cliente si la cita está confirmada
if (!error && appointmentId) {
  try {
    // Verificar si la cita está confirmada antes de notificar
    const { data: updatedAppointment } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", appointmentId)
      .single();
    
    if (updatedAppointment?.status === "confirmed") {
      await supabase.functions.invoke('notify-appointment-confirmed', {
        body: { appointment_id: appointmentId }
      });
    }
  } catch (err) {
    console.error("Error notifying appointment rescheduled (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/AppointmentDetailView.tsx`
### 📍 **Función:** `handleMoveAppointment`
### 📍 **Línea aproximada:** 1130-1185

**Código actual:**
```typescript
const { error } = await supabase
  .from("appointments")
  .update({
    appointment_date: newDate,
    start_time: newStartTime,
    end_time: newEndTime,
  })
  .eq("id", appointment.id)
  .eq("business_id", profile.business_id);

if (error) {
  // ... manejo de error
} else {
  // ... éxito
}
```

**✅ Código final agregado (después del update exitoso, dentro del else):**
```typescript
// ✅ Notificar al cliente si la cita está confirmada
if (!error && appointment?.id) {
  try {
    // Verificar si la cita está confirmada antes de notificar
    const { data: updatedAppointment } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", appointment.id)
      .single();
    
    if (updatedAppointment?.status === "confirmed") {
      await supabase.functions.invoke('notify-appointment-confirmed', {
        body: { appointment_id: appointment.id }
      });
    }
  } catch (err) {
    console.error("Error notifying appointment rescheduled (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/AppointmentDialog.tsx`
### 📍 **Función:** `handleSubmit` (cuando se edita una cita existente)
### 📍 **Línea aproximada:** 533-544

**Código actual:**
```typescript
if (appointment) {
  // ... validaciones
  
  const { error } = await supabase
    .from("appointments")
    .update(appointmentData)
    .eq("id", appointment.id)
    .eq("business_id", profile.business_id);

  if (error) throw error;

  toast({
    title: t("success") || "Success",
    description: language === "es" ? "Cita actualizada exitosamente" : "Appointment updated successfully",
  });
}
```

**✅ Código final agregado (después de línea 544, después del toast):**
```typescript
// ✅ Notificar al cliente si la cita está confirmada y se cambió fecha/hora
if (!error && appointment?.id) {
  try {
    const dateChanged = appointmentData.appointment_date !== appointment.appointment_date ||
                        appointmentData.start_time !== appointment.start_time;
    
    if (dateChanged) {
      const { data: updatedAppointment } = await supabase
        .from("appointments")
        .select("status")
        .eq("id", appointment.id)
        .single();
      
      if (updatedAppointment?.status === "confirmed") {
        await supabase.functions.invoke('notify-appointment-confirmed', {
          body: { appointment_id: appointment.id }
        });
      }
    }
  } catch (err) {
    console.error("Error notifying appointment rescheduled (non-blocking):", err);
  }
}
```

---

## 3️⃣ SIGUIENTE EN TURNO / ADELANTAR CITA

### 📍 **Archivo:** `src/components/mobile/DayView.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 601-618

**Código actual:**
```typescript
// Notify next client when appointment is started
if (dbStatus === "started" && selectedAppointment?.id) {
  try {
    await notifyNextClientWhenAppointmentStarted({
      businessId: profile.business_id,
      currentAppointment: {
        id: selectedAppointment.id,
        appointment_date: selectedAppointment.appointment_date,
        start_time: selectedAppointment.start_time,
        end_time: selectedAppointment.end_time,
        staff_id: selectedAppointment.staff_id,
      },
      language: language === "es" ? "es" : "en",
    });
  } catch (err) {
    console.error("Error notifying next client (non-blocking):", err);
  }
}
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
// ✅ Notificar siguiente cliente cuando la cita se inicia
if (dbStatus === "started" && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-next-in-queue', {
      body: {
        appointment_id: selectedAppointment.id,
        business_id: profile.business_id,
        staff_id: selectedAppointment.staff_id || '',
        current_appointment_end_time: selectedAppointment.end_time || selectedAppointment.start_time || '',
      }
    });
  } catch (err) {
    console.error("Error notifying next client (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/StaffCalendarView.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 469-486

**Código actual:**
```typescript
// Notify next client when appointment is started
if (dbStatus === "started" && selectedAppointment?.id) {
  try {
    await notifyNextClientWhenAppointmentStarted({
      businessId: profile.business_id,
      currentAppointment: {
        id: selectedAppointment.id,
        appointment_date: selectedAppointment.appointment_date,
        start_time: selectedAppointment.start_time,
        end_time: selectedAppointment.end_time,
        staff_id: selectedAppointment.staff_id,
      },
      language: language === "es" ? "es" : "en",
    });
  } catch (err) {
    console.error("Error notifying next client (non-blocking):", err);
  }
}
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
// ✅ Notificar siguiente cliente cuando la cita se inicia
if (dbStatus === "started" && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-next-in-queue', {
      body: {
        appointment_id: selectedAppointment.id,
        business_id: profile.business_id,
        staff_id: selectedAppointment.staff_id || '',
        current_appointment_end_time: selectedAppointment.end_time || selectedAppointment.start_time || '',
      }
    });
  } catch (err) {
    console.error("Error notifying next client (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/AppointmentDialog.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 778-796

**Código actual:**
```typescript
// Notify next client when appointment is started
if (newStatus === "started" && appointment?.id) {
  try {
    const { notifyNextClientWhenAppointmentStarted } = await import("@/lib/queueNotifications");
    await notifyNextClientWhenAppointmentStarted({
      businessId: profile.business_id,
      currentAppointment: {
        id: appointment.id,
        appointment_date: appointment.appointment_date || appointment.date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        staff_id: appointment.staff_id,
      },
      language: language === "es" ? "es" : "en",
    });
  } catch (err) {
    console.error("Error notifying next client (non-blocking):", err);
  }
}
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
// ✅ Notificar siguiente cliente cuando la cita se inicia
if (newStatus === "started" && appointment?.id) {
  try {
    await supabase.functions.invoke('notify-next-in-queue', {
      body: {
        appointment_id: appointment.id,
        business_id: profile.business_id,
        staff_id: appointment.staff_id || '',
        current_appointment_end_time: appointment.end_time || appointment.start_time || '',
      }
    });
  } catch (err) {
    console.error("Error notifying next client (non-blocking):", err);
  }
}
```

---

## 4️⃣ CITA COMPLETADA

### 📍 **Archivo:** `src/components/mobile/DayView.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 622-638

**Código actual:**
```typescript
// Notify next client when appointment is completed
if (dbStatus === "completed" && selectedAppointment?.id) {
  try {
    await notifyNextClientWhenAppointmentCompleted({
      businessId: profile.business_id,
      currentAppointment: {
        id: selectedAppointment.id,
        appointment_date: selectedAppointment.appointment_date,
        end_time: selectedAppointment.end_time,
        staff_id: selectedAppointment.staff_id,
      },
      language: language === "es" ? "es" : "en",
    });
  } catch (err) {
    console.error("Error notifying next client when completed (non-blocking):", err);
  }
}
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
// ✅ Notificar al cliente cuando la cita se completa
if (dbStatus === "completed" && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-completed', {
      body: { appointment_id: selectedAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment completed (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/StaffCalendarView.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 490-506

**Código actual:**
```typescript
// Notify next client when appointment is completed
if (dbStatus === "completed" && selectedAppointment?.id) {
  try {
    await notifyNextClientWhenAppointmentCompleted({
      businessId: profile.business_id,
      currentAppointment: {
        id: selectedAppointment.id,
        appointment_date: selectedAppointment.appointment_date,
        end_time: selectedAppointment.end_time,
        staff_id: selectedAppointment.staff_id,
      },
      language: language === "es" ? "es" : "en",
    });
  } catch (err) {
    console.error("Error notifying next client when completed (non-blocking):", err);
  }
}
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
// ✅ Notificar al cliente cuando la cita se completa
if (dbStatus === "completed" && selectedAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-completed', {
      body: { appointment_id: selectedAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment completed (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/AppointmentDialog.tsx`
### 📍 **Función:** `handleQuickAction`
### 📍 **Línea aproximada:** 800-817

**Código actual:**
```typescript
// Notify next client when appointment is completed
if (newStatus === "completed" && appointment?.id) {
  try {
    const { notifyNextClientWhenAppointmentCompleted } = await import("@/lib/queueNotifications");
    await notifyNextClientWhenAppointmentCompleted({
      businessId: profile.business_id,
      currentAppointment: {
        id: appointment.id,
        appointment_date: appointment.appointment_date || appointment.date,
        end_time: appointment.end_time,
        staff_id: appointment.staff_id,
      },
      language: language === "es" ? "es" : "en",
    });
  } catch (err) {
    console.error("Error notifying next client when completed (non-blocking):", err);
  }
}
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
// ✅ Notificar al cliente cuando la cita se completa
if (newStatus === "completed" && appointment?.id) {
  try {
    await supabase.functions.invoke('notify-appointment-completed', {
      body: { appointment_id: appointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment completed (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/WeekView.tsx`
### 📍 **Función:** `onQuickAction` (callback)
### 📍 **Línea aproximada:** 390-403

**Código actual:**
```typescript
} else if (status === 'completed') {
  await sendNotificationToClient({
    appointmentId: selectedAppointment.id,
    clientId: selectedAppointment.client_id,
    clientEmail: selectedAppointment.client_email,
    clientPhone: selectedAppointment.client_phone,
    clientName: (selectedAppointment.client_name && selectedAppointment.client_name.trim())
      ? selectedAppointment.client_name.trim()
      : selectedAppointment.clients?.full_name || "",
    type: 'completion',
    appointmentDate: appointmentDate ? new Date(appointmentDate).toLocaleDateString('es-ES') : undefined,
    appointmentTime: appointmentTime,
    businessId: profile.business_id,
  });
```

**✅ Código final agregado (REEMPLAZAR el bloque existente):**
```typescript
} else if (status === 'completed') {
  // ✅ Notificar al cliente cuando la cita se completa
  try {
    await supabase.functions.invoke('notify-appointment-completed', {
      body: { appointment_id: selectedAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying appointment completed (non-blocking):", err);
  }
```

---

## 5️⃣ NUEVA CITA CREADA

### 📍 **Archivo:** `src/pages/mobile/BookingFlow.tsx`
### 📍 **Función:** `handleConfirm`
### 📍 **Línea aproximada:** 507-523

**Código actual:**
```typescript
const { data: newAppointment, error } = await supabase
  .from("appointments")
  .insert(insertData as any)
  .select()
  .single();

if (error) {
  // ... manejo de error
  throw error;
}

// Crear notificación para Partner sobre nueva cita
if (newAppointment && profile?.business_id && profile?.id) {
  try {
    const { notifyNewAppointment } = await import("@/lib/partnerNotificationService");
    // ... código existente
  }
}
```

**✅ Código final agregado (después de línea 523, después de verificar error):**
```typescript
// ✅ Notificar al Partner cuando se crea una nueva cita
if (!error && newAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-new-appointment', {
      body: { appointment_id: newAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying new appointment (non-blocking):", err);
  }
}
```

---

### 📍 **Archivo:** `src/components/mobile/AppointmentDialog.tsx`
### 📍 **Función:** `handleSubmit` (cuando se crea una nueva cita)
### 📍 **Línea aproximada:** 553-569

**Código actual:**
```typescript
const { data: newAppointment, error } = await supabase
  .from("appointments")
  .insert(insertData as any)
  .select()
  .single();

if (error) {
  // ... manejo de error
  throw error;
}

// Send notifications if appointment is confirmed
// IMPORTANTE: Envolver en try/catch para que no bloquee la creación si hay error
if (formData.status === 'confirmed' && newAppointment) {
  // ... código existente
}
```

**✅ Código final agregado (después de línea 569, después de verificar error):**
```typescript
// ✅ Notificar al Partner cuando se crea una nueva cita
if (!error && newAppointment?.id) {
  try {
    await supabase.functions.invoke('notify-new-appointment', {
      body: { appointment_id: newAppointment.id }
    });
  } catch (err) {
    console.error("Error notifying new appointment (non-blocking):", err);
  }
}
```

---

## 📊 RESUMEN DE CAMBIOS

### Archivos a Modificar:

1. ✅ `src/components/mobile/DayView.tsx` - 3 cambios (confirmed, started, completed)
2. ✅ `src/components/mobile/StaffCalendarView.tsx` - 3 cambios (confirmed, started, completed)
3. ✅ `src/components/mobile/AppointmentDialog.tsx` - 4 cambios (confirmed, started, completed, nueva cita)
4. ✅ `src/components/mobile/WeekView.tsx` - 2 cambios (confirmed, completed)
5. ✅ `src/components/mobile/AppointmentDetailView.tsx` - 1 cambio (mover cita)
6. ✅ `src/pages/mobile/BookingFlow.tsx` - 1 cambio (nueva cita)

**Total:** 14 puntos de conexión

---

## ⚠️ NOTAS IMPORTANTES

1. **No existe `notify-appointment-rescheduled`:** Para reprogramar citas, usar `notify-appointment-confirmed` si la cita está confirmada.

2. **Reemplazar funciones legacy:** Los bloques que usan `notifyNextClientWhenAppointmentStarted` y `notifyNextClientWhenAppointmentCompleted` deben ser reemplazados por las llamadas directas a Edge Functions.

3. **Solo después de éxito:** Todas las llamadas a Edge Functions deben estar dentro de bloques `if (!error)` o después de verificar que el update fue exitoso.

4. **Non-blocking:** Todas las llamadas están envueltas en `try/catch` para que no bloqueen la operación principal.

---

## ✅ RESULTADO ESPERADO

- ✅ Pushs al cliente solo cuando el Partner ejecuta acciones reales
- ✅ Cero duplicados (cada evento tiene UNA sola llamada)
- ✅ Control total desde el frontend
- ✅ Arquitectura determinística y mantenible

