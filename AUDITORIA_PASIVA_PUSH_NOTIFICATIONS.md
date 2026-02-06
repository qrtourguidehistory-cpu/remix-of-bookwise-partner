# 🔍 AUDITORÍA PASIVA – SISTEMA DE PUSH NOTIFICATIONS

**Fecha:** 2026-02-03  
**Tipo:** Auditoría Pasiva (Sin Modificaciones)  
**Objetivo:** Diagnosticar el estado actual del sistema de push notifications

---

## 📋 RESUMEN EJECUTIVO

### ✅ Estado General
El sistema de push notifications está **funcional pero con múltiples puntos de entrada y redundancias** que pueden causar duplicados o comportamientos inesperados.

### ⚠️ Problemas Críticos Identificados
1. **Múltiples triggers duplicados** en `appointments` que pueden disparar notificaciones múltiples
2. **Edge Functions obsoletas** (`notify-partner`, `notify-client`) que usan FCM Legacy API
3. **Función SQL obsoleta** (`send_push_on_notification`) que referencia Edge Function inexistente
4. **Registro FCM múltiple** en frontend (3 lugares diferentes)
5. **Listeners duplicados** potenciales en `partnerPushService.ts`

---

## 1️⃣ EDGE FUNCTIONS

### ✅ Edge Functions Existentes (25 totales)

#### 🔔 **Relacionadas con Notificaciones Push:**

1. **`send-push-notification`** ✅ **ACTIVA Y CORRECTA**
   - **Ubicación:** `supabase/functions/send-push-notification/index.ts`
   - **Propósito:** Edge Function centralizada para enviar push notifications
   - **Tecnología:** Firebase Admin SDK (moderno)
   - **Proyectos Firebase:** Soporta 2 proyectos (partner y client)
   - **Secrets:** `FIREBASE_PARTNER_JSON`, `FIREBASE_CLIENT_JSON`
   - **Validaciones:** ✅ UUID validation, fail-fast, limpieza de tokens inválidos
   - **Estado:** ✅ FUNCIONAL Y ACTUALIZADA

2. **`notify-partner`** ⚠️ **OBSOLETA**
   - **Ubicación:** `supabase/functions/notify-partner/index.ts`
   - **Propósito:** Crear notificación para partner
   - **Problema:** Usa FCM Legacy API (`FCM_SERVER_KEY`, `https://fcm.googleapis.com/fcm/send`)
   - **Tabla:** Inserta en `notifications` (no `client_devices`)
   - **Token:** Busca `push_token` en `profiles` (columna inexistente)
   - **Estado:** ❌ OBSOLETA - No debería usarse

3. **`notify-client`** ⚠️ **OBSOLETA**
   - **Ubicación:** `supabase/functions/notify-client/index.ts`
   - **Propósito:** Crear notificación para cliente
   - **Problema:** Usa FCM Legacy API (`FCM_SERVER_KEY`, `https://fcm.googleapis.com/fcm/send`)
   - **Tabla:** Inserta en `client_notifications` (correcto)
   - **Token:** Busca `push_token` en `profiles` (columna inexistente)
   - **Estado:** ❌ OBSOLETA - No debería usarse

4. **`notify-next-client`** ✅ **FUNCIONAL (SMS)**
   - **Ubicación:** `supabase/functions/notify-next-client/index.ts`
   - **Propósito:** Notificar al siguiente cliente en cola
   - **Tecnología:** SMS (no push)
   - **Validaciones:** ✅ Valida user_id UUID, verifica dispositivos activos
   - **Estado:** ✅ FUNCIONAL

5. **`process-notifications`** ✅ **FUNCIONAL (Scheduled)**
   - **Ubicación:** `supabase/functions/process-notifications/index.ts`
   - **Propósito:** Procesar notificaciones programadas
   - **Tecnología:** No usa push directamente
   - **Estado:** ✅ FUNCIONAL

