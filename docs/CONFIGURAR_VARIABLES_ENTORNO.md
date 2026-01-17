# 🔧 Configurar Variables de Entorno - Guía de Producción

## ⚠️ IMPORTANTE

Antes de generar el `.AAB` para Google Play Store, **DEBES configurar las variables de entorno**. Sin ellas, la aplicación no funcionará.

---

## 📋 Variables Requeridas

### 1. **VITE_SUPABASE_URL**
- **Descripción:** URL de tu proyecto Supabase
- **Formato:** `https://tu-proyecto.supabase.co`
- **Dónde obtenerla:** [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api)

### 2. **VITE_SUPABASE_ANON_KEY**
- **Descripción:** Clave pública (anon key) de Supabase
- **Formato:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Dónde obtenerla:** [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api)
- **⚠️ Nota:** Esta es una clave pública, diseñada para uso en frontend

### 3. **VITE_MAPBOX_ACCESS_TOKEN**
- **Descripción:** Token de acceso de Mapbox
- **Formato:** `pk.eyJ1IjoibWl0b3Vybm93IiwiYSI6ImNta2hzYnN3aTBtaHIzZHB1MHgydTZ1OWMifQ...`
- **Dónde obtenerla:** [Mapbox Account](https://account.mapbox.com/access-tokens/)
- **⚠️ Nota:** Token público, diseñado para uso en frontend

---

## 🔧 Configuración por Entorno

### **Desarrollo Local**

1. **Crea un archivo `.env` en la raíz del proyecto:**

```bash
# En la raíz del proyecto
touch .env
```

2. **Copia el siguiente contenido y reemplaza con tus valores reales:**

```bash
VITE_SUPABASE_URL=https://rdznelijpliklisnflfm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem5lbGlqcGxpa2xpc25mbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjY4MzAsImV4cCI6MjA3ODIwMjgzMH0.o8G-wYYIN0Paw20YP4dSJcL5mf2mUdrfcWRfMauFjGQ
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoibWl0b3Vybm93IiwiYSI6ImNta2hzYnN3aTBtaHIzZHB1MHgydTZ1OWMifQ.I90chYaZczEFiJ33M7hdxw
VITE_ENV=development
```

3. **Verifica que el archivo `.env` esté en `.gitignore`** (ya debería estarlo)

4. **Reinicia el servidor de desarrollo:**

```bash
npm run dev
```

---

### **Build de Producción (Para .AAB)**

#### **Opción A: Variables en el Sistema**

Antes de ejecutar el build, configura las variables en tu terminal:

**Windows (PowerShell):**
```powershell
$env:VITE_SUPABASE_URL="https://rdznelijpliklisnflfm.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="tu-anon-key-aqui"
$env:VITE_MAPBOX_ACCESS_TOKEN="tu-mapbox-token-aqui"
npm run build
```

**Linux/Mac:**
```bash
export VITE_SUPABASE_URL="https://rdznelijpliklisnflfm.supabase.co"
export VITE_SUPABASE_ANON_KEY="tu-anon-key-aqui"
export VITE_MAPBOX_ACCESS_TOKEN="tu-mapbox-token-aqui"
npm run build
```

#### **Opción B: Archivo .env.production**

1. **Crea un archivo `.env.production` en la raíz:**

```bash
VITE_SUPABASE_URL=https://rdznelijpliklisnflfm.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
VITE_MAPBOX_ACCESS_TOKEN=tu-mapbox-token-aqui
VITE_ENV=production
```

2. **Ejecuta el build:**

```bash
npm run build
```

⚠️ **IMPORTANTE:** Asegúrate de que `.env.production` esté en `.gitignore` también.

---

### **Hosting (Vercel, Netlify, etc.)**

#### **Vercel:**

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. **Settings** → **Environment Variables**
3. Agrega cada variable:
   - `VITE_SUPABASE_URL` = `https://tu-proyecto.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `tu-anon-key`
   - `VITE_MAPBOX_ACCESS_TOKEN` = `tu-mapbox-token`
4. Selecciona **Production**, **Preview** y **Development**
5. **Save** y redeploy

#### **Netlify:**

1. Ve a tu proyecto en [Netlify Dashboard](https://app.netlify.com/)
2. **Site settings** → **Environment variables**
3. Agrega cada variable con el mismo formato que Vercel
4. **Save** y redeploy

---

## 🔍 Verificar que las Variables Estén Configuradas

### **En Desarrollo:**

Abre la consola del navegador (F12) y ejecuta:

```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Mapbox Token:', import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ? '✅ Configurado' : '❌ No configurado');
```

Si ves `undefined`, las variables no están configuradas correctamente.

### **En Build de Producción:**

Las variables se incrustan en el bundle durante el build. Para verificarlas:

1. Genera el build: `npm run build`
2. Inspecciona los archivos en `dist/` (las variables estarán reemplazadas por sus valores)

---

## ⚠️ Errores Comunes

### **Error: "Supabase URL is required"**

**Causa:** `VITE_SUPABASE_URL` no está configurado

**Solución:**
1. Verifica que el archivo `.env` existe en la raíz
2. Verifica que el formato es correcto: `VITE_SUPABASE_URL=https://...`
3. Reinicia el servidor de desarrollo

### **Error: "Mapbox access token is required"**

**Causa:** `VITE_MAPBOX_ACCESS_TOKEN` no está configurado

**Solución:**
1. Agrega `VITE_MAPBOX_ACCESS_TOKEN=tu-token` al `.env`
2. Reinicia el servidor de desarrollo

### **Las variables no se cargan en el build**

**Causa:** Variables no están en el sistema o `.env.production`

**Solución:**
- Para desarrollo: Usa `.env`
- Para producción: Usa `.env.production` o variables del sistema

---

## ✅ Checklist Pre-Build

Antes de generar el `.AAB`, verifica:

- [ ] Archivo `.env` creado con todas las variables
- [ ] `VITE_SUPABASE_URL` configurado correctamente
- [ ] `VITE_SUPABASE_ANON_KEY` configurado correctamente
- [ ] `VITE_MAPBOX_ACCESS_TOKEN` configurado correctamente
- [ ] Variables verificadas en consola del navegador
- [ ] Build de prueba ejecutado: `npm run build`
- [ ] Build de prueba verificado: `npm run preview`

---

## 📝 Notas de Seguridad

### ✅ **Seguro (Público)**

Estas variables son **públicas** por diseño:

- `VITE_SUPABASE_ANON_KEY` - Clave pública (anon key)
- `VITE_MAPBOX_ACCESS_TOKEN` - Token público

Están diseñadas para uso en frontend y se incrustan en el bundle.

### ❌ **NO Incluir Aquí**

- Service Role Keys de Supabase (solo backend)
- API Keys privadas
- Secrets de servidor
- Credenciales de base de datos

### 🔒 **Para Valores Sensibles**

- Usa variables de entorno del servidor (para backend)
- Usa `@capacitor/preferences` (para valores locales)

---

## 🚀 Próximos Pasos

Una vez configuradas las variables:

1. ✅ Verifica que funcionan en desarrollo
2. ✅ Ejecuta un build de prueba
3. ✅ Genera el `.AAB` para Google Play Store

---

**Documento creado:** 2026-01-17  
**Última actualización:** 2026-01-17

