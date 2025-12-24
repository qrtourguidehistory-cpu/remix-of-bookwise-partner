import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function SplashPage({ shouldRedirect = true }: { shouldRedirect?: boolean }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    let timer: NodeJS.Timeout;
    
    if (shouldRedirect) {
      timer = setTimeout(() => {
        navigate("/welcome");
      }, 2500);
    }

    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [navigate, shouldRedirect]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Progress bar at top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
        <motion.div
          className="h-full bg-white"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Animated background circles - blancos para destacar el texto */}
      <motion.div
        className="absolute w-96 h-96 rounded-full bg-white/20"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 2.5, opacity: 0.2 }}
        transition={{ duration: 2, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-white/15"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 2, opacity: 0.15 }}
        transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
      />

      {/* Logo y Slogan */}
      <motion.div
        className="z-10 flex flex-col items-center px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <motion.h1
          className="text-5xl md:text-7xl font-bold text-white"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          BookWise
        </motion.h1>
        <motion.h2
          className="text-3xl md:text-5xl font-bold text-white mt-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Partner
        </motion.h2>
        <motion.p
          className="text-lg md:text-xl text-white/70 mt-6 text-center max-w-md font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          Administra la agenda de tu negocio sin problema
        </motion.p>
      </motion.div>

      {/* Pulsing dots at bottom */}
      <motion.div
        className="absolute bottom-20 flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-white/40"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
