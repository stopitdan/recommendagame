'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Wraps page content with a fade + slide transition on route changes.
 * Uses the pathname as the key so AnimatePresence detects page switches.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
