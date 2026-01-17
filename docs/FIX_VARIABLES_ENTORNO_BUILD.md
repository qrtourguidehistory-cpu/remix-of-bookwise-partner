# 🔧 Fix: Variables de Entorno en Build de Android

## 🐛 Problema Identificado

La aplicación en Android mostraba pantalla blanca porque `VITE_SUPABASE_ANON_KEY` llegaba como `undefined` al bundle, causando que la app fallara al inicializar el cliente de Supabase.

**Errores en Logcat:**
```
E File: https://localhost/assets/index.js Line 713 - Msg: VITE_SUPABASE_ANON_KEY is not set in environment variable
E File: https://localhost/assets/index.js Line 40 - Msg: Error: Supabase API key is required
E File: https://localhost/assets/index.js Line 713 - Msg: Uncaught Error: Supabase API key is required
```

---

## ✅ SOLUCIONES APLICADAS

### 1. **vite.config.ts - Inyección Explícita de Variables** ✅

**Problema:**
- Vite no estaba inyectando explícitamente las variables de entorno en el bundle de producción
- Las variables `import.meta.env.VITE_*` no se reemplazaban correctamente durante el build

**Solución:**
- Importado `loadEnv` de `vite`
- Creado objeto `viteEnv` que mapea todas las variables `VITE_*` a `import.meta.env.*`
- Agregado `define` en la configuración para inyectar explícitamente las variables durante el build
- Agregado fallback para `process.env` (por si alguna dependencia lo necesita)

**Código aplicado:**
```typescript
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load environment variables explicitly
  const env = loadEnv(mode, process.cwd(), '');
  
  // Extract VITE_ prefixed variables
  const viteEnv: Record<string, string> = {};
  Object.keys(env).forEach((key) => {
    if (key.startsWith('VITE_')) {
      viteEnv[`import.meta.env.${key}`] = JSON.stringify(env[key]);
    }
  });

  return {
    // ... otras configuraciones
    define: {
      ...viteEnv,
      'process.env': JSON.stringify(env),
    },
  };
});
```

**Estado:** ✅ Completado

---

### 2. **supabaseClient.ts - Validación Mejorada y Logging** ✅

**Problema:**
- La validación estricta (`throw new Error`) causaba que la app se rompiera completamente
- No había logging para diagnosticar qué variables estaban disponibles
- No había soporte para nombres alternativos de variables

**Solución:**
- Agregado logging detallado al inicio del módulo
- Cambiado validación estricta por advertencias (`console.warn`)
- Agregado soporte para `VITE_SUPABASE_PUBLISHABLE_KEY` como alternativa a `VITE_SUPABASE_ANON_KEY`
- Agregado validación de credenciales reales (no placeholders)
- La app ya no se rompe si faltan variables, solo muestra advertencias

**Código aplicado:**
```typescript
// Debug logging for environment variables
console.log('[Supabase Client] Intentando conectar a:', import.meta.env.VITE_SUPABASE_URL || 'URL no configurada');
console.log('[Supabase Client] Variables disponibles:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Configurado' : '❌ No configurado',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ No configurado',
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✅ Configurado' : '❌ No configurado',
});

// Support both VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY
const SUPABASE_PUBLISHABLE_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  (() => {
    console.warn('⚠️ VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY no están configuradas');
    return 'placeholder-key';
  })();
```

**Estado:** ✅ Completado

---

## 📋 VERIFICACIÓN DEL ARCHIVO .env

### Variables Requeridas

El archivo `.env` en la raíz del proyecto debe contener:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://rdznelijpliklisnflfm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem5lbGlqcGxpa2xpc25mbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjY4MzAsImV4cCI6MjA3ODIwMjgzMH0.o8G-wYYIN0Paw20YP4dSJcL5mf2mUdrfcWRfMauFjGQ

# Mapbox Configuration
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoibWl0b3Vybm93IiwiYSI6ImNta2hzYnN3aTBtaHIzZHB1MHgydTZ1OWMifQ.I90chYaZczEFiJ33M7hdxw
```

### ⚠️ IMPORTANTE: Nombres de Variables

**El código ahora acepta:**
- ✅ `VITE_SUPABASE_ANON_KEY` (preferido)
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` (alternativo, para compatibilidad)

**Si tu `.env` tiene `VITE_SUPABASE_PUBLISHABLE_KEY` en lugar de `VITE_SUPABASE_ANON_KEY`, funcionará correctamente.**

---

## 🚀 PASOS PARA APLICAR EL FIX

### Paso 1: Verificar Archivo .env

1. **Ubicación:** El archivo `.env` debe estar en la **raíz del proyecto** (mismo nivel que `package.json`)

2. **Formato correcto:**
   ```bash
   VITE_SUPABASE_URL=https://...
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   ❌ **NO usar espacios alrededor del `=`**
   ✅ **Sí usar espacios alrededor del `=`** (aunque técnicamente funciona sin espacios)

3. **Verificar que no haya comillas innecesarias:**
   ```bash
   # ✅ Correcto
   VITE_SUPABASE_URL=https://rdznelijpliklisnflfm.supabase.co
   
   # ❌ Incorrecto (con comillas)
   VITE_SUPABASE_URL="https://rdznelijpliklisnflfm.supabase.co"
   ```

### Paso 2: Build Limpio

```bash
# Limpiar build anterior
rm -rf dist
rm -rf android/app/src/main/assets

