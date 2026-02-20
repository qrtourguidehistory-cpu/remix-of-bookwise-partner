# 📋 Diseño: Nuevo Flujo de Creación de Citas Manuales

## 🎯 Objetivo

Rediseñar completamente el flujo de creación de citas manuales desde el botón **'+' → 'Cita'** con un proceso por pasos (Stepper) limpio y funcional.

---

## 📐 Estructura del Nuevo Flujo

### **Paso 1: Identificación del Cliente**

**Componente:** `ManualAppointmentClientStep.tsx`

**Funcionalidad:**
- **Opción A:** Buscador/Lista desplegable para seleccionar Cliente Existente
  - Muestra lista de clientes con nombre y teléfono
  - Al seleccionar, auto-completa nombre y teléfono
  - Permite búsqueda por nombre o teléfono
  
- **Opción B:** Campos manuales (si no se selecciona cliente)
  - Campo: **Nombre** (requerido)
  - Campo: **Número de Teléfono** (opcional)
  - Placeholder: "Nombre del cliente" / "Número de teléfono (opcional)"

**Validación:**
- Si se selecciona cliente existente: ✅ Validado
- Si no se selecciona: Nombre es obligatorio, teléfono opcional

**Estado:**
```typescript
{
  selectedClientId: string | null,
  manualName: string,
  manualPhone: string
}
```

---

### **Paso 2: Fecha y Hora**

**Componente:** `ManualAppointmentDateTimeStep.tsx`

**Funcionalidad:**
- **Selector de Fecha:** Calendario (usar componente Calendar existente)
  - Permite seleccionar cualquier fecha futura
  - Muestra fecha seleccionada claramente
  
- **Selector de Hora:** TimePicker (usar componente TimePicker existente)
  - Muestra horarios disponibles en formato 12h (ej: 8:00am, 2:30pm)
  - Puede filtrar por disponibilidad del staff (si ya se seleccionó en paso anterior, opcional)

**Layout:**
- Fecha arriba, Hora abajo (en la misma pantalla)
- Ambos selectores visibles simultáneamente

**Validación:**
- Fecha: Obligatoria
- Hora: Obligatoria

**Estado:**
```typescript
{
  selectedDate: Date | null,
  selectedTime: string // formato "HH:MM:SS" o "HH:MM"
}
```

---

### **Paso 3: Servicios y Staff**

**Componente:** `ManualAppointmentServicesStep.tsx`

**Funcionalidad:**
- **Selección de Servicios:** Múltiple
  - Lista de checkboxes o cards seleccionables
  - Muestra: Nombre, Duración, Precio
  - Permite seleccionar varios servicios
  - Calcula duración total automáticamente
  
- **Selección de Staff:** Único
  - Lista desplegable o cards
  - Muestra: Nombre del staff
  - Obligatorio

**Layout:**
- Sección "Servicios" arriba
- Sección "Staff" abajo
- Ambas en la misma pantalla

**Validación:**
- Al menos 1 servicio seleccionado
- Staff obligatorio

**Estado:**
```typescript
{
  selectedServices: string[], // Array de service_ids
  selectedStaff: string | null // staff_id
}
```

---

### **Paso 4: Confirmación y Finalización**

**Componente:** `ManualAppointmentConfirmationStep.tsx`

**Funcionalidad:**
- **Resumen de Datos:**
  - Cliente: Nombre y teléfono (si aplica)
  - Fecha y Hora: Formato legible
  - Servicios: Lista de servicios seleccionados con duración y precio
  - Staff: Nombre del staff
  - Duración Total: Suma de duraciones
  - Precio Total: Suma de precios

- **Botón Confirmar:**
  - Al hacer click:
    1. Muestra animación de éxito ("Cita Confirmada" con checkmark)
    2. Crea la cita en Supabase
    3. Cierra el modal
    4. Actualiza el Calendar View en tiempo real

**Animación de Éxito:**
- Usar componente de animación (ej: Lottie, CSS animation)
- Mostrar por 1-2 segundos
- Mensaje: "¡Cita confirmada!" / "Appointment confirmed!"

**Estado:**
```typescript
{
  isConfirming: boolean,
  showSuccessAnimation: boolean
}
```

---

## 🔧 Componente Principal

**Archivo:** `src/pages/mobile/ManualAppointmentFlow.tsx`

