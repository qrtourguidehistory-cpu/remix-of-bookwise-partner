import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Web Client ID from Google Cloud Console (same as BookWise Client)
const GOOGLE_WEB_CLIENT_ID = '762901353486-v2vvtk3oskg0t8rd58la8lums0tb87sa.apps.googleusercontent.com';

interface NativeSocialLoginResult {
  success: boolean;
  error?: string;
}

export function useNativeSocialLogin() {
  const [isNative, setIsNative] = useState(false);
  const [loading, setLoading] = useState(false);
  const [SocialLogin, setSocialLogin] = useState<any>(null);

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    const native = platform === 'android' || platform === 'ios';
    setIsNative(native);

    // Dynamically import SocialLogin only on native platforms
    if (native) {
      // Use a non-literal import to avoid Vite/Rollup trying to resolve this at build time
      const modulePath = '@capgo/capacitor-social-login';
      import(modulePath).then((module) => {
        setSocialLogin(module.SocialLogin);
        // Initialize Google login
        module.SocialLogin.initialize({
          google: {
            webClientId: GOOGLE_WEB_CLIENT_ID,
          },
        }).catch((err: any) => {
          console.log('[NativeSocialLogin] Init error:', err);
        });
      }).catch((err) => {
        console.log('[NativeSocialLogin] Import error:', err);
      });
    }
  }, []);

  const signInWithGoogleNative = async (): Promise<NativeSocialLoginResult> => {
    if (!isNative || !SocialLogin) {
      return { success: false, error: 'Native login not available' };
    }

    setLoading(true);

    try {
      // Attempt native Google login
      const result = await SocialLogin.login({
        provider: 'google',
        options: {},
      });

      console.log('[NativeSocialLogin] Google result:', JSON.stringify(result));

      const idToken = result?.result?.idToken || result?.idToken;
      const accessToken = result?.result?.accessToken || result?.accessToken;
      
      console.log('[NativeSocialLogin] Tokens received:', { hasIdToken: !!idToken, hasAccessToken: !!accessToken });
      
      if (idToken) {
        // Use the ID token to sign in with Supabase
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          access_token: accessToken,
        });

        if (error) {
          console.error('[NativeSocialLogin] Supabase error:', error);
          return { success: false, error: error.message };
        }

        console.log('[NativeSocialLogin] Supabase success:', data.user?.email);
        return { success: true };
      } else {
        // No idToken in result - log full result for debugging
        console.error('[NativeSocialLogin] No idToken in result:', JSON.stringify(result, null, 2));
        return { success: false, error: 'No ID token received from Google' };
      }
    } catch (error: any) {
      console.error('[NativeSocialLogin] Error:', error);
      
      // Check for specific error codes
      const errorCode = error?.code || error?.message;
      
      if (errorCode === '16' || errorCode?.includes('reauth') || errorCode?.includes('12501')) {
        return { success: false, error: 'REAUTH_REQUIRED' };
      }
      
      return { success: false, error: error?.message || 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  const fallbackToOAuthWeb = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) {
        toast.error('Error al conectar con Google');
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error: any) {
      toast.error('Error al conectar con Google');
      return { success: false, error: error?.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    isNative,
    loading,
    signInWithGoogleNative,
    fallbackToOAuthWeb,
  };
}
