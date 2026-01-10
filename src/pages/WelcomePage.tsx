import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useRef } from "react";
import welcomeImage from "@/assets/welcome-booking.jpg";
import MiTurnowLogo from "@/components/ui/MiTurnowLogo";

export default function WelcomePage() {
  const navigate = useNavigate();
  const handleContinue = () => {
    navigate("/auth/login", {
      replace: true
    });
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    scrollYProgress
  } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Parallax effects
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0.3, 0.7]);
  
  const staggerContainer: Variants = {
    hidden: {
      opacity: 0
    },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };
  
  const fadeInUp: Variants = {
    hidden: {
      opacity: 0,
      y: 30
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Background Image with Parallax */}
      <div className="flex-1 relative">
        <motion.div className="h-full w-full absolute inset-0" style={{
          y: imageY,
          scale: imageScale
        }}>
          <motion.img 
            src={welcomeImage} 
            alt="Gestión de citas profesional" 
            className="w-full h-full object-cover object-center" 
            loading="eager" 
            fetchPriority="high" 
            initial={{
              opacity: 0,
              scale: 1.1
            }} 
            animate={{
              opacity: 1,
              scale: 1
            }} 
            transition={{
              duration: 1.5,
              ease: "easeOut"
            }} 
          />
          {/* Dynamic overlay with parallax */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" 
            style={{
              opacity: overlayOpacity
            }} 
          />
        </motion.div>

        {/* Animated particles/sparkles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div 
              key={i} 
              className="absolute w-2 h-2 bg-white/30 rounded-full blur-[1px]" 
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + i % 3 * 20}%`
              }} 
              animate={{
                y: [-20, 20, -20],
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.2, 1]
              }} 
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3
              }} 
            />
          ))}
        </div>

        {/* Logo y nombre - Ajustado para safe area */}
        <motion.div 
          className="absolute top-4 left-6 z-30 pt-[max(env(safe-area-inset-top),0.5rem)]" 
          variants={staggerContainer} 
          initial="hidden" 
          animate="show"
        >
          <motion.div 
            className="flex items-center gap-3 mb-2"
            variants={fadeInUp}
          >
            <MiTurnowLogo size={48} variant="light" animated />
          </motion.div>
          <motion.h1 
            className="text-5xl md:text-6xl font-black text-white tracking-tight" 
            variants={fadeInUp} 
            style={{
              textShadow: "0 4px 20px rgba(0,0,0,0.5)"
            }}
          >
            MiTurnow
          </motion.h1>
          <motion.p 
            className="text-white/70 text-sm mt-3 font-medium tracking-wide" 
            variants={fadeInUp}
          >
            Gestión inteligente de citas
          </motion.p>
        </motion.div>

        {/* Skip button - Ajustado para safe area */}
        <motion.div 
          className="absolute top-4 right-6 z-30 pt-[max(env(safe-area-inset-top),0.5rem)]" 
          initial={{
            opacity: 0,
            x: 20
          }} 
          animate={{
            opacity: 1,
            x: 0
          }} 
          transition={{
            delay: 0.8,
            duration: 0.5
          }}
        >
          <Button 
            variant="secondary" 
            size="sm" 
            className="rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white hover:bg-white/25 shadow-xl transition-all hover:scale-105" 
            onClick={handleContinue}
          >
            Omitir
          </Button>
        </motion.div>
      </div>

      {/* Content Section with stagger animations */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 p-6 pb-safe bg-gradient-to-t from-background via-background/98 to-transparent pt-28 z-20" 
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 2.5rem)'
        }} 
        initial={{
          opacity: 0,
          y: 60
        }} 
        animate={{
          opacity: 1,
          y: 0
        }} 
        transition={{
          duration: 0.8,
          delay: 0.5,
          ease: "easeOut"
        }}
      >
        <motion.div 
          initial={{
            opacity: 0,
            y: 20,
            scale: 0.95
          }} 
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }} 
          transition={{
            delay: 0.9,
            duration: 0.5
          }} 
          whileHover={{
            scale: 1.02
          }} 
          whileTap={{
            scale: 0.98
          }}
        >
          <Button 
            size="lg" 
            className="w-full justify-between text-lg py-6 rounded-xl shadow-xl hover:shadow-2xl transition-all group mb-safe" 
            onClick={handleContinue}
          >
            <span>Continuar</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
