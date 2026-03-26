'use client';

import { useRef, useEffect } from 'react';

/**
 * Thin colored progress bar fixed at the top of the viewport.
 * Fills as the user scrolls. Uses direct DOM manipulation for
 * zero-latency updates (no React state → no re-render delay).
 */
export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    function update() {
      if (!barRef.current) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      barRef.current.style.transform = `scaleX(${progress})`;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update(); // Initial
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        ref={barRef}
        style={{
          height: '100%',
          width: '100%',
          background: 'linear-gradient(90deg, #5B4FDB, #FF6D3F)',
          transformOrigin: 'left',
          transform: 'scaleX(0)',
          borderRadius: '0 2px 2px 0',
          // No CSS transition — scaleX is updated directly via rAF for instant response
        }}
      />
    </div>
  );
}
