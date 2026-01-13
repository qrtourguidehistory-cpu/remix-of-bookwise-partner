import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        position="top-center"
        className="toaster group"
        // Configuración para stack vertical de múltiples notificaciones
        visibleToasts={5} // Máximo 5 toasts visibles a la vez
        expand={true} // Expandir toasts para mostrar más información
        richColors={false} // Usar colores del tema
        closeButton={true} // Mostrar botón de cerrar
        toastOptions={{
          // Auto-dismiss después de 4 segundos (configurable por toast individual)
          duration: 4000,
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
      {/* Estilos CSS personalizados para el stack vertical */}
      <style>{`
        /* Contenedor de toasts: stack vertical con gap */
        [data-sonner-toaster] {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          align-items: center !important;
        }
        
        /* Cada toast individual con margen inferior */
        [data-sonner-toast] {
          margin-bottom: 8px !important;
          position: relative !important;
        }
        
        /* Evitar superposición usando z-index dinámico */
        [data-sonner-toast]:nth-child(1) { z-index: 100; }
        [data-sonner-toast]:nth-child(2) { z-index: 99; }
        [data-sonner-toast]:nth-child(3) { z-index: 98; }
        [data-sonner-toast]:nth-child(4) { z-index: 97; }
        [data-sonner-toast]:nth-child(5) { z-index: 96; }
      `}</style>
    </>
  );
};

export { Toaster, toast };