**Estructura:**
```typescript
export default function ManualAppointmentFlow() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ManualAppointmentFormData>({
    // Paso 1
    selectedClientId: null,
    manualName: "",
    manualPhone: "",
    
    // Paso 2
    selectedDate: null,
    selectedTime: "",
    
    // Paso 3
    selectedServices: [],
    selectedStaff: null,
    
    // Paso 4
    notes: ""
  });

  // Navegación entre pasos
  const handleNext = () => { /* validar y avanzar */ };
  const handleBack = () => { /* retroceder */ };
  const handleConfirm = async () => { /* crear cita */ };

  return (
    <Sheet>
      <Stepper currentStep={step} totalSteps={4} />
      {step === 1 && <ManualAppointmentClientStep />}
      {step === 2 && <ManualAppointmentDateTimeStep />}
      {step === 3 && <ManualAppointmentServicesStep />}
      {step === 4 && <ManualAppointmentConfirmationStep />}
      <NavigationButtons />
    </Sheet>
  );
}
```

---

## 💾 Lógica de Creación de Cita

**Archivo:** `src/lib/manualAppointmentService.ts`

**Función:** `createManualAppointment(formData)`

**Lógica:**
```typescript
async function createManualAppointment(formData: ManualAppointmentFormData) {
  // 1. Calcular end_time basado en servicios seleccionados
  const totalDuration = calculateTotalDuration(formData.selectedServices);
  const endTime = calculateEndTime(formData.selectedTime, totalDuration);
  
  // 2. Preparar datos de inserción
  const appointmentData: any = {
    business_id: profile.business_id,
    appointment_date: format(formData.selectedDate, "yyyy-MM-dd"),
    start_time: convertTo24Hour(formData.selectedTime),
    end_time: endTime,
    staff_id: formData.selectedStaff,
    status: "confirmed",
    notes: formData.notes || null,
    
    // ✅ CRÍTICO: Cita manual - NO client_id, NO user_id
    client_id: null, // NULL para citas manuales
    user_id: null,   // NULL para citas manuales
    
    // ✅ Datos manuales del cliente
    client_name: formData.selectedClientId 
      ? selectedClient.full_name 
      : formData.manualName,
    client_phone: formData.selectedClientId 
      ? selectedClient.phone 
      : formData.manualPhone || null,
    client_email: formData.selectedClientId 
      ? selectedClient.email 
      : null,
  };
  
  // 3. Manejar múltiples servicios
  const firstService = services.find(s => s.id === formData.selectedServices[0]);
  const otherServices = formData.selectedServices.slice(1);
  
  // Calcular duración y precio total
  const totalDuration = formData.selectedServices.reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return sum + (service?.duration_minutes || 0);
  }, 0);
  
  const totalPrice = formData.selectedServices.reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return sum + (service?.price || 0);
  }, 0);
  
  appointmentData.service_id = firstService.id;
  appointmentData.payment_amount = totalPrice;
  // end_time ya calculado con totalDuration arriba
  
  // 4. Insertar cita principal en Supabase
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(appointmentData)
    .select()
    .single();
  
  if (error) throw error;
  
  // 5. Si hay servicios adicionales, agregarlos a appointment_services
  if (otherServices.length > 0 && appointment) {
    const appointmentServicesData = otherServices.map(serviceId => {
      const service = services.find(s => s.id === serviceId);
      return {
        appointment_id: appointment.id,
        service_id: serviceId,
        price: service?.price || 0,
        staff_id: formData.selectedStaff,
        duration_minutes: service?.duration_minutes || 30,
        quantity: 1,
      };
    });
    
    const { error: servicesError } = await supabase
      .from("appointment_services")
      .insert(appointmentServicesData);
    
    if (servicesError) {
      console.error("Error adding additional services:", servicesError);
      // No fallar la creación de la cita si falla agregar servicios adicionales
    }
  }
  
  return appointment;
}
```

**Nota sobre Múltiples Servicios:**
- ✅ La tabla `appointments` tiene `service_id` (singular)
- ✅ Existe tabla `appointment_services` para relación muchos-a-muchos
- **Estrategia:** 
  - Crear una cita con el primer servicio seleccionado
  - Agregar los servicios adicionales a la tabla `appointment_services`
  - Calcular `end_time` basado en la suma de duraciones de todos los servicios
  - Calcular `payment_amount` como suma de precios de todos los servicios

---

## 🔗 Integración con AddActionSheet

**Modificar:** `src/components/mobile/AddActionSheet.tsx`

