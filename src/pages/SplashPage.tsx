import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import MiTurnowTicketLogo from "@/components/ui/MiTurnowTicketLogo";

// Trigger haptic feedback on native platforms
const triggerHapticFeedback = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.log("[Haptics] Not available:", error);
    }
  }
};

export default function SplashPage({
  shouldRedirect = true
}: {
  shouldRedirect?: boolean;
}) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    // Show text after logo animation
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 1000);

    let timer: NodeJS.Timeout;
    if (shouldRedirect) {
      timer = setTimeout(() => {
        triggerHapticFeedback();
        navigate("/welcome");
      }, 3000);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(textTimer);
      if (timer) clearTimeout(timer);
    };
  }, [navigate, shouldRedirect]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Progress bar at top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-black/10">
        <motion.div
          className="h-full bg-[#1a365d]"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Animated background circles with brand colors */}
      <motion.div
        className="absolute w-96 h-96 rounded-full bg-[#1a365d]/5"
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ scale: 2.5, opacity: 0.2, rotate: 180 }}
        transition={{ duration: 2.5, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-[#38b2ac]/5"
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ scale: 2, opacity: 0.15, rotate: -90 }}
        transition={{ duration: 2, delay: 0.2, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-40 h-40 rounded-full border-2 border-[#1a365d]/10"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 3, opacity: 0.3 }}
        transition={{ duration: 1.8, delay: 0.4, ease: "easeOut" }}
      />

      {/* Logo and Text */}
      <div className="z-10 flex flex-col items-center px-4 relative h-64 w-full justify-center">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "backOut" }}
        >
          {/* Animated Logo */}
          <MiTurnowTicketLogo size={120} animated variant="dark" />
          
          {/* Brand Name */}
          <AnimatePresence>
            {showText && (
              <motion.div
                className="mt-6 flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <motion.h1
                  className="text-4xl md:text-5xl font-black text-[#1a365d] tracking-tight leading-none text-center"
                  initial={{ opacity: 0, letterSpacing: "0.3em" }}
                  animate={{ opacity: 1, letterSpacing: "0em" }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <span className="block">Mí</span>
                  <span className="block">Turnow</span>
                </motion.h1>
                <motion.p
                  className="text-sm text-[#38b2ac] mt-3 font-semibold tracking-[0.3em] uppercase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  partner
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Animated loading indicator with brand colors */}
      <motion.div
        className="absolute bottom-20 flex gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-[#1a365d]"
            animate={{
              y: [0, -12, 0],
              scale: [1, 1.3, 1],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </motion.div>

      {/* Decorative corner elements with brand accent */}
      <motion.div
        className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-[#38b2ac]/30"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      />
      <motion.div
        className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-[#38b2ac]/30"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      />
    </div>
  );
}
