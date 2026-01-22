import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obtener el parámetro status y session_id de la URL
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    let sessionId = url.searchParams.get('session_id');

    // Si no hay session_id en los parámetros, intentar extraerlo de la URL completa
    if (!sessionId) {
      const urlMatch = req.url.match(/session_id=([^&]+)/);
      if (urlMatch) {
        sessionId = urlMatch[1];
        console.log('[stripe-return] 🔍 Extracted session_id from URL pattern:', sessionId);
      }
    }

    // Log para debugging
    console.log('[stripe-return] 📥 Received request:', {
      fullUrl: req.url,
      status,
      sessionId,
      allParams: Object.fromEntries(url.searchParams.entries())
    });

    // Determinar el deep link según el status
    let deepLink: string;
    
    if (status === 'success') {
      // Incluir session_id si está disponible
      if (sessionId) {
        deepLink = `miturnow://admin?status=success&session_id=${encodeURIComponent(sessionId)}`;
        console.log('[stripe-return] ✅ Including session_id in deep link:', sessionId);
      } else {
        deepLink = 'miturnow://admin?status=success';
        console.log('[stripe-return] ⚠️ No session_id provided, deep link without session_id');
      }
    } else if (status === 'cancel') {
      deepLink = 'miturnow://admin?status=cancel';
    } else {
      // Si no hay status o es inválido, redirigir a admin por defecto
      deepLink = 'miturnow://admin';
    }

    console.log('[stripe-return] 🔗 Redirecting to deep link:', deepLink);

    // Retornar HTTP 302 redirect puro sin body
    return new Response(null, {
      status: 302,
      headers: {
        'Location': deepLink,
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('[stripe-return] ❌ Error:', error);
    // En caso de error, redirigir a admin por defecto
    return new Response(null, {
      status: 302,
      headers: {
        'Location': 'miturnow://admin',
        ...corsHeaders,
      },
    });
  }
});
