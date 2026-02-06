# 🔒 AUDITORÍA COMPLETA: PUSH NOTIFICATIONS - CLIENTE Y PARTNER

**Fecha:** 2026-02-03  
**Objetivo:** Analizar logs y código para identificar problemas de duplicados, tokens inválidos, secretos y filtrado

---

## 📊 ANÁLISIS DE LOGS

### Logs Analizados:
- **Función:** `send-push-notification`
- **Errores detectados:** "Requested entity was not found" / "messaging/registration-token-not-registered"
- **Problema de secretos:** Fallback a `FIREBASE_SERVICE_ACCOUNT_CLIENT` cuando busca `FIREBASE_SERVICE_ACCOUNT_CLIENTE`

---

## 1. 🔄 DUPLICADOS

### ✅ Problema Identificado:

**Usuarios con múltiples dispositivos activos:**

1. **Cliente:**
   - `ef2e21d7-999f-4301-8b05-00b9605f36c0`: **4 dispositivos** (todos Android)
   - Todos tienen `fcm_token` único
   - Todos están `enabled = true` e `is_active = true`

2. **Partners:**
   - `3a3e0599-296c-4cb2-8658-e3a095de75d1`: **3 dispositivos** (todos Android)
   - `c264fea1-45c1-4b15-8660-99564cfe6af6`: **3 dispositivos** (todos Android)
   - `be9bf819-27dc-4104-b104-3bf52eb1db2f`: **2 dispositivos** (todos Android)

### ⚠️ Comportamiento Actual:

**La función `send-push-notification` envía a TODOS los dispositivos activos del usuario:**

```typescript
// Línea 426-474: Envía a TODOS los dispositivos encontrados
const results = await Promise.allSettled(
  devices.map(async (device: Device) => {
    // Envía notificación a cada dispositivo
  })
);
```

**Resultado:** Si un usuario tiene 4 dispositivos, recibe 4 notificaciones idénticas.

### 📱 Tokens por Usuario y Aplicación:

**Cliente (`ef2e21d7-999f-4301-8b05-00b9605f36c0`):**
- 4 dispositivos Android
- 4 tokens FCM únicos
- Todos activos

**Partners:**
- Múltiples usuarios con 2-3 dispositivos Android cada uno
- Todos activos

---

## 2. ❌ TOKENS INVÁLIDOS

### 🔴 Errores Detectados en Logs:

```
Error enviando notificación a dispositivo 9c1a71bb-b7d7-4132-8c9f-e0a1b702a2fc: 
Requested entity was not found. messaging/registration-token-not-registered
```

**Causa:** El token FCM ya no es válido (dispositivo desinstaló la app, token expirado, etc.)

### 📊 Clasificación por Proyecto:

**Cliente:**
- Errores detectados en dispositivos con `role='client'`
- Tokens que ya no están registrados en Firebase

**Partner:**
- Errores detectados en dispositivos con `role='partner'`
- Tokens que ya no están registrados en Firebase

### ⚠️ Problema Actual:

**La función NO elimina ni desactiva tokens inválidos automáticamente:**

```typescript
// Línea 465-472: Solo loggea el error, no limpia el token
catch (err: any) {
  console.error(`❌ Error enviando notificación a dispositivo ${deviceId}:`, err.message, err.code);
  // ❌ NO desactiva el dispositivo
  // ❌ NO elimina el token
}
```

**Resultado:** Los tokens inválidos siguen intentándose enviar en cada notificación.

---

## 3. 🔐 SECRETOS DE FIREBASE

### 🚨 PROBLEMA CRÍTICO: FALLBACK DE SECRETOS

**Código actual (líneas 326-342):**

```typescript
if (!serviceAccountJson) {
  // ✅ INTENTAR ALTERNATIVAS: Verificar si el secret tiene otro nombre
  const alternativeNames = [
    'FIREBASE_SERVICE_ACCOUNT_CLIENT',
    'FIREBASE_CLIENT_SERVICE_ACCOUNT',
    'FIREBASE_SERVICE_ACCOUNT_CLIENTE',
  ];
  
  for (const altName of alternativeNames) {
    const altSecret = Deno.env.get(altName);
    if (altSecret) {
      console.log(`✅ [SECRET] Encontrado con nombre alternativo: ${altName}`);
      serviceAccountJson = altSecret;
      break;
    }
  }
}
```

### ❌ VIOLACIÓN DE REGLA DE ORO:

**Esto viola la regla de "NO FALLBACKS" establecida.**

**Logs muestran:**
```
[SECRET] Buscando secret: FIREBASE_SERVICE_ACCOUNT_CLIENTE
[SECRET] Secret existe: NO
[SECRET] Encontrado con nombre alternativo: FIREBASE_SERVICE_ACCOUNT_CLIENT
```

