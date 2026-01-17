# 🔍 AUDITORÍA COMPLETA: Estándares Google Play Store

**Fecha:** 2026-01-17  
**Versión:** 1.0  
**Estado:** ⚠️ DIAGNÓSTICO - NO SE MODIFICARON ARCHIVOS

---

## 📋 RESUMEN EJECUTIVO

Esta auditoría identifica **15 hallazgos críticos** y **8 mejoras recomendadas** antes de generar el archivo `.AAB` para Google Play Store.

**Prioridad:**
- 🔴 **CRÍTICO** (5): Debe corregirse antes de publicar
- 🟡 **ALTO** (6): Debe corregirse para evitar rechazos
- 🟢 **MEDIO** (4): Mejoras recomendadas
- 🔵 **BAJO** (8): Optimizaciones opcionales

---

## 1️⃣ CONFIGURACIÓN DE PRODUCCIÓN (Android)

### ✅ **1.1 targetSdkVersion - CUMPLE**

**Archivo:** `android/variables.gradle`

```gradle
targetSdkVersion = 36  // ✅ API 36 (Android 15) - Supera el mínimo requerido (API 34)
compileSdkVersion = 36
minSdkVersion = 24
```

**Estado:** ✅ **CUMPLE** - targetSdkVersion 36 supera el mínimo requerido (API 34 para 2026)

---

### ✅ **1.2 Nombre del Paquete - CUMPLE**

**Archivo:** `android/app/build.gradle`

```gradle
applicationId "com.bookwise.partner"
```

**Archivo:** `capacitor.config.ts`

```typescript
appId: 'com.bookwise.partner'
```

**Estado:** ✅ **CUMPLE** - Nombre único y profesional (`com.bookwise.partner`)

---

### ⚠️ **1.3 Iconos Adaptativos - REVISAR**

**Archivos:**
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` ✅ Existe
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` ✅ Existe
- Iconos en múltiples densidades: `hdpi`, `mdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi` ✅ Existen

**Hallazgo:**
- ✅ Iconos adaptativos configurados correctamente
- ⚠️ **VERIFICAR:** Que los iconos `.webp` tengan el tamaño correcto (512x512px recomendado)
- ⚠️ **VERIFICAR:** Que el foreground y background estén bien definidos

**Archivos a revisar:**
- `android/app/src/main/res/mipmap-*/ic_launcher*.webp` (todos los tamaños)
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml`
- `android/app/src/main/res/values/ic_launcher_background.xml`

**Recomendación:** Verificar visualmente que los iconos se vean correctos en diferentes dispositivos.

---

## 2️⃣ SEGURIDAD Y PRIVACIDAD

### 🔴 **2.1 Variables de Entorno Hardcodeadas - CRÍTICO**

**Archivos afectados:**

#### **2.1.1 Supabase Credentials (CRÍTICO)**

**Archivo:** `src/lib/supabaseClient.ts`

```typescript
// Hardcoded credentials - these will NOT be overwritten by Lovable Cloud
const SUPABASE_URL = 'https://rdznelijpliklisnflfm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Problema:**
- 🔴 Credenciales hardcodeadas en el código fuente
- 🔴 Expuestas en el bundle de producción
- 🔴 Cualquiera puede extraerlas del APK/AAB

**Impacto:** 🔴 **CRÍTICO** - Riesgo de seguridad

**Solución requerida:**
1. Mover a variables de entorno (`import.meta.env.VITE_SUPABASE_URL`)
2. Configurar en build de producción
3. Usar Capacitor's `@capacitor/preferences` para valores sensibles (opcional)

---

#### **2.1.2 Mapbox Token (MEDIO)**

**Archivos afectados:**
- `src/pages/onboarding/steps/BusinessLocationStep.tsx` (línea 47-48)
- `src/pages/admin/BusinessProfileSettings.tsx` (línea 85-86)
- `src/components/maps/BusinessMapDisplay.tsx` (línea 45-46)

```typescript
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 
  'pk.eyJ1IjoibWl0b3Vybm93IiwiYSI6ImNta2hzYnN3aTBtaHIzZHB1MHgydTZ1OWMifQ.I90chYaZczEFiJ33M7hdxw';
```

**Problema:**
- 🟡 Token hardcodeado como fallback
- 🟡 Expuesto en el código fuente

**Impacto:** 🟡 **MEDIO** - Token público (diseñado para frontend), pero mejor práctica es usar solo variables de entorno

**Solución recomendada:**
- Eliminar el fallback hardcodeado
- Usar solo `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN`
- Configurar en build de producción

---

### ⚠️ **2.2 Permisos de Ubicación - FALTA DECLARACIÓN**

**Archivo:** `android/app/src/main/AndroidManifest.xml`