#### 📊 **Otras Edge Functions (No relacionadas con Push):**
- `broadcast-availability`, `confirm-paypal-subscription`, `create-paypal-checkout`, `create-paypal-subscription`, `create-portal-link`, `create-stripe-checkout`, `invite-client-early`, `paypal-cancel`, `paypal-return`, `paypal-webhook`, `process-paypal-return`, `scheduled-cleanup`, `send-early-arrival-request`, `send-sms-reminder`, `stripe-return`, `stripe-webhook`, `sync-business-visibility`, `sync-paypal-subscription`, `verify-stripe-session`

### 🔗 **Referencias a `send-push-notification`:**

✅ **Referencias Correctas:**
- `supabase/functions/send-push-notification/index.ts` (definición)
- `supabase/migrations/20260203000001_fix_critical_push_notifications.sql` (líneas 66, 135) - Triggers SQL que llaman correctamente

❌ **Referencias Obsoletas:**
- `supabase/migrations/20260203000001_fix_critical_push_notifications.sql` (línea 132) - Comentario sobre `call_send_push_notification` (función no existe)

---

## 2️⃣ FIREBASE / FCM

### ✅ **Inicialización Firebase**

**Edge Function `send-push-notification`:**
- ✅ Usa Firebase Admin SDK v11.0.0 (moderno)
- ✅ Inicialización por rol con nombres únicos (`app-partner`, `app-client`)
- ✅ Manejo de apps duplicadas (recupera app existente)
- ✅ Secrets separados por rol (`FIREBASE_PARTNER_JSON`, `FIREBASE_CLIENT_JSON`)

**Helpers Compartidos:**
- ✅ `getFirebaseApp(roleKey, serviceAccount)` - Helper para inicializar/recuperar apps
- ✅ `detectRole(requestBody, record)` - Helper para detectar rol del usuario
- ✅ `sanitizeData(data)` - Helper para sanitizar data antes de enviar a FCM

### ✅ **Envío de Notificaciones**

**Método:** Individual (no batch)
- ✅ Envía a cada dispositivo con `Promise.allSettled()`
- ✅ Maneja errores por dispositivo individualmente
- ✅ Limpia tokens inválidos automáticamente

**Manejo de Errores:**
- ✅ Detecta tokens inválidos: `messaging/registration-token-not-registered`, `messaging/invalid-registration-token`
- ✅ Limpia tokens inválidos: Desactiva dispositivo y limpia `fcm_token`
- ✅ Logs detallados para debugging

### ⚠️ **Edge Functions Obsoletas (FCM Legacy)**

**`notify-partner` y `notify-client`:**
- ❌ Usan FCM Legacy API (`https://fcm.googleapis.com/fcm/send`)
- ❌ Requieren `FCM_SERVER_KEY` (no existe en secrets)
- ❌ Buscan `push_token` en `profiles` (columna no existe)
- ❌ No usan `client_devices` (tabla correcta)

**Estado:** ❌ NO FUNCIONALES - No deberían usarse

---

## 3️⃣ BASE DE DATOS – DISPOSITIVOS

### ✅ **Tabla `client_devices`**

**Estructura:**
```sql
- id: uuid (PK, gen_random_uuid())
- user_id: uuid (NOT NULL, FK a auth.users)
- fcm_token: text (NOT NULL)
- platform: text (NOT NULL) -- 'android' | 'ios' | 'web'
- device_info: jsonb (default '{}')
- created_at: timestamptz (default now())
- updated_at: timestamptz (default now())
- role: text (NOT NULL, default 'client') -- 'partner' | 'client'
- enabled: boolean (NOT NULL, default true)
- is_active: boolean (NOT NULL, default true)
```

**Constraints:**
- ✅ `client_devices_pkey` (PRIMARY KEY en `id`)
- ✅ `client_devices_user_id_fkey` (FOREIGN KEY a `auth.users`)
- ✅ `client_devices_user_id_fcm_token_key` (UNIQUE en `user_id, fcm_token`) ⚠️ **PROBLEMA POTENCIAL**

