import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface TutorialTipProps {
  isVisible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  position?: "top" | "bottom" | "center";
  delay?: number;
}

export function TutorialTip({
  isVisible,
  title,
  message,
  onDismiss,
  actionLabel,
  onAction,
  position = "bottom",
  delay = 500,
}: TutorialTipProps) {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setShowTip(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setShowTip(false);
    }
  }, [isVisible, delay]);

  const handleDismiss = () => {
    setShowTip(false);
    setTimeout(onDismiss, 200);
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    handleDismiss();
  };

  const positionClasses = {
    top: "top-4 left-4 right-4",
    bottom: "bottom-24 left-4 right-4",
    center: "top-1/2 left-4 right-4 -translate-y-1/2",
  };

  return (
    <AnimatePresence>
      {showTip && (
        <motion.div
          initial={{ opacity: 0, y: position === "top" ? -20 : 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position === "top" ? -20 : 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`fixed ${positionClasses[position]} z-50`}
        >
          <div className="bg-primary text-primary-foreground rounded-lg shadow-xl p-3 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            {/* Close button - larger touch area */}
            <button
              onClick={handleDismiss}
              className="absolute top-0 right-0 p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-2 relative">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex-1 pr-4">
                <h4 className="font-semibold text-xs mb-0.5">{title}</h4>
                <p className="text-xs opacity-90 leading-snug">{message}</p>
                
                {actionLabel && onAction && (
                  <Button
                    onClick={handleAction}
                    variant="secondary"
                    size="sm"
                    className="mt-2 h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    {actionLabel}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
