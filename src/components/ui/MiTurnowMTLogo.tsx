import { motion } from "framer-motion";

interface MiTurnowMTLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * MiTurnow MT Logo
 * Uses the official logo image from public folder
 */
export default function MiTurnowMTLogo({
  size = 64,
  className = "",
  animated = false
}: MiTurnowMTLogoProps) {
  const logoImage = "/ChatGPT Image 19 ene 2026, 11_56_27 a.m..png";
  
  if (!animated) {
    return (
      <img
        src={logoImage}
        alt="Mí Turnow"
        width={size}
        height={size}
        className={className}
        style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
      />
    );
  }

  return (
    <motion.img
      src={logoImage}
      alt="Mí Turnow"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    />
  );
}
