import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { initializePartnerPush, cleanupPartnerPush } from "../services/partnerPushService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  profile: any | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitializedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const fetchingProfileRef = useRef(false);

  const fetchUserProfile = async (userId: string) => {
    // Prevent concurrent fetches
    if (fetchingProfileRef.current) return;
    fetchingProfileRef.current = true;

    try {
      // First, fetch the profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      // CRITICAL: ALWAYS try to fetch business - this ensures we never miss a business
      // Strategy: Try by profile.business_id first, then by owner_id (most reliable)
      let businessData = null;
      let businessFoundBy = null; // Track how we found it for debugging
      
      // Strategy 1: Try to fetch business by profile.business_id if it exists
      if (profileData?.business_id) {
        const { data: business, error: businessError } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", profileData.business_id)
          .maybeSingle();
        
        if (!businessError && business) {
          businessData = business;
          businessFoundBy = 'profile_business_id';
        }
      }
      
      // Strategy 2: If no business found yet, ALWAYS try by owner_id (most reliable method)
      // This handles cases where profile.business_id is null but user owns a business
      if (!businessData) {
        const { data: business, error: businessError } = await supabase
          .from("businesses")
          .select("*")
          .eq("owner_id", userId)
          .maybeSingle();
        
        if (!businessError && business) {
          businessData = business;
          businessFoundBy = 'owner_id';
          
          // CRITICAL FIX: Update profile.business_id in DB to prevent future issues
          // This fixes data inconsistencies where business exists but profile.business_id is null
          try {
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ business_id: business.id })
              .eq("id", userId);
            
            // If update succeeded, update profileData in memory immediately
            if (!updateError && profileData) {
              profileData.business_id = business.id;
            }
          } catch (updateError) {
            // Silent fail - we'll still use the business data even if update fails
            // This prevents RLS policy issues from blocking the app
          }
        }
      }

      // Build final profile - use profileData if available, otherwise create minimal
      const finalProfile = profileData || { id: userId };
      
      // CRITICAL: Always prioritize businessData.id over profileData.business_id
      // This ensures we always use the most up-to-date business_id
      // Priority: businessData.id > profileData.business_id > null
      const finalBusinessId = businessData?.id || profileData?.business_id || null;
      
      // Set profile with business_id - this is what ProtectedRoute checks
      setProfile({
        ...finalProfile,
        business_id: finalBusinessId,
        businesses: businessData
      });
    } catch (error) {
      // Fallback to prevent loading hang - set minimal profile
      // Even if there's an error, try to get business by owner_id as last resort
      try {
        const { data: business } = await supabase
          .from("businesses")
          .select("*")
          .eq("owner_id", userId)
          .maybeSingle();
        
        if (business) {
          setProfile({ 
            id: userId, 
            business_id: business.id,
            businesses: business 
          });
        } else {
          setProfile({ id: userId });
        }
      } catch (fallbackError) {
        // Last resort - minimal profile
        setProfile({ id: userId });
      }
    } finally {
      fetchingProfileRef.current = false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Initialize auth - check session first
    const initializeAuth = async () => {
      if (isInitializedRef.current) return;
      
      try {
        setLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) {
          setLoading(false);
          return;
        }
        
        if (error) {
          setLoading(false);
          return;
        }
        
        const currentUser = session?.user ?? null;
        
        // Mark as initialized only after we have session data
        isInitializedRef.current = true;
        setSession(session);
        setUser(currentUser);
        
        if (currentUser) {
          lastUserIdRef.current = currentUser.id;
          // Fetch profile without blocking - it will set loading to false when done
          fetchUserProfile(currentUser.id).finally(() => {
            if (mounted) {
              setLoading(false);
            }
          });
          
          // Initialize partner push notifications
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentUser.id)
                .single();
              
              if (profile?.role === 'partner') {
                try {
                  await initializePartnerPush(currentUser.id);
                } catch (err) {
                  console.error('[AuthContext] Push init failed but continuing:', err);
                }
              }
            } catch (error) {
              console.error('[AuthContext] Push init error:', error);
            }
          }, 1000);
        } else {
          // No session, we're done
          setLoading(false);
        }
      } catch (error) {
        // Silent error handling
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Process INITIAL_SESSION only if not already initialized
        if (event === 'INITIAL_SESSION') {
          if (!isInitializedRef.current) {
            // Let initializeAuth handle it
            return;
          }
          return;
        }

        const currentUser = session?.user ?? null;
        const currentUserId = currentUser?.id ?? null;
        
        // Only process if user actually changed
        if (currentUserId === lastUserIdRef.current && currentUser) {
          // User hasn't changed, skip processing but ensure loading is false
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        lastUserIdRef.current = currentUserId;
        setSession(session);
        setUser(currentUser);
        
        // Fetch profile if we have a user
        if (currentUser) {
          setLoading(true);
          fetchUserProfile(currentUser.id).finally(() => {
            if (mounted) {
              setLoading(false);
            }
          });
          
          // Initialize partner push notifications
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentUser.id)
                .single();
              
              if (profile?.role === 'partner') {
                try {
                  await initializePartnerPush(currentUser.id);
                } catch (err) {
                  console.error('[AuthContext] Push init failed but continuing:', err);
                }
              }
            } catch (error) {
              console.error('[AuthContext] Push init error:', error);
            }
          }, 1000);
        } else {
          // No user, clear profile
          setProfile(null);
          if (mounted) {
            setLoading(false);
          }
        }
      }
    );

    // Initialize first
    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Add a timeout race to prevent hanging
      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const timeoutPromise = new Promise<{ data: { user: null; session: null }; error: any }>((_, reject) => {
         setTimeout(() => reject(new Error("Login timeout")), 15000); // 15s timeout
      });

      const { error } = await Promise.race([signInPromise, timeoutPromise]) as any;

      if (error) {
        toast.error(error.message || "Error al iniciar sesión");
        return { error };
      }

      toast.success("¡Bienvenido!");
      
      // Initialize partner push notifications
      setTimeout(async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single();
            
            if (profile?.role === 'partner') {
              try {
                await initializePartnerPush(user.id);
              } catch (err) {
                console.error('[AuthContext] Push init failed but continuing:', err);
              }
            }
          }
        } catch (error) {
          console.error('[AuthContext] Push init error:', error);
        }
      }, 1000);
      
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || "Error inesperado");
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/onboarding`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          account_type: 'partner', // Mark as partner signup
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    // Check if user was actually created or if they already exist
    // Supabase returns data.user but no session if user exists but isn't confirmed
    if (data.user && !data.session) {
      // User might already exist - check if they have a business (partner)
      // This is a soft check - the main validation is server-side
      toast.success("¡Cuenta creada! Revisa tu email para confirmar.");
    } else if (data.session) {
      // Auto-confirmed (if email confirmation is disabled)
      toast.success("¡Cuenta creada exitosamente!");
    } else {
      toast.success("¡Cuenta creada! Revisa tu email para confirmar.");
    }
    
    return { error: null };
  };

  const signOut = async () => {
    // Cleanup push notifications before signing out
    try {
      await cleanupPartnerPush();
    } catch (error) {
      console.error('[AuthContext] Cleanup error:', error);
    }
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast.error(error.message);
      return;
    }

    setUser(null);
    setSession(null);
    setProfile(null);
    lastUserIdRef.current = null;
    isInitializedRef.current = false;
    toast.success("Sesión cerrada");
    window.location.href = "/auth/login";
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success("Revisa tu email para restablecer tu contraseña");
    return { error: null };
  };

  // Memoize the context value to prevent unnecessary re-renders
  // and ensure stable reference
  const value: AuthContextType = useMemo(() => ({
    user,
    session,
    loading,
    isAuthenticated: !!user,
    profile,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshProfile,
  }), [user, session, loading, profile]);

  // Always provide a value, even during initialization
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
