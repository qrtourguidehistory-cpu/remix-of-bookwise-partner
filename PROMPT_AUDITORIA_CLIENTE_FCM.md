# PROMPT PARA CURSOR - AUDITORÍA FCM TOKEN CLIENTE

Copia y pega este prompt completo en Cursor:

---

**PROMPT EXACTO PARA CURSOR (CÓPIALO TAL CUAL)**

```
AUDITORÍA COMPLETA - REGISTRO FCM TOKEN APP CLIENTE

PROBLEMA:
- La app cliente no solicita permisos de notificaciones al reinstalar
- Los tokens FCM no se registran o aparecen como inválidos
- Las Edge Functions fallan con "messaging/registration-token-not-registered"

OBJETIVO:
Auditar TODO el flujo de registro de tokens FCM en la APP CLIENTE para identificar qué falta o está mal.

TAREAS ESPECÍFICAS:

1️⃣ BUSCAR SERVICIO DE PUSH NOTIFICATIONS
   - Buscar archivos: src/services/*push*.ts, src/lib/*push*.ts, src/utils/*push*.ts
   - ¿Existe un servicio que inicialice push notifications?
   - ¿Tiene una función como initializeClientPush() o similar?
   - ¿Solicita permisos con PushNotifications.requestPermissions()?
   - ¿Llama a PushNotifications.register()?
   - ¿Tiene listener para 'registration' que guarde el token?

2️⃣ VERIFICAR AUTH CONTEXT
   - Archivo: src/contexts/AuthContext.tsx (o similar)
   - ¿Se llama al servicio de push después de signIn?
   - ¿Se llama cuando la app se abre con sesión existente?
   - ¿Hay useEffect que inicialice push notifications?

3️⃣ VERIFICAR GUARDADO EN SUPABASE
   - ¿Se guarda el token en la tabla client_devices?
   - ¿Se usa role: 'client' (NO 'partner')?
   - ¿Se usa upsert con onConflict: 'fcm_token'?
   - Código esperado:
     await supabase.from('client_devices').upsert({
       user_id: userId,
       role: 'client', // ✅ CRÍTICO
       platform: 'android' | 'ios',
       fcm_token: token.value,
       is_active: true,
       enabled: true
     }, { onConflict: 'fcm_token' });

4️⃣ VERIFICAR CAPACITOR
   - Archivo: capacitor.config.ts
   - ¿Está configurado el plugin PushNotifications?
   - ¿El appId es correcto para la app cliente?

5️⃣ VERIFICAR LISTENERS
   - ¿Existe listener 'registration' que reciba el token?
   - ¿Existe listener 'registrationError' para errores?
   - ¿Se verifica si es plataforma nativa con Capacitor.isNativePlatform()?

6️⃣ BUSCAR LOGS
   - ¿Hay console.log que muestren el flujo?
   - Buscar logs como [ClientPush], [PushService], [FCM], etc.

FORMATO DE RESPUESTA:

Para cada hallazgo, reportar:

✅ LO QUE EXISTE:
   Archivo: [ruta]
   Línea: [número]
   Código: [snippet]
   Estado: ✅ Funciona correctamente

❌ LO QUE FALTA:
   Archivo: [ruta donde debería estar]
   Problema: [descripción]
   Solución sugerida: [qué agregar]

⚠️ LO QUE ESTÁ MAL:
   Archivo: [ruta]
   Línea: [número]
   Problema: [descripción]
   Código actual: [snippet]
   Código correcto: [snippet]

RESULTADO ESPERADO:
Un reporte completo que identifique:
1. Si existe el servicio de push notifications
2. Si se inicializa correctamente
3. Si se solicitan permisos
4. Si se registra el token FCM
5. Si se guarda en Supabase con role: 'client'
6. Qué falta o está mal para arreglarlo

IMPORTANTE:
- Esta es la APP CLIENTE, no la Partner
- Los tokens deben tener role: 'client'
- El appId debe ser diferente al Partner
- Buscar en TODO el proyecto, no solo en src/services
```

---

**INSTRUCCIONES:**
1. Abre Cursor en la ventana del proyecto CLIENTE
2. Copia TODO el contenido entre las comillas invertidas (desde "AUDITORÍA COMPLETA" hasta el final)
3. Pégalo en el chat de Cursor
4. Espera el reporte completo de auditoría

