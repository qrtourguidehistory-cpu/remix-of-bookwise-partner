# 📱 GUÍA: Convertir BookWise Partner en App Móvil Nativa

## 🎯 Objetivo

Convertir tu web app en una aplicación móvil nativa que puedas subir a **Google Play Store** y **Apple App Store** usando **Capacitor**.

## ✅ Ventajas de Capacitor

- ✅ **No rompe tu código existente** - Todo sigue funcionando igual
- ✅ **Mismo código React** - No necesitas reescribir nada
- ✅ **Apps nativas reales** - iOS y Android
- ✅ **Acceso a APIs nativas** - Cámara, notificaciones push, etc.
- ✅ **Fácil de mantener** - Un solo código base

---

## 📋 PASO 1: Instalar Dependencias

Ejecuta en tu terminal:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar @capacitor/splash-screen
```

---

## 📋 PASO 2: Inicializar Capacitor

```bash
# Inicializar Capacitor (solo la primera vez)
npx cap init

# Cuando te pregunte:
# - App name: BookWise Partner
# - App ID: com.bookwise.partner (o el que prefieras)
# - Web dir: dist
```

**Nota:** Ya he creado el archivo `capacitor.config.ts` para ti, así que puedes saltar este paso si prefieres.

---

## 📋 PASO 3: Agregar Plataformas

### Para Android:

```bash
npm run build
npx cap add android
npx cap sync
```

### Para iOS (solo en Mac):

```bash
npm run build
npx cap add ios
npx cap sync
```

---

## 📋 PASO 4: Configurar el Proyecto

### ✅ Ya está configurado:

1. ✅ `capacitor.config.ts` - Configuración de Capacitor
2. ✅ `package.json` - Scripts de Capacitor agregados
3. ✅ `vite.config.ts` - Build output configurado

### 📝 Personalizar (Opcional):

Edita `capacitor.config.ts` para cambiar:
- `appId`: Tu ID único de app (ej: `com.tunegocio.bookwise`)
- `appName`: Nombre que aparecerá en el teléfono
- Colores del splash screen

---

## 📋 PASO 5: Construir y Sincronizar

Cada vez que hagas cambios en tu código:

```bash
# 1. Construir la web app
npm run build

# 2. Sincronizar con las plataformas nativas
npx cap sync
```

**O usa los scripts rápidos:**

```bash
# Para Android
npm run cap:build:android

# Para iOS (solo Mac)
npm run cap:build:ios
```

---

## 📋 PASO 6: Abrir en IDEs Nativos

### Android (Android Studio):

```bash
npm run cap:open:android
```

Esto abrirá Android Studio donde podrás:
- Probar la app en un emulador
- Generar el APK/AAB para Play Store
- Configurar firma de app

### iOS (Xcode - solo Mac):

```bash
npm run cap:open:ios
```

Esto abrirá Xcode donde podrás:
- Probar la app en un simulador
- Generar el IPA para App Store
- Configurar certificados

---

## 📋 PASO 7: Preparar para Publicación

### Android (Play Store):

1. **Generar Keystore** (solo primera vez):
   ```bash
   keytool -genkey -v -keystore bookwise-release.keystore -alias bookwise -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configurar firma en Android Studio:**
   - Abre `android/app/build.gradle`
   - Configura signingConfigs con tu keystore

3. **Generar AAB (Android App Bundle):**
   - En Android Studio: Build → Generate Signed Bundle / APK
   - Selecciona "Android App Bundle"
   - Sube el `.aab` a Google Play Console

### iOS (App Store):

1. **Configurar certificados en Xcode:**
   - Abre el proyecto en Xcode
   - Ve a Signing & Capabilities
   - Selecciona tu equipo de desarrollo

2. **Generar IPA:**
   - En Xcode: Product → Archive
   - Sube a App Store Connect

---

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor de desarrollo web

# Build
npm run build           # Construir para producción