### ✅ Verificación de Secretos:

**Secretos esperados:**
- `FIREBASE_SERVICE_ACCOUNT_CLIENTE` (para app Cliente)
- `FIREBASE_SERVICE_ACCOUNT_PARTNER` (para app Partner)

**Secretos encontrados en logs:**
- `FIREBASE_SERVICE_ACCOUNT_CLIENT` (usado como fallback)

**Problema:** Hay discrepancia entre el nombre esperado (`FIREBASE_SERVICE_ACCOUNT_CLIENTE`) y el existente (`FIREBASE_SERVICE_ACCOUNT_CLIENT`).

---

## 4. 📱 FILTRADO POR APP/VERSIÓN

### ❌ Problema: NO HAY FILTRADO POR VERSIÓN

**Código actual NO filtra por versión de app:**

```typescript
// Línea 246: Solo filtra por user_id, is_active y role
const devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${normalizedUserId}&is_active=eq.true${roleFilter}&select=id,user_id,fcm_token,role,platform`;
```

**No se consulta:**
- `device_info->>'app_version'`
- Versión mínima requerida
- Filtrado de apps antiguas

### ⚠️ Consecuencias:

1. **Apps antiguas reciben notificaciones:**
   - Dispositivos con versiones obsoletas siguen recibiendo notificaciones
   - Pueden causar errores o comportamientos inesperados

2. **No hay control de compatibilidad:**
   - No se valida si la versión de la app soporta el tipo de notificación
   - No se evita enviar a apps que no pueden procesar la notificación

---

## 5. 💡 RECOMENDACIONES

### 🔴 1. Eliminar Fallback de Secretos (CRÍTICO)

**Problema:** El código busca secretos alternativos, violando la regla de "no fallbacks".

**Solución:**

```typescript
// ❌ ELIMINAR: Lógica de fallback (líneas 326-342)
// ✅ REEMPLAZAR CON: Fail fast si el secret no existe

