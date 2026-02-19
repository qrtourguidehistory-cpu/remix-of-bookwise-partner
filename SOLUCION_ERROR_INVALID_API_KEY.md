# 🔧 Solución: Error "InvalidCredentialsError: Invalid API Key"

**Fecha:** 2026-02-18  
**Problema:** RevenueCat devuelve "InvalidCredentialsError: Invalid API Key" en logs de Android

---

## ✅ CORRECCIONES APLICADAS

### 1. API Key Corregida

**Archivo:** `src/main.tsx` línea 32

**Antes (INCORRECTO):**
```typescript
const apiKey = "goog_tikShxRoguFTFrhLWiWrSmssyzo";  // ❌ "L" mayúscula incorrecta
```

**Después (CORRECTO):**
```typescript
const apiKey = "goog_tikShxRoguFTFrhlWiWrSmssyzo";  // ✅ "l" minúscula correcta
```

**Diferencia:** `FTFrhL` → `FTFrhl` (corregido error de tipeo)

### 2. Validación de API Key Agregada

**Archivo:** `src/main.tsx`

- ✅ Verificación de espacios en blanco
- ✅ Verificación de longitud (debe ser 33 caracteres)
- ✅ Verificación de prefijo (debe empezar con `goog_`)
- ✅ Logging detallado para diagnóstico

### 3. Identificación de Usuario Mejorada

**Archivo:** `src/lib/revenueCatService.ts`

- ✅ Validación de UUID antes de `logIn()`
- ✅ Verificación de que el usuario NO sea anonymous después de `logIn()`
- ✅ Logging detallado para detectar problemas con IDs anónimos
- ✅ Prevención de `logIn()` duplicado si ya está identificado

---

## 🔍 VERIFICACIONES REALIZADAS

### ✅ Llamadas a `Purchases.configure()`

**Resultado:** Solo hay **UNA** llamada a `Purchases.configure()` en:
- `src/main.tsx` línea 44

**Estado:** ✅ CORRECTO (no hay doble inicialización)

### ✅ Llamadas a `Purchases.logIn()`

**Resultado:** Se llama a `Purchases.logIn()` en:
- `src/contexts/AuthContext.tsx` línea 220 (INITIAL_SESSION)
- `src/contexts/AuthContext.tsx` línea 291 (SIGNED_IN)
- `src/lib/revenueCatService.ts` línea 137 (función `identifyUser`)

**Estado:** ✅ CORRECTO (identificación completa)

---

## 🧹 LIMPIEZA DE CACHÉ CORRUPTA

### Opción 1: Limpiar Caché del Emulador/Dispositivo

**En Android Studio / Dispositivo:**

```bash
# 1. Desinstalar la app completamente
adb uninstall com.miturnow.partner

# 2. Limpiar datos de RevenueCat (si existen)
adb shell pm clear com.miturnow.partner

# 3. Limpiar caché de Android
adb shell pm clear com.android.vending  # Limpiar Play Store cache (opcional)
```

**O desde la app:**
1. Configuración → Apps → Mi Turnow Partner
2. Almacenamiento → Borrar datos
3. Almacenamiento → Borrar caché
4. Desinstalar la app
5. Reinstalar desde Android Studio

### Opción 2: Limpiar Build Cache

**En el proyecto:**

```bash
# Limpiar build de Android
cd android
./gradlew clean
cd ..

# Limpiar build de Capacitor
rm -rf android/app/build
rm -rf android/.gradle

# Limpiar build de Vite
rm -rf dist
rm -rf node_modules/.vite

# Reconstruir
npm run build
npx cap sync android
```

### Opción 3: Resetear RevenueCat Localmente

**Si el problema persiste, RevenueCat puede tener datos corruptos localmente:**

```bash
# En Android, RevenueCat guarda datos en SharedPreferences
# Para resetear completamente, desinstalar y reinstalar la app
adb uninstall com.miturnow.partner
```

**O agregar código temporal para resetear (solo para debugging):**

```typescript
// En src/main.tsx, después de configure (SOLO PARA DEBUGGING):
try {
  // Resetear RevenueCat si hay problemas
  await Purchases.logOut();
  console.log("[RevenueCat] ✅ Logout ejecutado (reset)");
} catch (resetError) {
  console.warn("[RevenueCat] ⚠️ Error en logout (puede ser normal):", resetError);
}
```

---

