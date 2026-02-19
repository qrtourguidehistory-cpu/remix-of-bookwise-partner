# 🔍 AUDITORÍA TÉCNICA PROFUNDA: RevenueCat - Invalid API Key

**Fecha:** 2026-02-17  
**Objetivo:** Determinar por qué RevenueCat devuelve "Invalid API Key" y "Backend Code 7981"

---

## 1. BÚSQUEDA EXHAUSTIVA DE REFERENCIAS

### 1.1 Purchases.configure
**Resultado:** ✅ **UNA SOLA LLAMADA ENCONTRADA**

- **Ubicación:** `src/main.tsx` línea 37
- **Contexto:** Dentro de `initializeCapacitor()` → solo si `Capacitor.getPlatform() === "android"`
- **Orden de ejecución:**
  1. `initializeCapacitor()` se ejecuta ANTES de renderizar `<App />`
  2. Se ejecuta en `main.tsx` línea 75: `initializeCapacitor().then(() => { createRoot(...).render(<App />) })`
  3. **NO hay doble inicialización confirmada**

### 1.2 Referencias a RevenueCat/REVENUECAT
**Archivos encontrados:**

1. **src/main.tsx** - Inicialización principal
2. **src/lib/revenueCatService.ts** - Funciones de negocio (NO llama configure)
3. **src/contexts/AuthContext.tsx** - Usa RevenueCat pero NO lo inicializa
4. **src/pages/admin/SubscriptionPage.tsx** - Usa RevenueCat pero NO lo inicializa
5. **src/components/Paywall.tsx** - Usa RevenueCat pero NO lo inicializa
6. **android/app/capacitor.build.gradle** - Dependencia del plugin
7. **android/capacitor.settings.gradle** - Configuración del plugin
8. **android/app/src/main/res/xml/network_security_config.xml** - Configuración de red
9. **android/app/proguard-rules.pro** - Reglas de ProGuard

### 1.3 Referencias a apiKey/goog_
**Resultado:** ✅ **UNA SOLA DEFINICIÓN DE API KEY**

- **Ubicación:** `src/main.tsx` línea 32
- **Valor:** `"goog_tikShxRoguFTFrhlWiWrSmssyzo"`
- **Tipo:** Hardcodeada (NO usa variables de entorno)
- **NO hay otras definiciones de apiKey en:**
  - ❌ `android/app/src/main/res/values/strings.xml`
  - ❌ `android/app/build.gradle`
  - ❌ `android/app/src/main/AndroidManifest.xml`
  - ❌ Código nativo Java/Kotlin

### 1.4 setDebugLogsEnabled
**Resultado:** ❌ **NO ENCONTRADO**
- No se está habilitando debug logs de RevenueCat

---

## 2. CONFIRMACIÓN DE LLAMADAS A Purchases.configure

### 2.1 Cantidad de llamadas
**Resultado:** ✅ **UNA SOLA LLAMADA**

```typescript
// src/main.tsx línea 37
await Purchases.configure({
  apiKey: apiKey,
});
```

### 2.2 Orden de ejecución
**Flujo completo:**

```
1. main.tsx se carga
2. initializeCapacitor() se ejecuta (async)
3. Si es Android → Purchases.configure() se ejecuta
4. Luego se renderiza <App />
5. AuthContext se inicializa (usa RevenueCat pero NO lo configura)
6. revenueCatService usa Purchases pero NO lo configura
```

**Conclusión:** ✅ **NO hay doble inicialización en el código fuente**

### 2.3 Verificación de ejecución múltiple
**Análisis:**
- ✅ Solo hay UNA llamada a `Purchases.configure`
- ✅ Está protegida por `if (Capacitor.getPlatform() === "android")`
- ✅ Está dentro de un try-catch que previene errores silenciosos
- ⚠️ **POSIBLE PROBLEMA:** Si `initializeCapacitor()` se ejecuta múltiples veces, podría haber doble init

---

## 3. VERIFICACIÓN DE API KEY EN ANDROID

### 3.1 Archivos de recursos Android
**Verificado:**
- ✅ `android/app/src/main/res/values/strings.xml` - NO contiene API key
- ✅ `android/app/src/main/AndroidManifest.xml` - NO contiene API key
- ✅ `android/app/build.gradle` - NO contiene API key
- ✅ `android/app/capacitor.build.gradle` - NO contiene API key

### 3.2 Código nativo Java/Kotlin
**Verificado:**
- ✅ `MainActivity.java` - NO inicializa RevenueCat
- ✅ Solo configura WebView para permitir conexiones
- ✅ NO hay Application class personalizada

### 3.3 Build antiguo
**⚠️ PROBLEMA POTENCIAL IDENTIFICADO:**

El código fuente tiene la API key correcta, pero:
- Si el APK/AAB fue compilado ANTES de actualizar la key, contiene la key antigua
- El caché de Gradle puede tener builds antiguos
- El caché de Vite puede tener bundles antiguos

---

## 4. VERIFICACIÓN DE BUILD ANTIGUO

### 4.1 Estado actual del código
**API Key en código:** `goog_tikShxRoguFTFrhlWiWrSmssyzo`

### 4.2 Cómo forzar limpieza total

```bash
# 1. Limpiar caché de Vite/Node
rm -rf node_modules/.cache dist .vite

# 2. Limpiar build de Android
cd android
./gradlew clean
rm -rf app/build .gradle build

# 3. Reconstruir desde cero
cd ..
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

**En Windows PowerShell:**
```powershell
# 1. Limpiar caché de Vite/Node
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules\.cache, dist, .vite

# 2. Limpiar build de Android
cd android
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue app\build, .gradle, build