**⚠️ PROBLEMA CRÍTICO: Constraint UNIQUE Incorrecto**

El constraint `client_devices_user_id_fcm_token_key` es **UNIQUE en (user_id, fcm_token)**, lo que significa:
- ❌ Un usuario puede tener el mismo token en múltiples dispositivos (si cambia de dispositivo)
- ❌ Un token puede estar asociado a múltiples usuarios (si se reutiliza)

**✅ Debería ser:**
- `UNIQUE (fcm_token)` - 1 token = 1 dispositivo (independiente del usuario)
- Permitir múltiples dispositivos por usuario (sin constraint en user_id)

**Índices:**
- ✅ `client_devices_pkey` (PRIMARY KEY)
- ✅ `client_devices_user_id_fcm_token_key` (UNIQUE)
- ✅ `idx_client_devices_is_active` (WHERE is_active = true)
- ✅ `idx_client_devices_role`
- ✅ `idx_client_devices_user_id`
- ✅ `idx_client_devices_user_role_active` (WHERE is_active = true)
- ✅ `idx_client_devices_user_role_enabled` (WHERE enabled = true)

**Eliminación/Desactivación de Tokens:**
- ✅ **Frontend:** `partnerPushService.ts` elimina tokens duplicados antes de registrar
- ✅ **Edge Function:** `send-push-notification` limpia tokens inválidos automáticamente
- ✅ **Frontend:** `AuthContext.tsx` marca dispositivos como `is_active = false` al hacer logout
- ✅ **Trigger SQL:** `update_client_devices_updated_at` actualiza `updated_at` automáticamente

---

## 4️⃣ SQL TRIGGERS

### ✅ **Triggers Activos en `appointments`:**

1. **`trigger_handle_appointment_confirmation`** ✅ **ACTIVO Y CORRECTO**
   - **Evento:** `UPDATE` → `status = 'confirmed'`
   - **Función:** `handle_appointment_confirmation()`
   - **Acción:** Inserta en `client_notifications` (NO llama Edge Function directamente)
   - **Validaciones:** ✅ UUID validation, fail-fast, verifica dispositivos activos
   - **Estado:** ✅ FUNCIONAL

2. **`trigger_handle_appointment_completion`** ✅ **ACTIVO Y CORRECTO**
   - **Evento:** `UPDATE` → `status = 'completed'`
   - **Función:** `handle_appointment_completion()`
   - **Acción:** Inserta en `client_notifications` (NO llama Edge Function directamente)
   - **Validaciones:** ✅ UUID validation, fail-fast, verifica dispositivos activos
   - **Estado:** ✅ FUNCIONAL

3. **`on_appointment_created`** ⚠️ **DUPLICADO**
   - **Evento:** `INSERT`
   - **Función:** `notify_partner_safe()`
   - **Acción:** Llama `send-push-notification` directamente vía `net.http_post`
   - **Estado:** ⚠️ ACTIVO - Puede causar duplicados con otros triggers

4. **`tr_push_new_appointment`** ⚠️ **DUPLICADO**
   - **Evento:** `INSERT`
   - **Función:** `fn_notify_partner_v13()`
   - **Acción:** Llama `send-push-notification` directamente vía `net.http_post`
   - **Estado:** ⚠️ ACTIVO - Puede causar duplicados con otros triggers

5. **`trigger_notify_new_appointment`** ⚠️ **DUPLICADO**
   - **Evento:** `INSERT`
   - **Función:** `notify_partner_new_appointment()`
   - **Acción:** Inserta en `notifications` (NO envía push directamente)
   - **Estado:** ⚠️ ACTIVO - Puede causar duplicados con otros triggers

6. **`trigger_notify_next_client_on_started`** ✅ **FUNCIONAL**
   - **Evento:** `UPDATE` → `status = 'started'`
   - **Función:** `notify_next_client_on_started()`
   - **Acción:** Llama `notify-next-client` Edge Function
   - **Estado:** ✅ FUNCIONAL