**Cambio:**
```typescript
// ANTES:
{ icon: Calendar, label: "Cita", path: "/admin/appointments/new" }

// DESPUÉS:
{ 
  icon: Calendar, 
  label: "Cita", 
  onClick: () => {
    setManualAppointmentOpen(true);
    onOpenChange(false);
  }
}
```

**Agregar estado en MobileLayout o componente padre:**
```typescript
const [manualAppointmentOpen, setManualAppointmentOpen] = useState(false);
```

---

## ⚠️ Reglas de Negocio Críticas

### 1. **Citas Sin Usuario**
- ✅ `client_id` = `NULL`
- ✅ `user_id` = `NULL` (si existe el campo)
- ✅ `client_name` = Nombre ingresado o del cliente seleccionado
- ✅ `client_phone` = Teléfono ingresado o del cliente seleccionado
- ✅ El sistema NO debe dar error por campos NULL

### 2. **Silencio de Notificaciones**
- ✅ Como `client_id` es NULL, los triggers de notificaciones ya validan esto
- ✅ Los triggers existentes tienen: `IF NEW.client_id IS NULL THEN RETURN;`
- ✅ NO modificar el sistema de notificaciones
- ✅ Las citas manuales simplemente no dispararán notificaciones por falta de `client_id`

### 3. **Actualización en Tiempo Real**
- ✅ Usar Supabase Realtime para escuchar INSERT en `appointments`
- ✅ El hook `useRealtimeAppointments` ya existe y se puede usar
- ✅ O hacer refresh manual después de crear la cita

---

## 📁 Estructura de Archivos

```
src/
├── pages/mobile/
│   └── ManualAppointmentFlow.tsx          # Componente principal
├── components/mobile/manual-appointment/
│   ├── ManualAppointmentClientStep.tsx     # Paso 1
│   ├── ManualAppointmentDateTimeStep.tsx   # Paso 2
│   ├── ManualAppointmentServicesStep.tsx   # Paso 3
│   ├── ManualAppointmentConfirmationStep.tsx # Paso 4
│   ├── ManualAppointmentStepper.tsx        # Indicador de progreso
│   └── ManualAppointmentSuccessAnimation.tsx # Animación de éxito
└── lib/
    └── manualAppointmentService.ts         # Lógica de creación
```

---

## 🎨 Componente Stepper (Indicador de Progreso)

**Archivo:** `src/components/mobile/manual-appointment/ManualAppointmentStepper.tsx`

**Diseño:**
```
[●] ─── [○] ─── [○] ─── [○]
Paso 1   Paso 2  Paso 3  Paso 4
Cliente  Fecha   Serv.   Confirmar
```

**Estados:**
- Completado: Círculo lleno con checkmark
- Actual: Círculo con borde destacado
- Pendiente: Círculo vacío

---

## ✅ Validaciones por Paso

### Paso 1: Cliente
- ✅ Cliente seleccionado O nombre manual ingresado

### Paso 2: Fecha y Hora
- ✅ Fecha seleccionada
- ✅ Hora seleccionada
- ✅ Fecha no puede ser en el pasado (opcional)

### Paso 3: Servicios y Staff
- ✅ Al menos 1 servicio seleccionado
- ✅ Staff seleccionado

### Paso 4: Confirmación
- ✅ Todos los datos validados
- ✅ Mostrar resumen completo

---

## 🔄 Flujo de Navegación

```
[+] → [Cita] → [Paso 1: Cliente] → [Siguiente]
                                    ↓
                    [Paso 2: Fecha/Hora] → [Siguiente]
                                            ↓
                        [Paso 3: Servicios/Staff] → [Siguiente]
                                                      ↓
                            [Paso 4: Confirmación] → [Confirmar]
                                                      ↓
                                    [Animación Éxito] → [Cerrar]
                                                      ↓
                                    [Calendar View Actualizado]
```

---

## 🚫 NO Modificar

- ❌ Sistema de notificaciones (Edge Functions, triggers)
- ❌ Lógica de User IDs
- ❌ Filtros existentes
- ❌ AppointmentDialog (seguirá funcionando desde el calendario)

---

## 📝 Próximos Pasos

1. ✅ Revisar este diseño
2. ⏳ Verificar estructura de BD para múltiples servicios por cita
3. ⏳ Implementar componentes paso a paso
4. ⏳ Integrar con AddActionSheet
5. ⏳ Probar flujo completo
6. ⏳ Verificar que no se envían notificaciones para citas manuales

---

**Fecha de Diseño:** 2026-02-19  
**Estado:** ⏳ Pendiente de Aprobación