# Capacitor
npm run cap:sync        # Sincronizar cambios
npm run cap:copy        # Copiar archivos web
npm run cap:update      # Actualizar Capacitor
npm run cap:open:ios    # Abrir proyecto iOS
npm run cap:open:android # Abrir proyecto Android
npm run cap:build:ios   # Build + Sync + Abrir iOS
npm run cap:build:android # Build + Sync + Abrir Android
```

---

## 📱 Estructura de Carpetas Después de Capacitor

```
bookwise-partner-1/
├── src/                 # Tu código React (sin cambios)
├── dist/                # Build de producción
├── android/             # Proyecto Android (generado)
├── ios/                 # Proyecto iOS (generado)
├── capacitor.config.ts  # Configuración de Capacitor
└── package.json         # Scripts actualizados
```

---

## ⚠️ IMPORTANTE: No Romper Nada

### ✅ Lo que NO cambia:

- ✅ Tu código React sigue igual
- ✅ Tu estructura de carpetas
- ✅ Tu lógica de negocio
- ✅ Tu base de datos Supabase
- ✅ Tu desarrollo web normal

### 📝 Lo que SÍ cambia:

- ➕ Se agregan carpetas `android/` e `ios/`
- ➕ Se agregan scripts de Capacitor
- ➕ Necesitas hacer `npm run build` antes de probar en móvil

---

## 🚀 Flujo de Trabajo Recomendado

### Desarrollo Normal (Web):

```bash
npm run dev  # Desarrolla como siempre
```

### Probar en Móvil:

```bash
# 1. Construir
npm run build

# 2. Sincronizar
npx cap sync

# 3. Abrir en IDE nativo
npm run cap:open:android  # o ios
```

### Publicar Actualización:

```bash
# 1. Hacer cambios en tu código
# 2. Construir
npm run build

# 3. Sincronizar
npx cap sync

# 4. Abrir IDE y generar release
npm run cap:open:android  # Generar AAB
npm run cap:open:ios      # Generar IPA
```

---

## 🔌 Plugins de Capacitor Disponibles

Ya están instalados:

- **@capacitor/app** - Información de la app, estado
- **@capacitor/haptics** - Vibración háptica
- **@capacitor/keyboard** - Control del teclado
- **@capacitor/status-bar** - Barra de estado
- **@capacitor/splash-screen** - Pantalla de inicio

### Usar en tu código (ejemplo):

```typescript
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';

// Detectar cuando la app vuelve al foreground
App.addListener('appStateChange', ({ isActive }) => {
  console.log('App state changed. Is active?', isActive);
});

// Vibración háptica
Haptics.vibrate();
```

---

## 📝 Requisitos para Publicar

### Android (Play Store):

- ✅ Cuenta de Google Play Developer ($25 USD una vez)
- ✅ Keystore para firmar la app
- ✅ Iconos de app (512x512, 1024x1024)
- ✅ Screenshots de la app
- ✅ Descripción y políticas

### iOS (App Store):

- ✅ Cuenta de Apple Developer ($99 USD/año)
- ✅ Mac con Xcode instalado
- ✅ Certificados de desarrollo/distribución
- ✅ Iconos de app (1024x1024)
- ✅ Screenshots de la app
- ✅ Descripción y políticas

---

## 🐛 Solución de Problemas

### Error: "Cannot find module '@capacitor/core'"

```bash
npm install @capacitor/core @capacitor/cli
```

### Error: "Web dir does not exist"

```bash
npm run build  # Genera la carpeta dist/
```

### La app no se actualiza en el móvil

```bash
npm run build
npx cap sync
# Luego reconstruir en Android Studio / Xcode
```

### CORS o problemas de red

Edita `capacitor.config.ts` y agrega:

```typescript
server: {
  url: 'https://tu-dominio.com',
  cleartext: false
}
```

---

## 📚 Recursos Adicionales

- [Documentación de Capacitor](https://capacitorjs.com/docs)
- [Guía de Android](https://capacitorjs.com/docs/android)
- [Guía de iOS](https://capacitorjs.com/docs/ios)
- [Plugins de Capacitor](https://capacitorjs.com/docs/plugins)

---

## ✅ Checklist de Conversión

- [ ] Instalar dependencias de Capacitor
- [ ] Ejecutar `npm run build`
- [ ] Agregar plataforma Android: `npx cap add android`
- [ ] Agregar plataforma iOS: `npx cap add ios` (si tienes Mac)
- [ ] Sincronizar: `npx cap sync`
- [ ] Probar en Android Studio / Xcode
- [ ] Configurar iconos y splash screen
- [ ] Generar keystore (Android)
- [ ] Configurar certificados (iOS)
- [ ] Generar AAB/IPA
- [ ] Subir a Play Store / App Store

---

## 🎉 ¡Listo!

Tu app ahora puede ser publicada en las tiendas de aplicaciones. El código web sigue funcionando exactamente igual, y ahora también tienes versiones nativas para móviles.

**¿Necesitas ayuda con algún paso específico?** Solo pregunta.

