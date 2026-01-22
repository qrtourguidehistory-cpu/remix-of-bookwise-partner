import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { X, Globe, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useCapacitorOAuth } from "@/hooks/useCapacitorOAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { signInWithGoogle, loading: oauthLoading } = useCapacitorOAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!showEmailForm) {
      setShowEmailForm(true);
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      
      if (!error) {
        navigate("/", { replace: true });
      }
    } catch (err) {
      toast.error(language === "es" ? "Error inesperado" : "Unexpected error");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Safe mounting check
  const mountedRef = useMountedRef();

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    
    if (!result.success && result.error) {
      toast.error(language === "es" ? "Error al conectar con Google" : "Error connecting with Google");
    }
  };

  const isLoading = loading || oauthLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Close button */}
      <motion.div
        className="absolute top-4 right-4 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => navigate("/welcome")}
        >
          <X className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-start p-6 pt-16 max-w-md mx-auto w-full">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              {language === "es" ? "Inicia sesión o regístrate" : "Log in or sign up"}
            </h1>
            <p className="text-muted-foreground">
              {language === "es" 
                ? "Crea una cuenta o inicia sesión para gestionar tus citas" 
                : "Create an account or log in to manage your appointments"}
            </p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Google - Outlined button */}
            <Button
              variant="outline"
              className="w-full h-14 justify-center gap-3 text-base font-medium rounded-xl border-border"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{language === "es" ? "Continuar con Google" : "Continue with Google"}</span>
            </Button>

            {/* Email - Outlined button */}
            <Button
              variant="outline"
              className="w-full h-14 justify-center gap-3 text-base font-medium rounded-xl border-border"
              onClick={() => setShowEmailForm(true)}
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span>{language === "es" ? "Continuar con Email" : "Continue with Email"}</span>
            </Button>
          </div>

          {/* Email Form - Shows when email button is clicked */}
          {showEmailForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative mb-4">
                <Separator />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-sm text-muted-foreground uppercase">
                  {language === "es" ? "O" : "OR"}
                </span>
              </div>
              
              <form onSubmit={handleEmailContinue} className="space-y-4">
                <Input
                  type="email"
                  placeholder={language === "es" ? "tu@email.com" : "your@email.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 text-base rounded-xl border-border px-4"
                  autoFocus
                />
                
                <Input
                  type="password"
                  placeholder={language === "es" ? "Contraseña" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-14 text-base rounded-xl border-border px-4"
                />

                <Button 
                  type="submit" 
                  className="w-full h-14 text-base font-medium rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading 
                    ? (language === "es" ? "Conectando..." : "Connecting...")
                    : (language === "es" ? "Continuar" : "Continue")
                  }
                </Button>
              </form>
            </motion.div>
          )}

          {showEmailForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-between text-sm"
            >
              <a
                href="/auth/forgot-password"
                className="text-primary hover:underline"
              >
                {language === "es" ? "¿Olvidaste tu contraseña?" : "Forgot password?"}
              </a>
              <a
                href="/auth/signup"
                className="text-primary hover:underline"
              >
                {language === "es" ? "Crear cuenta" : "Create account"}
              </a>
            </motion.div>
          )}

          {/* Professional Sign In */}
          <div className="pt-4 space-y-1">
            <p className="text-foreground font-medium">
              {language === "es" ? "¿Tienes un negocio?" : "Have a business account?"}
            </p>
            <Link
              to="/auth/signup"
              className="text-primary hover:underline font-medium"
            >
              {language === "es" ? "Regístrate como profesional" : "Sign in as a professional"}
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-6 pb-8">
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => setLanguage(language === "en" ? "es" : "en")}
            className="flex items-center gap-1.5 text-primary hover:underline"
          >
            <Globe className="w-4 h-4" />
            {language === "en" ? "Español" : "English"}
          </button>
          <a href="#" className="flex items-center gap-1.5 text-primary hover:underline">
            <HelpCircle className="w-4 h-4" />
            {language === "es" ? "Soporte" : "Support"}
          </a>
        </div>
      </footer>
    </div>
  );
}

// Helper hook for safe async state updates
function useMountedRef() {
  const mountedRef = React.useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}
