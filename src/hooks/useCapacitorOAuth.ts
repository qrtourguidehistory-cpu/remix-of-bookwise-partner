import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for handling OAuth in Capacitor apps using external browser
 * This approach opens the system browser for OAuth and handles the redirect back to the app
 */
export function useCapacitorOAuth() {
  const [loading, setLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // Handle deep link redirects from OAuth
  useEffect(() => {
    if (!isNative) return;

    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      console.log('[CapacitorOAuth] App opened with URL:', url);
      
      // Check if this is an auth callback
      if (url.includes('auth/v1/callback') || url.includes('access_token') || url.includes('code=')) {
        try {
          // Close the browser
          await Browser.close();
          
          // Extract tokens from URL
          const urlObj = new URL(url);
          
          // Check for hash fragments (implicit flow)
          if (url.includes('#')) {
            const hashParams = new URLSearchParams(url.split('#')[1]);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            
            if (accessToken) {
              console.log('[CapacitorOAuth] Setting session from hash tokens');
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              
              if (error) {
                console.error('[CapacitorOAuth] Error setting session:', error);
              } else {
                console.log('[CapacitorOAuth] Session set successfully');
              }
              return;
            }
          }
          
          // Check for code (PKCE flow)
          const code = urlObj.searchParams.get('code');
          if (code) {
            console.log('[CapacitorOAuth] Exchanging code for session');
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('[CapacitorOAuth] Error exchanging code:', error);
            } else {
              console.log('[CapacitorOAuth] Code exchanged successfully');
            }
          }
        } catch (error) {
          console.error('[CapacitorOAuth] Error handling redirect:', error);
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
      // Get the OAuth URL from Supabase
      const redirectUrl = isNative 
        ? 'com.bookwise.partner://auth/callback'  // Deep link for native apps
        : `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative, // Don't auto-redirect on native, we'll handle it
        },
      });

      if (error) {
        console.error('[CapacitorOAuth] OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (isNative && data.url) {
        // Open external browser for OAuth
        console.log('[CapacitorOAuth] Opening browser with URL:', data.url);
        await Browser.open({ 
          url: data.url,
          presentationStyle: 'popover',
          windowName: '_blank',
        });
        return { success: true, pending: true }; // Auth is pending, will complete on redirect
      }

      // Web flow - redirect happens automatically
      return { success: true };
    } catch (error: any) {
      console.error('[CapacitorOAuth] Error:', error);
      return { success: false, error: error.message };
    } finally {
      // Don't reset loading on native - it will reset when auth completes
      if (!isNative) {
        setLoading(false);
      }
    }
  }, [isNative]);

  const signInWithApple = useCallback(async () => {
    setLoading(true);
    
    try {
      const redirectUrl = isNative 
        ? 'com.bookwise.partner://auth/callback'
        : `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        },
      });

      if (error) {
        console.error('[CapacitorOAuth] Apple OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (isNative && data.url) {
        await Browser.open({ 
          url: data.url,
          presentationStyle: 'popover',
          windowName: '_blank',
        });
        return { success: true, pending: true };
      }

      return { success: true };
    } catch (error: any) {
      console.error('[CapacitorOAuth] Apple error:', error);
      return { success: false, error: error.message };
    } finally {
      if (!isNative) {
        setLoading(false);
      }
    }
  }, [isNative]);

  // Reset loading state when auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
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
