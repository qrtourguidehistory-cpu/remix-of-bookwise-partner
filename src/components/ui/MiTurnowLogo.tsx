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
      viewBox="0 0 64 64"
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill={primaryColor} />
      
      {/* Stylized M */}
      <path
        d="M16 48 L16 20 L32 36 L48 20 L48 48"
        stroke={accentColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Clock segment / Arrow indicator */}
      <motion.g
        initial={animated ? { rotate: 0 } : undefined}
        animate={animated ? { rotate: 135 } : undefined}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        style={{ transformOrigin: "32px 32px" }}
      >
        <circle cx="32" cy="32" r="8" fill="none" stroke={accentColor} strokeWidth="2" />
        <line
          x1="32"
          y1="32"
          x2="32"
          y2="24"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.g>
    </motion.svg>
  );
}