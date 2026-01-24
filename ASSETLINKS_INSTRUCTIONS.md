# Instrucciones para configurar Android App Links

## 1. Obtener SHA256 del keystore

Ejecuta estos comandos para obtener los fingerprints SHA256:

### Para Release (producción):
```bash
keytool -list -v -keystore "C:\Users\laptop\Desktop\LLAVE PARTNER TUNROW\llave_miturnow.jks" -alias produccion -storepass 1Delarosa | findstr /C:"SHA256:"
```

### Para Debug (desarrollo):
```bash
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android | findstr /C:"SHA256:"
```

**Nota:** Si `keytool` no está disponible, busca Java en:
- `C:\Program Files\Java\jdk-*\bin\keytool.exe`
- O instala Java JDK

## 2. Actualizar assetlinks.json

Edita `public/.well-known/assetlinks.json` y reemplaza:
- `REEMPLAZAR_CON_SHA256_DEBUG` con el SHA256 del keystore de debug
- `REEMPLAZAR_CON_SHA256_RELEASE` con el SHA256 del keystore de producción

**Formato del SHA256:** Debe ser sin espacios ni dos puntos, solo letras y números (ej: `A1B2C3D4E5F6...`)

## 3. Desplegar assetlinks.json

El archivo debe estar accesible en:
```
https://www.miturnow.com/.well-known/assetlinks.json
```

**Verificación:**
```bash
curl https://www.miturnow.com/.well-known/assetlinks.json
```

Debe devolver JSON válido con `Content-Type: application/json`

## 4. Verificar App Links en Android

### En el dispositivo/emulador:
```bash
adb shell pm get-app-links com.miturnow.partner
```

Debe mostrar:
```
com.miturnow.partner:
    ID: ...
    Signatures: [SHA256:...]
    Domain verification state:
      www.miturnow.com: verified
```

### Probar en Chrome:
1. Abre Chrome en Android
2. Navega a: `https://www.miturnow.com/paypal/success?test=1`
3. Debe abrir la app automáticamente (sin mostrar opciones)

## 5. Troubleshooting

Si App Links no funciona:

1. **Verificar que el archivo esté accesible:**
   ```bash
   curl -I https://www.miturnow.com/.well-known/assetlinks.json
   ```
   Debe devolver `200 OK` y `Content-Type: application/json`

2. **Verificar SHA256:**
   - El SHA256 debe coincidir exactamente con el del APK firmado
   - Para debug: usa el SHA256 del debug.keystore
   - Para release: usa el SHA256 del keystore de producción

3. **Limpiar verificación:**
   ```bash
   adb shell pm set-app-links --package com.miturnow.partner 0 all
   adb shell pm verify-app-links --re-verify com.miturnow.partner
   ```

4. **Reinstalar la app:**
   ```bash
   adb uninstall com.miturnow.partner
   adb install app-release.apk
   ```

## 6. Notas importantes

- **HTTPS obligatorio:** App Links solo funcionan con HTTPS, no HTTP
- **Dominio exacto:** El dominio en `assetlinks.json` debe coincidir exactamente con el del `intent-filter`
- **Verificación automática:** Android verifica automáticamente al instalar la app
- **Tiempo de propagación:** Puede tardar hasta 20 minutos después de desplegar `assetlinks.json`