**⚠️ PROBLEMA CRÍTICO: 3 Triggers Duplicados en INSERT**

Cuando se crea una nueva cita (`INSERT`), se disparan **3 triggers simultáneos**:
1. `on_appointment_created` → `notify_partner_safe()` → `send-push-notification`
2. `tr_push_new_appointment` → `fn_notify_partner_v13()` → `send-push-notification`
3. `trigger_notify_new_appointment` → `notify_partner_new_appointment()` → Inserta en `notifications`

**Resultado:** El partner puede recibir **2-3 notificaciones push** por cada nueva cita.

### ✅ **Triggers Activos en `client_notifications`:**

1. **`trigger_send_push_notification`** ⚠️ **OBSOLETO**
   - **Evento:** `INSERT`
   - **Función:** `send_push_on_notification()`
   - **Problema:** Llama a Edge Function `send_push_notification` (no existe, debería ser `send-push-notification`)
   - **Problema:** Usa extensión `extensions.http` (no `net.http_post`)
   - **Problema:** Tiene anon key hardcodeado
   - **Estado:** ❌ OBSOLETO - No debería usarse

2. **`trigger_send_push_on_client_notification`** ✅ **ACTIVO Y CORRECTO**
   - **Evento:** `INSERT`
   - **Función:** `send_push_on_client_notification()`
   - **Acción:** Llama `call_send_push_notification()` (función helper)
   - **Validaciones:** ✅ UUID validation, fail-fast
   - **Estado:** ✅ FUNCIONAL

**⚠️ PROBLEMA: Función `call_send_push_notification` No Existe**

La función `send_push_on_client_notification()` llama a `call_send_push_notification()`, pero esta función **no existe en la base de datos**. Esto causará errores cuando se inserte en `client_notifications`.

### ✅ **Funciones SQL Helper:**

1. **`get_client_user_id_from_appointment()`** ✅ **FUNCIONAL**
   - **Propósito:** Obtener `user_id` del cliente desde una cita
   - **Validaciones:** ✅ UUID validation, fail-fast, sin fallbacks
   - **Estado:** ✅ FUNCIONAL

2. **`has_active_devices()`** ✅ **FUNCIONAL**
   - **Propósito:** Verificar si un usuario tiene dispositivos activos
   - **Validaciones:** ✅ UUID validation, verifica `enabled`, `is_active`, `fcm_token`
   - **Estado:** ✅ FUNCIONAL

3. **`validate_user_id_for_notification()`** ✅ **FUNCIONAL**
   - **Propósito:** Validar user_id antes de insertar notificación
   - **Validaciones:** ✅ UUID validation, verifica dispositivos activos
   - **Estado:** ✅ FUNCIONAL

---

## 5️⃣ FRONTEND (PARTNER / CLIENTE)

### ✅ **Registro FCM Token**

**Archivo:** `src/services/partnerPushService.ts`

**Función:** `initializePartnerPush(userId: string)`

**Lugares donde se llama:**

1. **`src/contexts/AuthContext.tsx`** - Línea 208
   - **Contexto:** Inicialización inicial (`initializeAuth`)
   - **Frecuencia:** 1 vez al cargar la app (si hay sesión)

2. **`src/contexts/AuthContext.tsx`** - Línea 279
   - **Contexto:** `onAuthStateChange` (eventos `SIGNED_IN`, `TOKEN_REFRESHED`)
   - **Frecuencia:** Cada vez que cambia el estado de autenticación

3. **`src/contexts/AuthContext.tsx`** - Línea 331
   - **Contexto:** `signIn()` después de login exitoso
   - **Frecuencia:** Cada vez que se hace login manual

**⚠️ PROBLEMA: Múltiples Llamadas Potenciales**

El registro puede llamarse **múltiples veces**:
- Al cargar la app (si hay sesión)
- Al hacer login (`signIn`)
- Al cambiar estado de auth (`onAuthStateChange`)