if (!serviceAccountJson) {
  console.error(`❌ Secret ${secretName} no está configurado`);
  return new Response(
    JSON.stringify({
      success: false,
      message: "Notification cancelled",
      error: `REGLA DE ORO: Secret ${secretName} es requerido. No se usan fallbacks.`,
      cancelled: true,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
```

**Acción requerida:**
1. Verificar que `FIREBASE_SERVICE_ACCOUNT_CLIENTE` existe en Supabase Secrets
2. Si no existe, crearlo con el valor correcto
3. Eliminar la lógica de fallback del código

---

### 🔴 2. Limpiar Tokens Inválidos Automáticamente

**Problema:** Tokens inválidos siguen intentándose enviar.

**Solución:**

```typescript
// Agregar después de línea 472
catch (err: any) {
  console.error(`❌ Error enviando notificación a dispositivo ${deviceId}:`, err.message, err.code);
  
  // ✅ LIMPIAR TOKEN SI ES INVÁLIDO
  if (err.code === 'messaging/registration-token-not-registered' || 
      err.code === 'messaging/invalid-registration-token' ||
      err.message.includes('Requested entity was not found')) {
    
    // Desactivar dispositivo en la BD
    try {
      await fetch(`${supabaseUrl}/rest/v1/client_devices?id=eq.${deviceId}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          enabled: false,
          is_active: false,
          fcm_token: null, // Limpiar token inválido
        }),
      });
      console.log(`✅ Token inválido limpiado para dispositivo ${deviceId}`);
    } catch (cleanupError) {
      console.error(`❌ Error limpiando token inválido: ${cleanupError.message}`);
    }
  }
  
  throw {
    deviceId,
    error: err.message,
    code: err.code,
  };
}
```

---

### 🟡 3. Limitar Dispositivos por Usuario (Opcional)

**Problema:** Usuarios con múltiples dispositivos reciben notificaciones duplicadas.

**Opciones:**

**Opción A: Enviar solo al dispositivo más reciente**
```typescript
// Ordenar por updated_at DESC y tomar solo el primero
devices = devices.sort((a, b) => 
  new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
).slice(0, 1);
```

**Opción B: Enviar a todos (comportamiento actual)**
- Mantener si es el comportamiento deseado
- Documentar que es intencional

**Opción C: Agrupar por plataforma y enviar a la más reciente de cada una**
```typescript
// Agrupar por platform y tomar el más reciente de cada grupo
const devicesByPlatform = devices.reduce((acc, device) => {
  const platform = device.platform || 'unknown';
  if (!acc[platform] || 
      new Date(device.updated_at || 0) > new Date(acc[platform].updated_at || 0)) {
    acc[platform] = device;
  }
  return acc;
}, {} as Record<string, Device>);
devices = Object.values(devicesByPlatform);
```

**Recomendación:** Opción A (solo dispositivo más reciente) para evitar duplicados.

---

### 🟡 4. Filtrar por Versión de App

**Problema:** Apps antiguas reciben notificaciones.

**Solución:**

```typescript
// Agregar después de línea 257
// ✅ FILTRAR POR VERSIÓN MÍNIMA DE APP
const MIN_APP_VERSION = {
  client: '1.0.0', // Versión mínima para Cliente
  partner: '1.0.0', // Versión mínima para Partner
};

const minVersion = MIN_APP_VERSION[finalRole] || '1.0.0';

devices = devices.filter((device: Device) => {
  const appVersion = device.device_info?.app_version;
  if (!appVersion) {
    // Si no tiene versión, permitir (compatibilidad hacia atrás)
    return true;
  }
  
  // Comparar versiones (semver)
  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    return 0;
  };
  
  return compareVersions(appVersion, minVersion) >= 0;
});

console.log(`📱 [DEVICES] Dispositivos después de filtrar por versión: ${devices.length}`);
```

**Alternativa más simple (solo desactivar apps muy antiguas):**

```typescript
// Desactivar dispositivos que no se han actualizado en >90 días
const OLD_DEVICE_THRESHOLD = 90 * 24 * 60 * 60 * 1000; // 90 días en ms

devices = devices.filter((device: Device) => {
  const lastUpdate = new Date(device.updated_at || 0).getTime();
  const now = Date.now();
  const daysSinceUpdate = (now - lastUpdate) / (24 * 60 * 60 * 1000);
  
  if (daysSinceUpdate > 90) {
    console.warn(`⚠️ Dispositivo ${device.id} no actualizado en ${daysSinceUpdate.toFixed(0)} días, omitiendo`);
    return false;
  }
  return true;
});
```

---

### 🟡 5. Mejorar Logging y Monitoreo

**Agregar métricas:**

```typescript
// Al inicio de la función
const metrics = {
  totalDevices: 0,
  validDevices: 0,
  invalidTokens: 0,
  sent: 0,
  failed: 0,
  duplicates: 0,
};

// Al final, loggear métricas
console.log(`📊 [METRICS]`, JSON.stringify(metrics));
```

---

## 📋 RESUMEN DE ACCIONES REQUERIDAS

### 🔴 CRÍTICO (Hacer inmediatamente):

1. **Eliminar fallback de secretos**
   - Verificar que `FIREBASE_SERVICE_ACCOUNT_CLIENTE` existe
   - Eliminar lógica de fallback (líneas 326-342)
   - Fail fast si el secret no existe

2. **Limpiar tokens inválidos automáticamente**
   - Desactivar dispositivos con tokens inválidos
   - Limpiar `fcm_token` cuando sea inválido

### 🟡 IMPORTANTE (Hacer pronto):

3. **Decidir política de duplicados**
   - Opción A: Solo dispositivo más reciente
   - Opción B: Todos los dispositivos (actual)
   - Opción C: Uno por plataforma

4. **Filtrar por versión de app**
   - Implementar filtrado de apps antiguas
   - Definir versión mínima requerida

### 🟢 MEJORAS (Opcional):

5. **Mejorar logging y métricas**
   - Agregar métricas detalladas
   - Monitorear tokens inválidos

---

## ✅ VERIFICACIÓN POST-IMPLEMENTACIÓN

### Verificar que NO hay fallback de secretos:
```typescript
// Buscar en código: "alternativeNames" o "nombre alternativo"
// Debe retornar 0 resultados
```

### Verificar limpieza de tokens:
```sql
-- Verificar dispositivos desactivados recientemente
SELECT COUNT(*) 
FROM client_devices 
WHERE enabled = false 
  AND updated_at > NOW() - INTERVAL '1 day';
```

### Verificar duplicados:
```sql
-- Verificar usuarios con múltiples dispositivos activos
SELECT user_id, role, COUNT(*) 
FROM client_devices 
WHERE enabled = true AND is_active = true 
GROUP BY user_id, role 
HAVING COUNT(*) > 1;
```

---

## 🎯 CONCLUSIÓN

**Problemas identificados:**
1. ✅ Duplicados: Usuarios con múltiples dispositivos reciben notificaciones múltiples
2. ✅ Tokens inválidos: No se limpian automáticamente
3. ✅ Secretos: Fallback viola regla de "no fallbacks"
4. ✅ Filtrado: No hay filtrado por versión de app

**Prioridad de corrección:**
1. 🔴 Eliminar fallback de secretos (CRÍTICO)
2. 🔴 Limpiar tokens inválidos (CRÍTICO)
3. 🟡 Decidir política de duplicados (IMPORTANTE)
4. 🟡 Filtrar por versión (IMPORTANTE)

