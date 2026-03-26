'use client';

import { useRef, useEffect } from 'react';
import { useMotionValue, animate } from 'motion/react';

/**
 * Animated rating counter that counts up from 0.0 to the target value.
 *
 * Props:
 *   value — the rating to count up to
 *   delay — ms to wait before starting (default 300ms)
 *   prefix — optional prefix like "⭐ " (default none)
 *   suffix — optional suffix like "/10" (default none)
 */
export default function AnimatedRating({
  value,
  delay = 300,
  prefix = '',
  suffix = '',
}: {
  value: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const controls = animate(motionVal, value, {
        duration: 0.8,
        ease: 'easeOut',
        onUpdate: (v) => {
          if (ref.current) ref.current.textContent = `${prefix}${v.toFixed(1)}${suffix}`;
        },
      });
      return () => controls.stop();
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, motionVal, delay, prefix, suffix]);

  return <span ref={ref}>{prefix}0.0{suffix}</span>;
}
