'use client';

import { ReactLenis } from 'lenis/react';
import type { LenisRef } from 'lenis/react';
import { useEffect, useRef } from 'react';
import { cancelFrame, frame } from 'motion/react';

/**
 * Global smooth scrolling via Lenis.
 *
 * Wraps the entire app with physics-based smooth scrolling.
 * Uses `root` prop to attach to the <html> element (no wrapper divs).
 * Synced with framer-motion's frame loop for jank-free animations.
 *
 * MUI modals, drawers, dialogs, and select dropdowns are excluded
 * from smooth scrolling via the `prevent` callback.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  // Sync Lenis with framer-motion's frame loop
  useEffect(() => {
    function update(data: { timestamp: number }) {
      lenisRef.current?.lenis?.raf(data.timestamp);
    }
    frame.update(update, true);
    return () => cancelFrame(update);
  }, []);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        autoRaf: false,
        lerp: 0.1,
        smoothWheel: true,
        anchors: true,
        prevent: (node) => {
          // Let MUI overlays scroll natively
          return node.closest(
            '.MuiModal-root, .MuiDrawer-root, .MuiDialog-root, .MuiPopover-root, .MuiMenu-root, .MuiAutocomplete-popper'
          ) !== null;
        },
      }}
    >
      {children}
    </ReactLenis>
  );
}
