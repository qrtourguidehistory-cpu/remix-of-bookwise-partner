# 🔧 Solución: Pantalla Blanca en Android

## 🐛 Problema Reportado

La aplicación en Android muestra una pantalla blanca después de las correcciones de variables de entorno.

---

## ✅ CORRECCIONES APLICADAS

### 1. **Ruta de Activos (Base Path)** ✅

**Archivo modificado:** `vite.config.ts`

**Problema:**
- Sin `base: './'`, Vite genera rutas absolutas (`/assets/...`)
- Android/Capacitor necesita rutas relativas (`./assets/...`)

**Solución aplicada:**
```typescript
export default defineConfig(({ mode }) => ({
  base: './', // ✅ CRÍTICO para Capacitor Android
  // ... resto de la configuración
}));
```

**Estado:** ✅ Completado

---

### 2. **Permisos de Red (Cleartext Traffic)** ✅

**Archivo modificado:** `android/app/src/main/AndroidManifest.xml`

**Problema:**
- Android 9+ bloquea tráfico HTTP (cleartext) por defecto
- Supabase puede necesitar conexiones HTTP en desarrollo
- La app puede no conectarse a la API de Supabase

**Solución aplicada:**
```xml
<application
    ...
    android:usesCleartextTraffic="true">
```

**Estado:** ✅ Completado

**⚠️ Nota:** Si Supabase usa solo HTTPS, este permiso no es necesario en producción, pero ayuda en desarrollo.

---

### 3. **Variables de Entorno en Build** ✅

**Archivos verificados:**
- `src/lib/supabaseClient.ts` ✅
- `src/pages/onboarding/steps/BusinessLocationStep.tsx` ✅
- `src/pages/admin/BusinessProfileSettings.tsx` ✅
- `src/components/maps/BusinessMapDisplay.tsx` ✅

**Estado:** ✅ Todas las referencias usan `import.meta.env.VITE_*`

**Verificación:**
- Las variables se incrustan en el bundle durante `npm run build`
- Vite reemplaza `import.meta.env.VITE_*` con valores reales
- Si las variables no están configuradas, la app mostrará error en consola (no pantalla blanca silenciosa)

---

### 4. **Lectura de Coordenadas desde `businesses`** ✅

**Archivo verificado:** `src/pages/admin/BusinessProfileSettings.tsx`

**Verificación:**
```typescript
// Línea 133: Lee directamente de businesses
.select("..., latitude, longitude, ...")
.from("businesses")  // ✅ No usa establishments

// Línea 146-147: Asigna correctamente
latitude: data.latitude,
longitude: data.longitude,
```

**Estado:** ✅ **CORRECTO** - Lee directamente de `businesses`, no de `establishments`

---

## 🔍 VERIFICACIÓN ADICIONAL

### **Errores de Supabase en Logcat**

Veo en la imagen que hay errores de Supabase en el logcat:
```
[PartnerPush] Supabase error: [object Object]
```

**Posibles causas:**
1. Variables de entorno no están configuradas en el build
2. Las variables no se están leyendo correctamente en runtime
3. Error de conexión a Supabase

**Solución:**
1. Verificar que el archivo `.env` existe en la raíz del proyecto
2. Verificar que las variables tienen el formato correcto:
   ```bash
   VITE_SUPABASE_URL=https://rdznelijpliklisnflfm.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
3. Ejecutar build limpio:
   ```bash
   rm -rf dist
   npm run build
   npx cap sync android
   ```

---

## 📋 CHECKLIST DE VERIFICACIÓN

Antes de ejecutar el build, verifica:

- [x] `vite.config.ts` tiene `base: './'` ✅
- [x] `AndroidManifest.xml` tiene `android:usesCleartextTraffic="true"` ✅
- [ ] Archivo `.env` existe en la raíz del proyecto
- [ ] Variables de entorno están configuradas correctamente
- [ ] Build limpio ejecutado: `rm -rf dist && npm run build`
- [ ] Capacitor sync ejecutado: `npx cap sync android`
- [ ] App reinstalada en el dispositivo/emulador

---

## 🚀 PASOS PARA SOLUCIONAR LA PANTALLA BLANCA

### Paso 1: Verificar Variables de Entorno

1. **Crea/verifica el archivo `.env` en la raíz:**

```bash
# En la raíz del proyecto
VITE_SUPABASE_URL=https://rdznelijpliklisnflfm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem5lbGlqcGxpa2xpc25mbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjY4MzAsImV4cCI6MjA3ODIwMjgzMH0.o8G-wYYIN0Paw20YP4dSJcL5mf2mUdrfcWRfMauFjGQ
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoibWl0b3Vybm93IiwiYSI6ImNta2hzYnN3aTBtaHIzZHB1MHgydTZ1OWMifQ.I90chYaZczEFiJ33M7hdxw
```

2. **Verifica que el formato es correcto (sin espacios alrededor del `=`):**

❌ **Incorrecto:**
```bash
VITE_SUPABASE_URL = https://...
```

✅ **Correcto:**
```bash
VITE_SUPABASE_URL=https://...
```

### Paso 2: Build Limpio

```bash
# Limpiar build anterior
rm -rf dist
rm -rf android/app/src/main/assets

