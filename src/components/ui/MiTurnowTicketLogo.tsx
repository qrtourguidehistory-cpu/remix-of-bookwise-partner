import { motion } from "framer-motion";

interface MiTurnowTicketLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  variant?: "light" | "dark";
}

/**
 * MiTurnow Ticket Logo
 * Features a stylized ticket shape like a ticket machine
 * Animation: Ticket "prints" on mount
 */
export default function MiTurnowTicketLogo({
  size = 64,
  className = "",
  animated = true,
  variant = "dark"
}: MiTurnowTicketLogoProps) {
  const primaryColor = variant === "dark" ? "#1a365d" : "#ffffff";
  const accentColor = variant === "dark" ? "#38b2ac" : "#4fd1c5";
  const ticketBg = variant === "dark" ? "#ffffff" : "#1a365d";
  const textColor = variant === "dark" ? "#1a365d" : "#ffffff";

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      initial={animated ? { opacity: 0, scale: 0.8 } : undefined}
      animate={animated ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill={primaryColor} />
      
      {/* Ticket shape with perforated edge */}
      <motion.g
        initial={animated ? { y: -10, opacity: 0 } : undefined}
        animate={animated ? { y: 0, opacity: 1 } : undefined}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      >
        {/* Main ticket body */}
        <rect
          x="18"
          y="14"
          width="28"
          height="36"
          rx="3"
          fill={ticketBg}
        />
        
        {/* Perforated line (semi-circles on sides) */}
        <circle cx="18" cy="28" r="3" fill={primaryColor} />
        <circle cx="46" cy="28" r="3" fill={primaryColor} />
        
        {/* Dotted line across ticket */}
        <line
          x1="22"
          y1="28"
          x2="42"
          y2="28"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        
        {/* Turn number */}
        <text
          x="32"
          y="23"
          textAnchor="middle"
          fill={textColor}
          fontSize="8"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          TURNO
        </text>
        
        {/* Number with animated entrance */}
        <motion.text
          x="32"
          y="42"
          textAnchor="middle"
          fill={accentColor}
          fontSize="16"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
          animate={animated ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
        >
          01
        </motion.text>
        
        {/* Arrow indicators */}
        <motion.g
          initial={animated ? { opacity: 0 } : undefined}
          animate={animated ? { opacity: 1 } : undefined}
          transition={{ duration: 0.3, delay: 0.7 }}
        >
          <polygon
            points="24,38 26,42 24,46"
            fill={accentColor}
          />
          <polygon
            points="40,38 38,42 40,46"
            fill={accentColor}
          />
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}
