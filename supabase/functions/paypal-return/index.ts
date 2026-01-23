import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Edge Function que actúa como intermediario entre PayPal y la app móvil
 * PayPal redirige aquí con los parámetros de aprobación/cancelación
 * Esta función redirige al deep link de la app con esos parámetros
 */
// Función para generar HTML de éxito
function generateSuccessHTML(deepLink: string, isSpanish: boolean = true): string {
  return `<!DOCTYPE html>
<html lang="${isSpanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isSpanish ? 'Pago Exitoso' : 'Payment Successful'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px 30px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      animation: scaleIn 0.5s ease-out;
    }
    .success-icon::before {
      content: '✓';
      color: white;
      font-size: 48px;
      font-weight: bold;
    }
    @keyframes scaleIn {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
    }
    p {
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    .button:active {
      transform: translateY(0);
    }
    .paypal-badge {
      margin-top: 24px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon"></div>
    <h1>${isSpanish ? '¡Pago Exitoso!' : 'Payment Successful!'}</h1>
    <p>${isSpanish 
      ? 'Tu pago ha sido procesado correctamente. Haz clic en el botón para volver a la aplicación.' 
      : 'Your payment has been processed successfully. Click the button to return to the app.'}</p>
    <a href="${deepLink}" class="button" id="returnButton">
      ${isSpanish ? 'CERRAR Y VOLVER' : 'CLOSE AND RETURN'}
    </a>
    <p class="paypal-badge">Powered by PayPal</p>
  </div>
  <script>
    // Intentar abrir el deep link automáticamente después de 1 segundo
    setTimeout(function() {
      window.location.href = "${deepLink}";
    }, 1000);
    
    // Fallback: si el deep link no funciona, intentar cerrar la ventana
    document.getElementById('returnButton').addEventListener('click', function(e) {
      e.preventDefault();
      try {
        window.location.href = "${deepLink}";
        // Si estamos en un iframe o ventana popup, intentar cerrar
        setTimeout(function() {
          if (window.opener) {
            window.close();
          }
        }, 500);
      } catch (err) {
        console.log('Deep link not available');
      }
    });
  </script>
</body>
</html>`;
}

// Función para generar HTML de cancelación
function generateCancelHTML(deepLink: string, isSpanish: boolean = true): string {
  return `<!DOCTYPE html>
<html lang="${isSpanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isSpanish ? 'Pago Cancelado' : 'Payment Canceled'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px 30px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .cancel-icon {
      width: 80px;
      height: 80px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .cancel-icon::before {
      content: '✕';
      color: white;
      font-size: 48px;
      font-weight: bold;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
    }
    p {
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 87, 108, 0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cancel-icon"></div>
    <h1>${isSpanish ? 'Pago Cancelado' : 'Payment Canceled'}</h1>
    <p>${isSpanish 
      ? 'El proceso de pago fue cancelado. Puedes intentar de nuevo cuando estés listo.' 
      : 'The payment process was canceled. You can try again when you are ready.'}</p>
    <a href="${deepLink}" class="button">
      ${isSpanish ? 'VOLVER A LA APP' : 'RETURN TO APP'}
    </a>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Manejar preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    
    // PayPal puede enviar parámetros de diferentes formas:
    // 1. Como query params en la URL (status, subscription_id, token)
    // 2. Como parte del path o en el hash
    const status = url.searchParams.get('status') || 
                   (url.pathname.includes('success') ? 'success' : 
                    url.pathname.includes('cancel') ? 'cancel' : null);
    const subscriptionId = url.searchParams.get('subscription_id');
    const type = url.searchParams.get('type'); // 'checkout' para pago único
    const userId = url.searchParams.get('user_id');
    
    // PayPal envía estos parámetros cuando el usuario aprueba
    // Puede venir como 'token', 'ba_token', 'BA_TOKEN', o en el hash
    const token = url.searchParams.get('token') || 
                  url.searchParams.get('ba_token') || 
                  url.searchParams.get('BA_TOKEN');
    
    // También verificar el hash si existe
    let hashToken = null;
    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      hashToken = hashParams.get('token') || hashParams.get('ba_token');
    }
    
    const approvalToken = token || hashToken;

    console.log('[paypal-return] Parámetros recibidos:', {
      fullUrl: req.url,
      status,
      type,
      subscriptionId,
      userId,
      hasToken: !!approvalToken,
      tokenSource: token ? 'query' : hashToken ? 'hash' : 'none',
    });

    // Construir el deep link usando com.miturnow.partner://paypal
    // Para checkout (pago único), usar com.miturnow.partner://paypal/success
    // Para suscripciones, usar com.miturnow.partner://paypal/success
    let deepLink: string;

    if (status === 'success' || status === 'approved') {
      if (type === 'checkout') {
        // Pago único: usar com.miturnow.partner://paypal/success
        const params = new URLSearchParams();
        params.set('status', 'success');
        params.set('type', 'checkout');
        if (userId) params.set('user_id', userId);
        deepLink = `com.miturnow.partner://paypal/success?${params.toString()}`;
      } else {
        // Suscripción: usar el esquema anterior
        const deepLinkScheme = 'com.miturnow.partner';
        const params = new URLSearchParams();
        if (subscriptionId) params.set('subscription_id', subscriptionId);
        if (userId) params.set('user_id', userId);
        if (approvalToken) params.set('token', approvalToken);
        deepLink = `${deepLinkScheme}://paypal/success?${params.toString()}`;
      }
    } else {
      if (type === 'checkout') {
        // Pago único cancelado: usar com.miturnow.partner://paypal/cancel
        const params = new URLSearchParams();
        params.set('status', 'cancel');
        params.set('type', 'checkout');
        if (userId) params.set('user_id', userId);
        deepLink = `com.miturnow.partner://paypal/cancel?${params.toString()}`;
      } else {
        // Suscripción cancelada: usar el esquema anterior
        const deepLinkScheme = 'com.miturnow.partner';
        const params = new URLSearchParams();
        if (subscriptionId) params.set('subscription_id', subscriptionId);
        if (userId) params.set('user_id', userId);
        deepLink = `${deepLinkScheme}://paypal/cancel?${params.toString()}`;
      }
    }

    console.log('[paypal-return] Deep link generado:', deepLink);

    // Si es un checkout (pago único), mostrar página HTML
    if (type === 'checkout') {
      const isSpanish = true; // Puedes detectar el idioma desde headers si es necesario
      
      if (status === 'success' || status === 'approved') {
        const html = generateSuccessHTML(deepLink, isSpanish);
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
          },
        });
      } else {
        const html = generateCancelHTML(deepLink, isSpanish);
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
          },
        });
      }
    }

    // Para suscripciones, redirigir directamente al deep link
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': deepLink,
      },
    });
  } catch (error: any) {
    console.error('Error in paypal-return:', error);
    
    // Si hay error, redirigir a cancel para que el usuario pueda intentar de nuevo
    const deepLink = `com.miturnow.partner://paypal/cancel?error=${encodeURIComponent(error.message)}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': deepLink,
      },
    });
  }
});
