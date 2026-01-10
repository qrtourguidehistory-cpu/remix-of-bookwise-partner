import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import MiTurnowLogo from "@/components/ui/MiTurnowLogo";

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b">
        <div className="flex items-center gap-3">
          <MiTurnowLogo size={36} animated={false} />
          <h1 className="text-2xl font-bold">MiTurnow</h1>
        </div>
        <button
          onClick={() => setLanguage(language === "en" ? "es" : "en")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Globe className="w-4 h-4" />
          {language === "en" ? "Español" : "English"}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {(title || subtitle) && (
            <div className="text-center space-y-2">
              {title && <h2 className="text-3xl font-bold">{title}</h2>}
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 border-t text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4">
          <a href="#" className="hover:text-foreground transition-colors">
            Support
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