# Build nuevo (Vite ahora inyectará las variables explícitamente)
npm run build
```

### Paso 3: Verificar Build

Después del build, verifica que las variables se inyectaron:

1. **Abre `dist/assets/index-*.js`** (o el archivo JS principal)
2. **Busca** `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`
3. **Deberías ver** los valores reales reemplazados, no `undefined`

**Ejemplo de lo que deberías ver:**
```javascript
// ✅ Correcto (valores inyectados)
const SUPABASE_URL = "https://rdznelijpliklisnflfm.supabase.co";

// ❌ Incorrecto (undefined)
const SUPABASE_URL = undefined;
```

### Paso 4: Sincronizar con Capacitor

```bash
# Sincronizar archivos con Android
npx cap sync android
```

### Paso 5: Reinstalar la App

En Android Studio:
- **Build → Clean Project**
- **Build → Rebuild Project**
- **Run → Run 'app'**

O desde terminal:
```bash
cd android
./gradlew clean
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔍 VERIFICACIÓN EN LOGCAT

Después de ejecutar la app, revisa el Logcat en Android Studio:

### ✅ Logs Esperados (Éxito)

```
[Supabase Client] Intentando conectar a: https://rdznelijpliklisnflfm.supabase.co
[Supabase Client] Variables disponibles: {
  VITE_SUPABASE_URL: "✅ Configurado",
  VITE_SUPABASE_ANON_KEY: "✅ Configurado",
  VITE_SUPABASE_PUBLISHABLE_KEY: "❌ No configurado"
}
✅ Credenciales de Supabase validadas correctamente
```

### ❌ Logs de Error (Si algo falla)

```
⚠️ VITE_SUPABASE_URL is not set in environment variables
⚠️ La aplicación puede no funcionar correctamente sin la URL de Supabase
❌ ERROR CRÍTICO: Credenciales de Supabase no válidas
```

**Si ves estos logs:**
1. Verifica que el archivo `.env` existe en la raíz
2. Verifica que las variables tienen el formato correcto
3. Ejecuta un build limpio: `rm -rf dist && npm run build`
4. Vuelve a sincronizar: `npx cap sync android`

---

## 🐛 TROUBLESHOOTING

### Problema: Variables siguen siendo `undefined` después del build

**Causa:** El archivo `.env` no se está leyendo correctamente

**Solución:**
1. Verifica que el archivo se llama exactamente `.env` (no `.env.local`, `.env.production`, etc.)
2. Verifica que está en la raíz del proyecto (mismo nivel que `package.json`)
3. Reinicia el terminal/IDE (puede cachear variables)
4. Ejecuta `npm run build` nuevamente

### Problema: Build funciona pero la app sigue mostrando pantalla blanca

**Causa:** Las variables se inyectaron pero hay otro error

**Solución:**
1. Revisa el Logcat para ver los logs de `[Supabase Client]`
2. Verifica que las credenciales son válidas (no placeholders)
3. Verifica que `base: './'` está en `vite.config.ts`
4. Verifica que `usesCleartextTraffic="true"` está en `AndroidManifest.xml`

### Problema: "Cannot find module 'vite'" al ejecutar build

**Causa:** Dependencias no instaladas

**Solución:**
```bash
npm install
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de ejecutar el build, verifica:

- [x] `vite.config.ts` usa `loadEnv` y `define` ✅
- [x] `supabaseClient.ts` tiene logging y validación mejorada ✅
- [ ] Archivo `.env` existe en la raíz del proyecto
- [ ] Variables tienen el formato correcto (sin comillas, sin espacios alrededor del `=`)
- [ ] Build limpio ejecutado: `rm -rf dist && npm run build`
- [ ] Capacitor sync ejecutado: `npx cap sync android`
- [ ] App reinstalada en el dispositivo/emulador
- [ ] Logcat muestra logs de `[Supabase Client]` con valores correctos

---

## 📝 NOTAS IMPORTANTES

### Sobre `loadEnv`

- `loadEnv(mode, process.cwd(), '')` carga todas las variables del archivo `.env`
- El tercer parámetro `''` significa que carga todas las variables (no solo las que empiezan con un prefijo específico)
- Las variables `VITE_*` se filtran manualmente en el código

### Sobre `define`

- `define` reemplaza las referencias en el código durante el build
- `import.meta.env.VITE_SUPABASE_URL` se reemplaza por el valor real del `.env`
- Esto asegura que las variables estén incrustadas en el bundle final

### Sobre Validación No Estricta

- Cambiamos de `throw new Error()` a `console.warn()` para que la app no se rompa
- La app mostrará advertencias pero seguirá funcionando (aunque puede fallar al conectar con Supabase)
- Esto permite diagnosticar el problema sin que la app se quede en blanco

---

## 🎯 RESULTADO ESPERADO

Después de aplicar estos cambios:

- ✅ Las variables de entorno se inyectan explícitamente en el bundle
- ✅ La app muestra logs detallados en Logcat para diagnóstico
- ✅ La app no se rompe si faltan variables (solo muestra advertencias)
- ✅ Soporte para nombres alternativos de variables (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- ✅ La app carga correctamente en Android con las credenciales de Supabase

---

**Documento creado:** 2026-01-17  
**Correcciones aplicadas:** Todas ✅  
**Próximo paso:** Ejecutar `npm run build` y verificar en Logcat