# Build nuevo
npm run build

# Verificar que el build se completó correctamente
ls dist/assets
```

### Paso 3: Sincronizar con Capacitor

```bash
# Sincronizar archivos con Android
npx cap sync android

# Esto copia los archivos de dist/ a android/app/src/main/assets/
```

### Paso 4: Reinstalar la App

```bash
# Opción A: Desde Android Studio
# - Build → Clean Project
# - Build → Rebuild Project
# - Run → Run 'app'

# Opción B: Desde terminal
cd android
./gradlew clean
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Paso 5: Verificar en Logcat

1. Abre Android Studio → Logcat
2. Filtra por `com.bookwise.partner`
3. Busca errores relacionados con:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `index.html` o archivos de assets

---

## 🐛 TROUBLESHOOTING

### Problema: "Supabase URL is required"

**Causa:** Variables de entorno no configuradas en el build

**Solución:**
1. Verifica que `.env` existe en la raíz
2. Reinicia el terminal/IDE (puede cachear variables)
3. Ejecuta `npm run build` nuevamente

### Problema: Archivos JS/CSS no se cargan

**Causa:** Rutas incorrectas (faltaba `base: './'`)

**Solución:**
1. ✅ Ya agregamos `base: './'` en `vite.config.ts`
2. Ejecuta build limpio: `rm -rf dist && npm run build`
3. Verifica que `dist/index.html` usa rutas relativas: `./assets/...`

### Problema: Conexión a Supabase falla

**Causa:** Permisos de red bloqueados

**Solución:**
1. ✅ Ya agregamos `usesCleartextTraffic="true"` en AndroidManifest
2. Verifica que la app tiene permiso de Internet (ya está declarado)
3. Si Supabase usa HTTPS, `usesCleartextTraffic` no debería afectar, pero ayuda en desarrollo

### Problema: Pantalla blanca persistente

**Solución:**
1. Abre DevTools en Chrome: `chrome://inspect` → Inspect tu dispositivo
2. Revisa la consola para errores JavaScript
3. Verifica que `index.html` se carga correctamente
4. Verifica que los archivos JS se cargan (Network tab)

---

## ✅ VERIFICACIÓN FINAL

Una vez aplicadas las correcciones, verifica:

1. ✅ **vite.config.ts** tiene `base: './'`
2. ✅ **AndroidManifest.xml** tiene `usesCleartextTraffic="true"`
3. ✅ **Variables de entorno** configuradas en `.env`
4. ✅ **Build limpio** ejecutado
5. ✅ **Capacitor sync** ejecutado
6. ✅ **App reinstalada** en el dispositivo

---

## 📝 NOTAS IMPORTANTES

### Sobre `usesCleartextTraffic`

- **Desarrollo:** Necesario si usas HTTP localmente
- **Producción:** Supabase usa HTTPS, así que no es crítico, pero no causa problemas
- **Alternativa:** Si quieres ser más estricto, puedes usar un `network_security_config.xml` para permitir cleartext solo para dominios específicos

### Sobre `base: './'`

- **Crítico para Capacitor:** Sin esto, Android no encuentra los archivos
- **No afecta desarrollo:** Solo afecta el build de producción
- **Asegura rutas relativas:** `/assets/...` → `./assets/...`

---

## 🎯 RESULTADO ESPERADO

Después de estas correcciones:

- ✅ La app carga correctamente en Android
- ✅ Los archivos JS/CSS se cargan desde `./assets/...`
- ✅ Supabase se conecta correctamente
- ✅ Mapbox funciona correctamente
- ✅ No hay pantalla blanca

---

**Documento creado:** 2026-01-17  
**Correcciones aplicadas:** Todas ✅

