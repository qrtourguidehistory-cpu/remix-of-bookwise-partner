import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

// Deep link scheme for the app - used for native redirect
const NATIVE_REDIRECT_URL = 'com.miturnow.app://auth/callback';

/**
 * Hook for handling OAuth in Capacitor apps
 * Uses pure web OAuth flow - NO native sign-in, NO Firebase
 * Supabase handles opening the browser and redirecting back
 */
export function useCapacitorOAuth() {
  const [loading, setLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // Handle deep link redirects from OAuth (native only)
  useEffect(() => {
    if (!isNative) return;

    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      console.log('[CapacitorOAuth] App opened with URL:', url);
      
      // Check if this is an auth callback
      if (url.includes('auth/callback') || url.includes('access_token') || url.includes('code=')) {
        try {
          // Extract tokens from URL - handle both hash fragments and query params
          let accessToken: string | null = null;
          let refreshToken: string | null = null;
          let code: string | null = null;
          
          // Check for hash fragments (implicit flow)
          if (url.includes('#')) {
            const hashParams = new URLSearchParams(url.split('#')[1]);
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }
          
          // Check for query params (PKCE flow)
          if (url.includes('?')) {
            const urlObj = new URL(url);
            code = urlObj.searchParams.get('code');
            
            // Also check for tokens in query params
            if (!accessToken) {
              accessToken = urlObj.searchParams.get('access_token');
              refreshToken = urlObj.searchParams.get('refresh_token');
            }
          }
          
          // Handle implicit flow - set session directly
          if (accessToken) {
            console.log('[CapacitorOAuth] Setting session from tokens');
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (error) {
              console.error('[CapacitorOAuth] Error setting session:', error);
            } else {
              console.log('[CapacitorOAuth] Session set successfully');
            }
            setLoading(false);
            return;
          }
          
          // Handle PKCE flow - exchange code for session
          if (code) {
            console.log('[CapacitorOAuth] Exchanging code for session');
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('[CapacitorOAuth] Error exchanging code:', error);
            } else {
              console.log('[CapacitorOAuth] Code exchanged successfully');
            }
            setLoading(false);
            return;
          }
          
          console.warn('[CapacitorOAuth] No tokens or code found in callback URL');
        } catch (error) {
          console.error('[CapacitorOAuth] Error handling redirect:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    // Listen for app URL opens (deep links)
    const listener = App.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      listener.then(l => l.remove());
    };
  }, [isNative]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    
    try {
      // Use deep link for native, web origin for browser
      const redirectUrl = isNative 
        ? NATIVE_REDIRECT_URL
        : `${window.location.origin}/`;
      
      console.log('[CapacitorOAuth] Starting Google OAuth with redirect:', redirectUrl);
      
      // Let Supabase handle everything - no skipBrowserRedirect, no Browser.open
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[CapacitorOAuth] OAuth error:', error);
        setLoading(false);
        return { success: false, error: error.message };
      }

      // Supabase will handle the redirect automatically
      return { success: true };
    } catch (error: any) {
      console.error('[CapacitorOAuth] Error:', error);
      setLoading(false);
      return { success: false, error: error.message };
    }
  }, [isNative]);

  const signInWithApple = useCallback(async () => {
    setLoading(true);
    
    try {
      const redirectUrl = isNative 
        ? NATIVE_REDIRECT_URL
        : `${window.location.origin}/`;
      
      console.log('[CapacitorOAuth] Starting Apple OAuth with redirect:', redirectUrl);
      
      // Let Supabase handle everything
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('[CapacitorOAuth] Apple OAuth error:', error);
        setLoading(false);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('[CapacitorOAuth] Apple error:', error);
      setLoading(false);
      return { success: false, error: error.message };
    }
  }, [isNative]);

  // Reset loading state when auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    isNative,
    loading,
    signInWithGoogle,
    signInWithApple,
  };
}