**Protección Actual:**
- ✅ `partnerPushService.ts` tiene flag `listenerInitialized` para evitar listeners duplicados
- ✅ Elimina tokens duplicados antes de registrar (líneas 49-54)
- ✅ Usa `upsert` con `onConflict: 'fcm_token'` (líneas 57-73)

**⚠️ PROBLEMA: Listener de Click Duplicado**

El listener `pushNotificationActionPerformed` se registra **una sola vez** (protegido por `listenerInitialized`), pero si `initializePartnerPush` se llama múltiples veces, puede haber problemas de navegación duplicada.

### ✅ **Servicios de Notificaciones**

1. **`src/lib/partnerNotificationService.ts`** ✅ **FUNCIONAL**
   - **Propósito:** Crear notificaciones para partner/cliente
   - **Método:** Llama Edge Function `send-push-notification`
   - **Validaciones:** ✅ Valida tipos operativos, user_id requerido
   - **Estado:** ✅ FUNCIONAL

2. **`src/lib/notificationService.ts`** ⚠️ **OBSOLETO**
   - **Propósito:** Enviar notificaciones a clientes
   - **Problema:** No usa push notifications (solo inserta en `appointment_notifications`)
   - **Estado:** ⚠️ OBSOLETO - No debería usarse para push

### ✅ **Limpieza al Logout**

**Archivo:** `src/contexts/AuthContext.tsx` - Líneas 381-399

**Acción:** Marca todos los dispositivos del usuario como `is_active = false`

**Estado:** ✅ FUNCIONAL

---

## 📊 RESUMEN DE HALLAZGOS

### ✅ **Qué Existe y Funciona:**

1. ✅ Edge Function `send-push-notification` (moderna, funcional)
2. ✅ Tabla `client_devices` con estructura correcta
3. ✅ Triggers `trigger_handle_appointment_confirmation` y `trigger_handle_appointment_completion` (funcionales)
4. ✅ Función `send_push_on_client_notification()` (funcional)
5. ✅ Frontend `partnerPushService.ts` (funcional, con protecciones)
6. ✅ Limpieza automática de tokens inválidos
7. ✅ Validaciones UUID y fail-fast en múltiples capas

### ⚠️ **Qué Puede Causar Duplicados:**

1. ⚠️ **3 triggers duplicados** en `INSERT` de `appointments`:
   - `on_appointment_created` → `notify_partner_safe()`
   - `tr_push_new_appointment` → `fn_notify_partner_v13()`
   - `trigger_notify_new_appointment` → `notify_partner_new_appointment()`

2. ⚠️ **Múltiples llamadas a `initializePartnerPush`** en frontend:
   - Inicialización + `onAuthStateChange` + `signIn()`

3. ⚠️ **Constraint UNIQUE incorrecto** en `client_devices`:
   - `UNIQUE (user_id, fcm_token)` permite duplicados si el usuario cambia de dispositivo

### ❌ **Qué Está Obsoleto o Peligroso:**

1. ❌ **Edge Functions obsoletas:**
   - `notify-partner` (FCM Legacy API, busca `push_token` en `profiles`)
   - `notify-client` (FCM Legacy API, busca `push_token` en `profiles`)

2. ❌ **Función SQL obsoleta:**
   - `send_push_on_notification()` (llama Edge Function inexistente, usa extensión incorrecta)

3. ❌ **Función SQL faltante:**
   - `call_send_push_notification()` (llamada por `send_push_on_client_notification()` pero no existe)

4. ❌ **Servicio frontend obsoleto:**
   - `src/lib/notificationService.ts` (no usa push notifications)

### 🔗 **Qué Depende de Qué:**

