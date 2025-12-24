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
          <div className="bg-primary text-primary-foreground rounded-xl shadow-2xl p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3 relative">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5" />
                </div>
              </div>
              
              <div className="flex-1 pr-6">
                <h4 className="font-semibold text-sm mb-1">{title}</h4>
                <p className="text-sm opacity-90 leading-relaxed">{message}</p>
                
                {actionLabel && onAction && (
                  <Button
                    onClick={handleAction}
                    variant="secondary"
                    size="sm"
                    className="mt-3 bg-white/20 hover:bg-white/30 text-white border-0"
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
