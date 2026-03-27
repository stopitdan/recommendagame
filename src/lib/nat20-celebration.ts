/**
 * Epic Nat 20 Celebration — a layered 4.5-second spectacle.
 *
 * Timeline:
 * 0ms     — Full-screen golden radial flash (fades 1.2s)
 * 0ms     — Big confetti burst (150 particles, center)
 * 100ms   — Left cannon (80 particles)
 * 200ms   — Right cannon (80 particles)
 * 300ms   — Star-shaped confetti wave
 * 500ms   — Second burst (100 particles, wider, more colors)
 * 800ms   — Orbiting gold particle ring (12 CSS-animated dots, 2.5s)
 * 1500ms  — Lingering confetti (60 particles, low gravity, slow fall)
 * 3000ms  — Final sparkle (40 gold particles, low velocity)
 */

/** Inject the golden flash overlay */
function triggerGoldenFlash(): void {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed; inset: 0; z-index: 9998;
    background: radial-gradient(ellipse at center, rgba(255,215,0,0.5), rgba(255,180,0,0.2) 40%, transparent 70%);
    pointer-events: none;
    animation: nat20-flash 1.2s ease-out forwards;
  `;

  if (!document.getElementById('nat20-flash-style')) {
    const style = document.createElement('style');
    style.id = 'nat20-flash-style';
    style.textContent = `
      @keyframes nat20-flash {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1300);
}

/** Create 12 orbiting gold dots around viewport center */
function triggerOrbitingRing(): void {
  if (!document.getElementById('nat20-orbit-style')) {
    const style = document.createElement('style');
    style.id = 'nat20-orbit-style';
    style.textContent = `
      @keyframes nat20-orbit {
        0% { transform: rotate(0deg) translateX(80px) rotate(0deg); opacity: 1; }
        80% { opacity: 1; }
        100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); opacity: 0; }
      }
      @keyframes nat20-dot-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.5); }
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    pointer-events: none; overflow: hidden;
  `;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('div');
    const angle = (i / 12) * 360;
    const size = 6 + Math.random() * 4;
    dot.style.cssText = `
      position: absolute;
      left: ${cx - size / 2}px;
      top: ${cy - size / 2}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: radial-gradient(circle, #FFD700, #FFA500);
      box-shadow: 0 0 8px #FFD700, 0 0 16px rgba(255,215,0,0.4);
      animation:
        nat20-orbit 2.5s ${i * 0.08}s ease-out forwards,
        nat20-dot-pulse 0.5s ${i * 0.08}s ease-in-out infinite;
      transform-origin: center center;
      rotate: ${angle}deg;
    `;
    container.appendChild(dot);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 3500);
}

/** Star-shaped confetti path for canvas-confetti shapeFromPath */
const STAR_PATH = 'M12 0 L15 9 L24 9 L17 14 L19 24 L12 18 L5 24 L7 14 L0 9 L9 9 Z';

/**
 * Fires the full epic Nat 20 celebration sequence.
 * Dynamically imports canvas-confetti for tree-shaking.
 */
export async function triggerEpicNat20(): Promise<void> {
  const confetti = (await import('canvas-confetti')).default;

  // 0ms — Golden flash overlay
  triggerGoldenFlash();

  // 0ms — Big confetti burst from center
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.5 },
    colors: ['#FFD700', '#5B4FDB', '#FF6D3F', '#00E5A0', '#FF4081'],
    startVelocity: 50,
    gravity: 0.8,
    ticks: 250,
  });

  // 100ms — Left cannon
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#5B4FDB', '#FF6D3F'],
      startVelocity: 45,
    });
  }, 100);

  // 200ms — Right cannon
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#5B4FDB', '#FF6D3F'],
      startVelocity: 45,
    });
  }, 200);

  // 300ms — Star-shaped confetti wave
  setTimeout(() => {
    let starShape: ReturnType<typeof confetti.shapeFromPath> | undefined;
    try {
      starShape = confetti.shapeFromPath({ path: STAR_PATH });
    } catch {
      // Fallback: shapeFromPath may not be available in all versions
    }
    confetti({
      particleCount: 60,
      spread: 160,
      origin: { y: 0.5 },
      colors: ['#FFD700', '#FFC107', '#FFE082'],
      startVelocity: 35,
      ticks: 200,
      shapes: starShape ? [starShape] : ['circle'],
      scalar: 1.2,
    });
  }, 300);

  // 500ms — Second burst (wider, more colors)
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 140,
      origin: { y: 0.4 },
      colors: ['#FFD700', '#FF4081', '#00E5A0', '#5B4FDB', '#FF6D3F', '#E040FB'],
      startVelocity: 40,
      ticks: 200,
    });
  }, 500);

  // 800ms — Orbiting gold particle ring
  setTimeout(() => {
    triggerOrbitingRing();
  }, 800);

  // 1500ms — Lingering confetti (low gravity, slow fall)
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 180,
      origin: { y: 0.3 },
      colors: ['#FFD700', '#FFA500', '#FFFACD', '#FFE082'],
      gravity: 0.4,
      startVelocity: 20,
      ticks: 300,
      drift: 0.5,
    });
  }, 1500);

  // 3000ms — Final sparkle (gold particles, low velocity)
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#FFD700', '#FFC107', '#FFE082', '#FFFFFF'],
      startVelocity: 15,
      gravity: 0.6,
      ticks: 200,
      scalar: 0.8,
    });
  }, 3000);
}
