/**
 * Camera controller for zoom/pan/pinch on the game map.
 * Manages viewport transform and provides smooth flyTo animation.
 */

import type { ViewportState } from './types';

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;
const ZOOM_SPEED = 0.001;
const INERTIA_DECAY = 0.92;
const FLY_DURATION = 800; // ms

type OnChange = (state: ViewportState) => void;

export class CameraController {
  state: ViewportState = { x: 5000, y: 5000, zoom: 0.15 };

  private canvas: HTMLElement;
  private onChange: OnChange;
  private dragging = false;
  private lastMouse = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0 };
  private inertiaRaf: number | null = null;
  private flyRaf: number | null = null;

  // Pinch state
  private pinchStartDist = 0;
  private pinchStartZoom = 0;

  constructor(canvas: HTMLElement, onChange: OnChange) {
    this.canvas = canvas;
    this.onChange = onChange;

    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });

    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd);
  }

  destroy() {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    if (this.inertiaRaf) cancelAnimationFrame(this.inertiaRaf);
    if (this.flyRaf) cancelAnimationFrame(this.flyRaf);
  }

  /** Smooth animated transition to a world position */
  flyTo(x: number, y: number, zoom: number) {
    if (this.flyRaf) cancelAnimationFrame(this.flyRaf);

    const start = { ...this.state };
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / FLY_DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

      this.state = {
        x: start.x + (x - start.x) * ease,
        y: start.y + (y - start.y) * ease,
        zoom: start.zoom + (zoom - start.zoom) * ease,
      };
      this.onChange(this.state);

      if (t < 1) {
        this.flyRaf = requestAnimationFrame(animate);
      }
    };

    this.flyRaf = requestAnimationFrame(animate);
  }

  /**
   * Fly to a position and zoom level that fits a given world-space radius
   * into the viewport with some padding.
   */
  flyToFit(cx: number, cy: number, worldRadius: number) {
    const rect = this.canvas.getBoundingClientRect();
    const screenSize = Math.min(rect.width, rect.height);
    // Fit the diameter into ~75% of the smaller screen dimension
    const targetZoom = screenSize / (worldRadius * 2.5);
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    this.flyTo(cx, cy, clampedZoom);
  }

  /** Convert screen coords to world coords */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: this.state.x + (screenX - cx) / this.state.zoom,
      y: this.state.y + (screenY - cy) / this.state.zoom,
    };
  }

  // ─── Wheel zoom ─────────────────────────────────────

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom centered on mouse position
    const worldBefore = this.screenToWorld(mouseX, mouseY);

    const delta = -e.deltaY * ZOOM_SPEED;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.state.zoom * (1 + delta)));
    this.state.zoom = newZoom;

    // Adjust pan so the point under the mouse stays fixed
    const worldAfter = this.screenToWorld(mouseX, mouseY);
    this.state.x -= worldAfter.x - worldBefore.x;
    this.state.y -= worldAfter.y - worldBefore.y;

    this.onChange(this.state);
  };

  // ─── Mouse drag ─────────────────────────────────────

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // left click only
    this.dragging = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.velocity = { x: 0, y: 0 };
    if (this.inertiaRaf) cancelAnimationFrame(this.inertiaRaf);
    this.canvas.style.cursor = 'grabbing';
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;

    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;

    this.state.x -= dx / this.state.zoom;
    this.state.y -= dy / this.state.zoom;

    this.velocity = { x: dx, y: dy };
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.onChange(this.state);
  };

  private handleMouseUp = () => {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.style.cursor = 'grab';
    this.startInertia();
  };

  private startInertia() {
    const decay = () => {
      if (Math.abs(this.velocity.x) < 0.5 && Math.abs(this.velocity.y) < 0.5) return;

      this.state.x -= this.velocity.x / this.state.zoom;
      this.state.y -= this.velocity.y / this.state.zoom;
      this.velocity.x *= INERTIA_DECAY;
      this.velocity.y *= INERTIA_DECAY;
      this.onChange(this.state);

      this.inertiaRaf = requestAnimationFrame(decay);
    };
    this.inertiaRaf = requestAnimationFrame(decay);
  }

  // ─── Touch (pinch + drag) ──────────────────────────

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinchStartDist = Math.hypot(dx, dy);
      this.pinchStartZoom = this.state.zoom;
    } else if (e.touches.length === 1) {
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.dragging = true;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / this.pinchStartDist;
      this.state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinchStartZoom * scale));
      this.onChange(this.state);
    } else if (e.touches.length === 1 && this.dragging) {
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.state.x -= dx / this.state.zoom;
      this.state.y -= dy / this.state.zoom;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.onChange(this.state);
    }
  };

  private handleTouchEnd = () => {
    this.dragging = false;
  };
}