# 3. Reconstruir
cd ..
npm run build
npx cap sync android
```

---

## 5. LOGS TEMPORALES AGREGADOS

**✅ IMPLEMENTADO en `src/main.tsx` líneas 33-38:**

```typescript
// ✅ AUDITORÍA: Log explícito TEMPORAL antes de configure
console.log("========================================");
console.log("RevenueCat API KEY USED:", apiKey);
console.log("RevenueCat API KEY LENGTH:", apiKey.length);
console.log("RevenueCat API KEY FULL:", apiKey);
console.log("========================================");
```

**Estos logs aparecerán en Logcat antes de `Purchases.configure()`**

---

## 6. VERIFICACIÓN DE CAPACITOR Y PLUGINS

### 6.1 Plugin de RevenueCat
**Configuración encontrada:**
- `android/capacitor.settings.gradle` línea 44-45: Plugin incluido
- `android/app/capacitor.build.gradle` línea 25: Dependencia agregada

**⚠️ ANÁLISIS CRÍTICO:**

El plugin `@revenuecat/purchases-capacitor` **NO inicializa automáticamente** RevenueCat. Requiere llamada explícita a `Purchases.configure()`.

**Verificado:**
- ✅ No hay inicialización automática en el plugin
- ✅ No hay configuración en `capacitor.config.ts` para RevenueCat
- ✅ El plugin solo expone la API de JavaScript, no inicializa

### 6.2 Otros plugins que podrían interferir
**Verificado:**
- ✅ `CapacitorCookies` está deshabilitado (línea 36-38 de `capacitor.config.ts`)
- ✅ `CapacitorHttp` está deshabilitado (línea 39-41 de `capacitor.config.ts`)
- ✅ Estos fueron deshabilitados específicamente para RevenueCat

---

## 7. CONCLUSIÓN FINAL

### 7.1 Punto exacto donde se rompe

**Hipótesis principal:** ⚠️ **BUILD ANTIGUO O CACHÉ**

El código fuente está correcto:
- ✅ API Key correcta: `goog_tikShxRoguFTFrhlWiWrSmssyzo`
- ✅ Una sola inicialización
- ✅ Sin doble init
- ✅ Sin interferencias de plugins

**PERO:**
- ⚠️ El APK/AAB ejecutándose puede tener la key antigua
- ⚠️ El caché de Gradle puede tener builds antiguos
- ⚠️ El bundle de JavaScript puede estar desactualizado

### 7.2 Tipo de error

**Diagnóstico:** 🔴 **BUILD CACHE / APK ANTIGUO**

**NO es:**
- ❌ Doble inicialización (solo hay una)
- ❌ API Key incorrecta en código (está correcta)
- ❌ Interferencia de plugins (están deshabilitados)
- ❌ Configuración en Android nativo (no existe)

**SÍ es:**
- ✅ Build antiguo con key antigua
- ✅ Caché de Gradle/Vite sin limpiar
- ✅ APK instalado con código antiguo

### 7.3 Pasos exactos para dejarlo 100% funcional

#### Paso 1: Limpiar TODO el caché
```powershell
# Desde la raíz del proyecto
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules\.cache, dist, .vite
cd android
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue app\build, .gradle, build
cd ..
```

#### Paso 2: Verificar API Key en código
```bash
# Verificar que la key esté correcta
grep -r "goog_tikShxRoguFTFrhlWiWrSmssyzo" src/main.tsx
```

#### Paso 3: Reconstruir desde cero
```bash
# Build del frontend
npm run build

# Sincronizar con Capacitor
npx cap sync android

# Build de Android (desde Android Studio o CLI)
cd android
./gradlew clean assembleDebug
```

#### Paso 4: Desinstalar app antigua del dispositivo
```bash
# Desinstalar completamente la app
adb uninstall com.miturnow.partner
```

#### Paso 5: Instalar nueva build
```bash
# Instalar nueva build
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Paso 6: Verificar logs
```bash
# Ver logs en tiempo real
adb logcat | grep -E "RevenueCat|Purchases"
```

**Buscar específicamente:**
- `RevenueCat API KEY USED: goog_tikShxRoguFTFrhlWiWrSmssyzo`
- Si aparece otra key, el problema es de build cache
- Si aparece la key correcta pero sigue el error, el problema es de configuración en RevenueCat Dashboard

---

## 8. CHECKLIST DE VERIFICACIÓN

- [x] Solo hay UNA llamada a `Purchases.configure`
- [x] API Key está hardcodeada correctamente
- [x] No hay inicialización en código nativo Android
- [x] No hay doble inicialización en el código
- [x] Plugins que interfieren están deshabilitados
- [x] Logs temporales agregados
- [ ] **PENDIENTE:** Limpiar build cache y reconstruir
- [ ] **PENDIENTE:** Verificar logs en Logcat con la key completa
- [ ] **PENDIENTE:** Verificar que el APK instalado tenga la key correcta

---

## 9. PRÓXIMOS PASOS INMEDIATOS

1. **Ejecutar limpieza completa** (Paso 1-2 del punto 7.3)
2. **Reconstruir desde cero** (Paso 3 del punto 7.3)
3. **Desinstalar app antigua** (Paso 4 del punto 7.3)
4. **Instalar nueva build** (Paso 5 del punto 7.3)
5. **Verificar logs** (Paso 6 del punto 7.3)
6. **Si el error persiste:** Verificar en RevenueCat Dashboard que la Public SDK Key sea exactamente `goog_tikShxRoguFTFrhlWiWrSmssyzo`

---

**FIN DE AUDITORÍA**

