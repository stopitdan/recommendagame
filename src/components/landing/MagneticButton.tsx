'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion, useSpring } from 'motion/react';

/**
 * A button wrapper that creates a magnetic effect —
 * the button subtly moves toward the cursor when nearby.
 */
export default function MagneticButton({
  children,
  strength = 0.3,
  radius = 150,
}: {
  children: ReactNode;
  strength?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 150, damping: 15 });
  const y = useSpring(0, { stiffness: 150, damping: 15 });
  const scale = useSpring(1, { stiffness: 300, damping: 20 });
  const [active, setActive] = useState(false);

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < radius) {
      x.set(dx * strength);
      y.set(dy * strength);
      if (!active) {
        scale.set(1.05);
        setActive(true);
      }
    } else {
      x.set(0);
      y.set(0);
      scale.set(1);
      setActive(false);
    }
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
    scale.set(1);
    setActive(false);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y, scale, display: 'inline-block' }}
    >
      {children}
    </motion.div>
  );
}