**Hallazgo:**
- ❌ **NO se declara** `ACCESS_FINE_LOCATION`
- ❌ **NO se declara** `ACCESS_COARSE_LOCATION`
- ✅ Se usa `@capacitor/geolocation` pero falta la declaración en AndroidManifest

**Problema:**
- La app usa geolocalización en:
  - `BusinessLocationStep.tsx` (onboarding)
  - `BusinessProfileSettings.tsx` (editar perfil)
- Pero **no está declarado en AndroidManifest.xml**

**Impacto:** 🔴 **CRÍTICO** - Google Play puede rechazar la app por uso de permisos no declarados

**Solución requerida:**
Agregar a `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

**Archivo a modificar:**
- `android/app/src/main/AndroidManifest.xml`

---

### ⚠️ **2.3 Política de Privacidad - VERIFICAR**

**Hallazgo:**
- ⚠️ No se encontró referencia a política de privacidad en el código
- ⚠️ Google Play requiere política de privacidad si la app:
  - Solicita permisos de ubicación
  - Maneja datos personales
  - Usa servicios de terceros (Supabase, Mapbox, Firebase)

**Impacto:** 🟡 **ALTO** - Google Play puede rechazar sin política de privacidad

**Solución requerida:**
1. Crear política de privacidad (URL pública)
2. Agregar link en la app (Settings → About)
3. Declarar en Google Play Console

---

## 3️⃣ RENDIMIENTO Y ESTABILIDAD

### ✅ **3.1 Memory Leaks en Mapas - BIEN MANEJADO**

**Archivos revisados:**
- `src/pages/onboarding/steps/BusinessLocationStep.tsx`
- `src/pages/admin/BusinessProfileSettings.tsx`
- `src/components/maps/BusinessMapDisplay.tsx`

**Hallazgo:**
- ✅ Todos los `useEffect` tienen cleanup: `map.remove()`
- ✅ Refs se limpian correctamente
- ✅ No hay listeners huérfanos

**Estado:** ✅ **CUMPLE** - No se detectaron memory leaks en mapas

---

### ⚠️ **3.2 Memory Leaks en Realtime Subscriptions - MEJORABLE**

**Archivo:** `src/hooks/useRealtimeAppointments.ts`

**Hallazgo:**
- ✅ Tiene cleanup: `supabase.removeChannel(channel)` (línea 106)
- ⚠️ **PROBLEMA:** El channel name incluye `Date.now()` (línea 34), lo que puede crear múltiples canales si el componente se re-renderiza frecuentemente

```typescript
const channelName = `partner-appointments-${profile.business_id}-${Date.now()}`;
```

**Problema:**
- Si el componente se re-monta rápidamente, puede crear múltiples canales
- Aunque hay cleanup, puede haber un breve período donde hay canales duplicados

**Impacto:** 🟡 **MEDIO** - Puede causar múltiples suscripciones temporales

**Solución recomendada:**
- Usar un channel name estable basado solo en `business_id`
- O usar `useRef` para almacenar el channel y verificar si ya existe

**Archivo a modificar:**
- `src/hooks/useRealtimeAppointments.ts`

---

### ⚠️ **3.3 Manejo de Errores - MEJORABLE**

**Archivos revisados:**
- `src/pages/admin/BusinessProfileSettings.tsx` (61 matches de error handling)

**Hallazgo:**
- ✅ La mayoría de funciones tienen `try-catch`
- ⚠️ **PROBLEMA:** Algunos errores solo se logean en consola sin feedback al usuario
- ⚠️ **PROBLEMA:** Errores de geocodificación se silencian (línea 598)

```typescript
} catch (error) {
  console.error('Reverse geocoding error:', error);
  // Si falla, solo guardar coordenadas
  // ⚠️ No hay feedback al usuario
}
```

**Impacto:** 🟡 **MEDIO** - Usuario puede no entender por qué algo no funciona

**Solución recomendada:**
- Agregar toasts informativos para errores críticos
- Mejorar mensajes de error para el usuario

**Archivos a revisar:**
- `src/pages/admin/BusinessProfileSettings.tsx`
- `src/pages/onboarding/steps/BusinessLocationStep.tsx`

---

### ⚠️ **3.4 Crashes Potenciales - REVISAR**

**Hallazgos:**
- ⚠️ Acceso a propiedades sin verificación null en algunos lugares
- ⚠️ `appointment.businesses?.business_name` - puede ser undefined si la relación no se carga

**Ejemplo:**
```typescript
// src/components/mobile/AppointmentDetailView.tsx (línea 897)
<p className="font-semibold">{appointment.businesses?.business_name || ""}</p>
```

**Estado:** ✅ **BIEN** - Usa optional chaining, pero algunos lugares podrían mejorar

**Recomendación:** Revisar todos los accesos a relaciones de Supabase y asegurar fallbacks adecuados.

---

## 4️⃣ GENERACIÓN DE RECIBOS (PDF)

### ✅ **4.1 Problema del PDF - YA CORREGIDO**

**Archivo:** `src/components/mobile/AppointmentDetailView.tsx`

**Problema original (ya corregido):**
- ❌ Usaba `html2canvas` → generaba imagen PNG → se veía como texto plano
- ❌ No tenía formato de tabla
- ❌ Se cortaba antes del total

**Solución implementada:**
- ✅ Ahora usa `jsPDF` + `autoTable` directamente
- ✅ Formato tipo factura con tabla profesional
- ✅ Encabezado con nombre del negocio (negrita, centrado)
- ✅ Dirección y teléfono incluidos
- ✅ Tabla de servicios con columnas claras
- ✅ Total resaltado
- ✅ Pie de página con "¡Gracias por su visita!"
- ✅ Ajuste dinámico de página

**Estado:** ✅ **CORREGIDO** - El PDF ahora se genera correctamente

**Nota:** El PDF mencionado (`Recibo_jordan_cliente_2026-01-15.pdf`) fue generado con la versión antigua. Los nuevos recibos deberían verse correctamente.

---

## 5️⃣ CAPA DE DATOS

### ✅ **5.1 Mapeo businesses ↔ establishments - CORRECTO**

**Archivo:** `supabase/migrations/20251224044015_remix_migration_from_pg_dump.sql`

**Hallazgo:**
- ✅ `establishments` es una **VIEW** (no tabla) que mapea desde `businesses`
- ✅ Incluye `latitude` y `longitude` de la tabla `businesses` (líneas 417-418)
- ✅ La VIEW filtra por `is_public = true` y `onboarding_completed = true` (línea 530)

**Estructura:**
```sql
CREATE VIEW public.establishments AS
 SELECT id,
    business_name AS name,
    ...
    latitude,  -- ✅ Mapeado desde businesses
    longitude  -- ✅ Mapeado desde businesses
   FROM public.businesses
  WHERE ((is_public = true) AND (onboarding_completed = true));
