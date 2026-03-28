'use client';

/**
 * Accessible skip-to-main-content link.
 * Visually hidden until focused, then appears as a floating button.
 */
export default function SkipNav() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
      onFocus={(e) => {
        Object.assign(e.currentTarget.style, {
          position: 'fixed',
          left: '16px',
          top: '16px',
          width: 'auto',
          height: 'auto',
          overflow: 'visible',
          zIndex: '9999',
          padding: '12px 24px',
          background: '#5B4FDB',
          color: '#fff',
          borderRadius: '8px',
          fontWeight: '700',
          textDecoration: 'none',
        });
      }}
      onBlur={(e) => {
        Object.assign(e.currentTarget.style, {
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        });
      }}
    >
      Skip to main content
    </a>
  );
}
