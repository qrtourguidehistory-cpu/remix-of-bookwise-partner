import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// Función pública - NO requiere autenticación
// PayPal redirige aquí sin Authorization headers
// Redirige a HTTPS App Link usando HTTP 302 (NO custom schemes, NO JavaScript)
serve((req) => {
  try {
    const url = new URL(req.url);
    const params = url.searchParams.toString();
    
    // Construir URL HTTPS para Android App Links
    // Preservar todos los query params de PayPal
    const redirectUrl = `https://www.miturnow.com/paypal/cancel${params ? '?' + params : ''}`;
    
    console.log('[paypal-cancel] Redirecting to:', redirectUrl);
    
    // HTTP 302 redirect - Android App Links funcionan con redirects nativos
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error in paypal-cancel:', error);
    return new Response('Error processing request', { status: 500 });
  }
});