## 🔍 DIAGNÓSTICO: Verificar en Logs

### Logs Esperados (CORRECTO)

```
[RevenueCat] 🔑 CONFIGURACIÓN DE REVENUECAT
========================================
API KEY (trimmed): goog_tikShxRoguFTFrhlWiWrSmssyzo
API KEY LENGTH: 33
API KEY STARTS WITH 'goog_': true
========================================
[RevenueCat] ✅ Purchases.configure() ejecutado correctamente
[RevenueCat] App User ID (temporal/anonymous): $RCAnonymousID:xxxxx
[AuthContext] 🔐 Identificando usuario en RevenueCat (INITIAL_SESSION): [UUID]
[RevenueCat] App User ID ANTES de identificar: $RCAnonymousID:xxxxx
[RevenueCat] Ejecutando Purchases.logIn({ appUserID: userId })...
[RevenueCat] ✅ USUARIO IDENTIFICADO CORRECTAMENTE
[RevenueCat] Nuevo App User ID: [UUID de Supabase]
[RevenueCat] NO es anonymous ID: true
```

### Logs de Error (PROBLEMA)

```
[RevenueCat] ❌ ERROR CRÍTICO inicializando RevenueCat:
[RevenueCat] Error code: InvalidCredentialsError
[RevenueCat] Underlying error: Invalid API Key
```

**Si ves esto:**
1. Verificar que la API key en `src/main.tsx` sea exactamente `goog_tikShxRoguFTFrhlWiWrSmssyzo`
2. Verificar en RevenueCat Dashboard que la Public SDK Key coincida
3. Limpiar caché del dispositivo/emulador
4. Reconstruir la app

---

## 📋 CHECKLIST DE VERIFICACIÓN

### Pre-Deploy

- [x] ✅ API Key corregida: `goog_tikShxRoguFTFrhlWiWrSmssyzo` (sin espacios)
- [x] ✅ Validación de API Key agregada (longitud, prefijo, espacios)
- [x] ✅ Identificación de usuario mejorada (validación UUID, prevención de anonymous)
- [x] ✅ Logging detallado agregado

### Post-Deploy

- [ ] **Limpiar caché del dispositivo/emulador**
- [ ] **Reconstruir la app completamente**
- [ ] **Verificar logs de Android (Logcat)**
- [ ] **Confirmar que el App User ID NO sea `$RCAnonymousID`**
- [ ] **Probar compra de suscripción**

---

## 🚨 SI EL ERROR PERSISTE

### 1. Verificar RevenueCat Dashboard

1. Ir a [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Seleccionar tu proyecto
3. Ir a **Project Settings** → **API Keys**
4. Verificar que la **Public SDK Key** sea exactamente: `goog_tikShxRoguFTFrhlWiWrSmssyzo`
5. Si NO coincide, actualizar el código con la clave correcta del Dashboard

### 2. Verificar Google Play Service Account

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Verificar que el Service Account esté vinculado en Google Play Console
3. Verificar que la API Google Play Developer esté habilitada

### 3. Verificar Logs Detallados

**En Logcat de Android Studio, buscar:**
```
[RevenueCat] 🔑 CONFIGURACIÓN DE REVENUECAT
[RevenueCat] API KEY (trimmed): goog_tikShxRoguFTFrhlWiWrSmssyzo
[RevenueCat] ✅ Purchases.configure() ejecutado correctamente
[RevenueCat] 🔐 IDENTIFICACIÓN DE USUARIO
[RevenueCat] UUID de Supabase: [tu-uuid]
[RevenueCat] ✅ USUARIO IDENTIFICADO CORRECTAMENTE
[RevenueCat] Nuevo App User ID: [tu-uuid]
[RevenueCat] NO es anonymous ID: true
```

**Si ves `$RCAnonymousID` después de logIn:**
- El problema es que `logIn()` no está funcionando
- Verificar que el UUID de Supabase sea válido
- Verificar que no haya errores de red

---

## ✅ RESULTADO ESPERADO

Después de aplicar estas correcciones:

1. ✅ API Key correcta sin errores de tipeo
2. ✅ Usuario identificado correctamente (NO anonymous)
3. ✅ Webhook de RevenueCat encuentra el perfil
4. ✅ No más errores "Invalid API Key"
5. ✅ No más problemas de "Network configuration issue"

---

**FIN DE SOLUCIÓN**

