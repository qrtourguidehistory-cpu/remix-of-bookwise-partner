import { motion } from "framer-motion";

interface MiTurnowLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  variant?: "light" | "dark";
}

/**
 * MiTurnow Dynamic Animated Logo
 * Features a stylized "M" with integrated clock/arrow segment
 * Animation: Arrow segment rotates 90-180° on mount
 */
export default function MiTurnowLogo({
  size = 64,
  className = "",
  animated = true,
  variant = "dark"
}: MiTurnowLogoProps) {
  const primaryColor = variant === "dark" ? "#1a365d" : "#ffffff";
  const accentColor = variant === "dark" ? "#38b2ac" : "#4fd1c5";
  
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Background circle */}
      <motion.circle
        cx="50"
        cy="50"
        r="46"
        fill={primaryColor}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, ease: "backOut" }}
      />
      
      {/* Stylized M letter */}
      <motion.path
        d="M25 75 L25 35 L50 55 L75 35 L75 75"
        fill="none"
        stroke={accentColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      />
      
      {/* Clock segment / Arrow indicator */}
      <motion.g
        initial={{ rotate: animated ? -90 : 0 }}
        animate={{ rotate: 0 }}
        transition={{ 
          duration: 0.8, 
          delay: 0.5, 
          ease: [0.34, 1.56, 0.64, 1] 
        }}
        style={{ transformOrigin: "50px 45px" }}
      >
        {/* Arrow/clock hand */}
        <motion.path
          d="M50 45 L50 28"
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        />
        <motion.circle
          cx="50"
          cy="45"
          r="4"
          fill={accentColor}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.7 }}
        />
        {/* Arrow tip */}
        <motion.path
          d="M46 32 L50 24 L54 32"
          fill="none"
          stroke={accentColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.8 }}
        />
      </motion.g>
      
      {/* Subtle clock arc */}
      <motion.path
        d="M 35 25 A 20 20 0 0 1 65 25"
        fill="none"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
      />
    </motion.svg>
  );
}
