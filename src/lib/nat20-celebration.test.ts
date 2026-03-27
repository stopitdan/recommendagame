/**
 * Tests for the epic Nat 20 celebration system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock canvas-confetti
const mockShapeFromPath = vi.fn(() => ({ type: 'path' }));
const mockConfetti = Object.assign(vi.fn(), { shapeFromPath: mockShapeFromPath });

vi.mock('canvas-confetti', () => ({
  default: mockConfetti,
}));

import { triggerEpicNat20 } from './nat20-celebration';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  // Clean up DOM from previous tests
  document.querySelectorAll('[id^="nat20-"]').forEach((el) => el.remove());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('triggerEpicNat20', () => {
  it('fires initial confetti burst immediately', async () => {
    const promise = triggerEpicNat20();
    await promise;

    // First call is the immediate center burst
    expect(mockConfetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      }),
    );
  });

  it('injects golden flash overlay into DOM', async () => {
    await triggerEpicNat20();

    // Flash style should be injected
    expect(document.getElementById('nat20-flash-style')).toBeTruthy();
  });

  it('fires left and right cannons after delays', async () => {
    await triggerEpicNat20();

    // Advance past left cannon (100ms)
    vi.advanceTimersByTime(100);
    const leftCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.angle === 60 && call[0]?.origin?.x === 0,
    );
    expect(leftCall).toBeTruthy();

    // Advance past right cannon (200ms)
    vi.advanceTimersByTime(100);
    const rightCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.angle === 120 && call[0]?.origin?.x === 1,
    );
    expect(rightCall).toBeTruthy();
  });

  it('fires star-shaped confetti at 300ms', async () => {
    await triggerEpicNat20();
    vi.advanceTimersByTime(300);

    const starCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.scalar === 1.2 && call[0]?.spread === 160,
    );
    expect(starCall).toBeTruthy();
  });

  it('attempts to create star shape from path', async () => {
    await triggerEpicNat20();
    vi.advanceTimersByTime(300);

    expect(mockShapeFromPath).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('M12 0') }),
    );
  });

  it('fires second burst at 500ms with wider spread', async () => {
    await triggerEpicNat20();
    vi.advanceTimersByTime(500);

    const wideCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.particleCount === 100 && call[0]?.spread === 140,
    );
    expect(wideCall).toBeTruthy();
  });

  it('creates orbiting ring at 800ms', async () => {
    await triggerEpicNat20();
    vi.advanceTimersByTime(800);

    expect(document.getElementById('nat20-orbit-style')).toBeTruthy();
  });

  it('fires lingering confetti at 1500ms with low gravity', async () => {
    await triggerEpicNat20();
    vi.advanceTimersByTime(1500);

    const lingerCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.gravity === 0.4 && call[0]?.particleCount === 60,
    );
    expect(lingerCall).toBeTruthy();
  });

  it('fires final sparkle at 3000ms with low velocity', async () => {
    await triggerEpicNat20();
    vi.advanceTimersByTime(3000);

    const sparkleCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.particleCount === 40 && call[0]?.startVelocity === 15,
    );
    expect(sparkleCall).toBeTruthy();
  });

  it('does not inject duplicate styles on multiple calls', async () => {
    await triggerEpicNat20();
    await triggerEpicNat20();

    const flashStyles = document.querySelectorAll('#nat20-flash-style');
    expect(flashStyles.length).toBe(1);
  });

  it('gracefully handles shapeFromPath failure', async () => {
    mockShapeFromPath.mockImplementationOnce(() => {
      throw new Error('Not supported');
    });

    await triggerEpicNat20();
    vi.advanceTimersByTime(300);

    // Should still fire confetti with 'circle' fallback
    const starCall = mockConfetti.mock.calls.find(
      (call) => call[0]?.spread === 160,
    );
    expect(starCall).toBeTruthy();
    expect(starCall![0].shapes).toEqual(['circle']);
  });
});
