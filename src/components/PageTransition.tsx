'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';

/**
 * Simple fade-in on route change. No exit animation (which is what
 * caused the jankiness). The new page just fades in smoothly.
 *
 * This works well with Next.js App Router because it doesn't try
 * to hold the old page — it just makes the new page appear nicely.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