```
appointments (INSERT)
  ├─ on_appointment_created → notify_partner_safe() → send-push-notification ✅
  ├─ tr_push_new_appointment → fn_notify_partner_v13() → send-push-notification ✅
  └─ trigger_notify_new_appointment → notify_partner_new_appointment() → notifications (tabla) ⚠️

appointments (UPDATE status='confirmed')
  └─ trigger_handle_appointment_confirmation → client_notifications (INSERT) ✅

appointments (UPDATE status='completed')
  └─ trigger_handle_appointment_completion → client_notifications (INSERT) ✅

client_notifications (INSERT)
  ├─ trigger_send_push_notification → send_push_on_notification() → send_push_notification (❌ NO EXISTE)
  └─ trigger_send_push_on_client_notification → send_push_on_client_notification() → call_send_push_notification() (❌ NO EXISTE)

Frontend
  ├─ AuthContext → initializePartnerPush() → partnerPushService.ts → client_devices (UPSERT) ✅
  └─ partnerNotificationService.ts → send-push-notification (Edge Function) ✅
```

---

## 📌 RECOMENDACIONES (Sin Implementar)

### 🔴 **CRÍTICO - Eliminar Duplicados:**

1. **Eliminar 2 de los 3 triggers duplicados en `appointments` (INSERT):**
   - Mantener solo `trigger_notify_new_appointment` (inserta en `notifications`)
   - Eliminar `on_appointment_created` y `tr_push_new_appointment`
   - **Razón:** Evitar notificaciones duplicadas al crear citas

2. **Eliminar función SQL obsoleta:**
   - Eliminar `send_push_on_notification()` y su trigger `trigger_send_push_notification`
   - **Razón:** Llama Edge Function inexistente, usa extensión incorrecta

3. **Crear función faltante o corregir referencia:**
   - Crear `call_send_push_notification()` o cambiar `send_push_on_client_notification()` para llamar directamente a Edge Function
   - **Razón:** Evitar errores al insertar en `client_notifications`

### 🟡 **IMPORTANTE - Limpiar Código Obsoleto:**

4. **Eliminar Edge Functions obsoletas:**
   - Eliminar `notify-partner` y `notify-client`
   - **Razón:** Usan FCM Legacy API, buscan columnas inexistentes

5. **Eliminar servicio frontend obsoleto:**
   - Eliminar o refactorizar `src/lib/notificationService.ts`
   - **Razón:** No usa push notifications

6. **Corregir constraint UNIQUE en `client_devices`:**
   - Cambiar de `UNIQUE (user_id, fcm_token)` a `UNIQUE (fcm_token)`
   - **Razón:** Garantizar que 1 token = 1 dispositivo (independiente del usuario)

### 🟢 **MEJORAS - Optimizar Frontend:**

7. **Optimizar llamadas a `initializePartnerPush`:**
   - Consolidar en un solo lugar (solo en `onAuthStateChange`)
   - **Razón:** Evitar múltiples inicializaciones

8. **Agregar debounce/throttle:**
   - Prevenir múltiples registros si `initializePartnerPush` se llama rápidamente
   - **Razón:** Evitar registros duplicados

---

## 🎯 CONCLUSIÓN

El sistema de push notifications está **funcional pero necesita limpieza**:

✅ **Fortalezas:**
- Edge Function moderna y bien implementada
- Validaciones robustas (UUID, fail-fast)
- Limpieza automática de tokens inválidos
- Estructura de base de datos correcta

⚠️ **Debilidades:**
- Múltiples triggers duplicados
- Funciones SQL obsoletas
- Edge Functions obsoletas
- Constraint UNIQUE incorrecto

❌ **Riesgos:**
- Notificaciones duplicadas al crear citas
- Errores al insertar en `client_notifications` (función faltante)
- Código obsoleto que puede causar confusión

**Prioridad de Acción:**
1. 🔴 Eliminar triggers duplicados
2. 🔴 Crear/corregir función `call_send_push_notification`
3. 🟡 Eliminar código obsoleto
4. 🟡 Corregir constraint UNIQUE
5. 🟢 Optimizar frontend

---

**✅ AUDITORÍA COMPLETA - LISTO PARA REFACTORIZACIÓN**

