package com.miturnow.partner;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configurar WebView para permitir todas las conexiones HTTPS/HTTP
        // Esto es crítico para que RevenueCat pueda conectarse a sus servidores
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings webSettings = webView.getSettings();
            // Permitir contenido mixto (HTTPS/HTTP) - necesario para algunas APIs
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            // Habilitar JavaScript (ya debería estar, pero por si acaso)
            webSettings.setJavaScriptEnabled(true);
            // Permitir acceso a archivos locales
            webSettings.setAllowFileAccess(true);
            webSettings.setAllowContentAccess(true);
            
            // CRÍTICO: Desactivar el manejo automático de cookies del WebView
            // Esto permite que RevenueCat SDK nativo maneje sus propias cookies
            CookieManager cookieManager = CookieManager.getInstance();
            // No desactivar completamente las cookies, pero asegurar que no interfieran
            cookieManager.setAcceptCookie(true);
            // Permitir cookies de terceros (necesario para RevenueCat)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.setAcceptThirdPartyCookies(webView, true);
            }
        }
    }
}

