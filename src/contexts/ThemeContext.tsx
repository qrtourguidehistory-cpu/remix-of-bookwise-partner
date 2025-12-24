import { createContext, useContext, useEffect, useState } from "react";
import { loadSavedThemeColor } from "@/lib/themeUtils";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return (stored as Theme) || "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
    
    // Load saved theme color on mount
    loadSavedThemeColor();
  }, [theme]);

  // Load accessibility settings on mount
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Load font size scale
    const savedFontSize = localStorage.getItem("font-size-scale");
    if (savedFontSize) {
      root.style.setProperty("--font-scale", savedFontSize);
    } else {
      root.style.setProperty("--font-scale", "1.075");
    }
    
    // Load footer visibility
    const showFooter = localStorage.getItem("show-footer-text");
    if (showFooter === "false") {
      const footerElements = document.querySelectorAll('[data-footer-text]');
      footerElements.forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default values instead of throwing error
    // This prevents crashes during hot reload or initial render
    console.warn("useTheme called outside ThemeProvider, using default values");
    return {
      theme: "light" as Theme,
      toggleTheme: () => {
        console.warn("toggleTheme called outside ThemeProvider");
      },
    };
  }
  return context;
}