```

**Estado:** ✅ **CORRECTO** - No hay datos hardcodeados, todo viene de la tabla `businesses`

---

### ⚠️ **5.2 Coordenadas por Defecto - REVISAR**

**Archivos:**
- `src/pages/onboarding/steps/BusinessLocationStep.tsx` (línea 111)
- `src/pages/admin/BusinessProfileSettings.tsx` (línea 655)

```typescript
const defaultLat = location.latitude || 19.4326;  // Ciudad de México
const defaultLng = location.longitude || -99.1332;
```

**Hallazgo:**
- 🟡 Coordenadas hardcodeadas como fallback (Ciudad de México)
- 🟡 Puede no ser apropiado para usuarios fuera de México

**Impacto:** 🟢 **BAJO** - Solo afecta la ubicación inicial del mapa, no los datos guardados

**Recomendación:** Considerar usar la ubicación del usuario (GPS) como fallback en lugar de coordenadas fijas.

---

## 📊 RESUMEN DE HALLAZGOS

### 🔴 **CRÍTICOS (5) - DEBEN CORREGIRSE ANTES DE PUBLICAR**

1. **Supabase credentials hardcodeadas** (`src/lib/supabaseClient.ts`)
   - Mover a variables de entorno
   
2. **Permisos de ubicación no declarados** (`android/app/src/main/AndroidManifest.xml`)
   - Agregar `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION`

3. **Política de privacidad faltante**
   - Crear y agregar link en la app

4. **Token Mapbox hardcodeado** (3 archivos)
   - Eliminar fallback hardcodeado, usar solo variables de entorno

5. **Verificación de iconos adaptativos**
   - Verificar visualmente que se vean correctos

---

### 🟡 **ALTOS (6) - RECOMENDADOS PARA EVITAR RECHAZOS**

6. **Memory leaks potenciales en realtime subscriptions**
   - Mejorar channel name para evitar duplicados

7. **Manejo de errores mejorable**
   - Agregar feedback al usuario para errores críticos

8. **Crashes potenciales en relaciones de Supabase**
   - Revisar todos los accesos a relaciones y agregar fallbacks

9. **Coordenadas por defecto hardcodeadas**
   - Considerar usar GPS del usuario como fallback

10. **Verificación de build de producción**
    - Probar build release antes de generar AAB

11. **Verificación de permisos en runtime**
    - Agregar solicitud de permisos en runtime (Android 6.0+)

---

### 🟢 **MEDIOS (4) - MEJORAS RECOMENDADAS**

12. **Optimización de bundle size**
    - Revisar dependencias no utilizadas

13. **Logging en producción**
    - Deshabilitar `console.log` en producción

14. **Error boundaries**
    - Agregar React Error Boundaries para capturar crashes

15. **Testing en dispositivos reales**
    - Probar en múltiples dispositivos Android antes de publicar

---

## 📁 ARCHIVOS QUE NECESITAN MODIFICACIONES

### 🔴 **CRÍTICOS (5 archivos)**

1. `src/lib/supabaseClient.ts` - Mover credenciales a variables de entorno
2. `android/app/src/main/AndroidManifest.xml` - Agregar permisos de ubicación
3. `src/pages/onboarding/steps/BusinessLocationStep.tsx` - Eliminar token hardcodeado
4. `src/pages/admin/BusinessProfileSettings.tsx` - Eliminar token hardcodeado
5. `src/components/maps/BusinessMapDisplay.tsx` - Eliminar token hardcodeado

### 🟡 **ALTOS (3 archivos)**

6. `src/hooks/useRealtimeAppointments.ts` - Mejorar channel name
7. `src/pages/admin/BusinessProfileSettings.tsx` - Mejorar manejo de errores
8. `src/pages/onboarding/steps/BusinessLocationStep.tsx` - Mejorar manejo de errores

### 🟢 **MEDIOS (2 archivos)**

9. `vite.config.ts` - Configurar variables de entorno para producción
10. `android/app/build.gradle` - Configurar ProGuard/R8 para producción (opcional)

---

## 🎯 CHECKLIST PRE-PUBLICACIÓN

### Configuración Android
- [x] targetSdkVersion ≥ 34 ✅
- [x] Package name único ✅
- [ ] Iconos adaptativos verificados visualmente ⚠️
- [ ] Permisos declarados en AndroidManifest ❌
- [ ] Política de privacidad creada y linkeada ❌

### Seguridad
- [ ] Credenciales en variables de entorno ❌
- [ ] Tokens no hardcodeados ❌
- [ ] Permisos solicitados en runtime ⚠️

### Rendimiento
- [x] Memory leaks en mapas ✅
- [ ] Memory leaks en subscriptions ⚠️
- [ ] Error handling robusto ⚠️
- [ ] Error boundaries implementados ❌

### Funcionalidad
- [x] PDF de recibos corregido ✅
- [x] Mapeo de datos correcto ✅
- [ ] Testing en dispositivos reales ⚠️

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

### Fase 1: Críticos (Antes de generar AAB)
1. Mover credenciales Supabase a variables de entorno
2. Agregar permisos de ubicación en AndroidManifest
3. Eliminar tokens hardcodeados
4. Crear política de privacidad
5. Verificar iconos adaptativos

### Fase 2: Altos (Antes de publicar)
6. Mejorar channel name en realtime subscriptions
7. Mejorar manejo de errores con feedback al usuario
8. Agregar solicitud de permisos en runtime
9. Probar build release en dispositivo real

### Fase 3: Medios (Post-lanzamiento)
10. Optimizar bundle size
11. Deshabilitar logging en producción
12. Agregar Error Boundaries
13. Testing exhaustivo en múltiples dispositivos

---

## 📝 NOTAS ADICIONALES

### Sobre el PDF del Recibo
El problema del PDF (`Recibo_jordan_cliente_2026-01-15.pdf`) **ya fue corregido**. La nueva implementación usa `jsPDF` + `autoTable` directamente, generando un formato profesional tipo factura. Los nuevos recibos deberían verse correctamente.

### Sobre las Coordenadas
Las coordenadas por defecto (Ciudad de México) solo se usan como fallback para centrar el mapa inicialmente. Los datos guardados en la base de datos son los correctos (del usuario). Esto es aceptable, pero se puede mejorar usando GPS del usuario como fallback.

### Sobre el Token de Mapbox
El token de Mapbox es público por diseño (diseñado para uso en frontend), pero la mejor práctica es no hardcodearlo. Debe moverse completamente a variables de entorno.

---

## ✅ CONCLUSIÓN

La aplicación está **funcionalmente lista**, pero requiere **5 correcciones críticas** antes de generar el `.AAB` para Google Play Store:

1. 🔴 Credenciales Supabase en variables de entorno
2. 🔴 Permisos de ubicación en AndroidManifest
3. 🔴 Política de privacidad
4. 🔴 Tokens Mapbox en variables de entorno
5. 🔴 Verificación de iconos

Una vez corregidos estos puntos, la app estará lista para generar el `.AAB` y subir a Google Play Store.

---

**Auditoría realizada por:** Cursor AI  
**Fecha:** 2026-01-17  
**Próxima revisión:** Después de implementar correcciones críticas

