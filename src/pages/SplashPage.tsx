import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import bookwiseLogo from "@/assets/bookwise-logo.png";

export default function SplashPage({
  shouldRedirect = true
}: {
  shouldRedirect?: boolean;
}) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [showLogo, setShowLogo] = useState(true);

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

    // Transition from logo to text after delay
    const logoTimer = setTimeout(() => {
      setShowLogo(false);
    }, 1200);

    let timer: NodeJS.Timeout;
    if (shouldRedirect) {
      timer = setTimeout(() => {
        navigate("/welcome");
      }, 3000);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(logoTimer);
      if (timer) clearTimeout(timer);
    };
  }, [navigate, shouldRedirect]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Progress bar at top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-black/10">
        <motion.div
          className="h-full bg-black"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Animated background circles with stagger */}
      <motion.div
        className="absolute w-96 h-96 rounded-full bg-black/5"
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ scale: 2.5, opacity: 0.2, rotate: 180 }}
        transition={{ duration: 2.5, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-black/5"
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ scale: 2, opacity: 0.15, rotate: -90 }}
        transition={{ duration: 2, delay: 0.2, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-40 h-40 rounded-full border-2 border-black/10"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 3, opacity: 0.3 }}
        transition={{ duration: 1.8, delay: 0.4, ease: "easeOut" }}
      />

      {/* Logo and Text with AnimatePresence */}
      <div className="z-10 flex flex-col items-center px-4 relative h-64 w-full justify-center">
        <AnimatePresence mode="wait">
          {showLogo ? (
            <motion.div
              key="logo"
              className="absolute flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.3, rotateY: -180 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                rotateY: 0,
              }}
              exit={{ 
                opacity: 0, 
                scale: 1.5, 
                rotateY: 180,
                filter: "blur(10px)"
              }}
              transition={{ 
                duration: 0.8, 
                ease: [0.34, 1.56, 0.64, 1],
              }}
            >
              <motion.img
                src={bookwiseLogo}
                alt="BookWise Logo"
                className="w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-2xl"
                animate={{ 
                  boxShadow: [
                    "0 0 0 0 rgba(0,0,0,0)",
                    "0 0 60px 10px rgba(0,0,0,0.15)",
                    "0 0 0 0 rgba(0,0,0,0)"
                  ]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="text"
              className="absolute flex flex-col items-center"
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                duration: 0.6,
                ease: [0.34, 1.56, 0.64, 1]
              }}
            >
              <motion.h1
                className="text-5xl md:text-7xl font-bold text-black"
                initial={{ opacity: 0, letterSpacing: "0.5em" }}
                animate={{ opacity: 1, letterSpacing: "0em" }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                BookWise
              </motion.h1>
              <motion.h2
                className="text-3xl md:text-5xl font-bold text-black mt-1"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                Partner
              </motion.h2>
              <motion.p
                className="text-lg md:text-xl text-black/60 mt-6 text-center max-w-md font-medium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                Administra la agenda de tu negocio sin problema
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Animated loading indicator with wave effect */}
      <motion.div
        className="absolute bottom-20 flex gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-black"
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

      {/* Decorative corner elements */}
      <motion.div
        className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-black/20"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      />
      <motion.div
        className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-black/20"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      />
    </div>
  );
}