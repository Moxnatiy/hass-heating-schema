// Moving the view: pan with a drag, zoom with a pinch or Ctrl + wheel.

import { MIN_ZOOM, MAX_ZOOM } from "../view.js";

/** Drag the sheet. */
export function pan(canvas, e) {
  const start = { x: e.clientX, y: e.clientY, view: { ...canvas.view } };
  canvas.svg.classList.add("hs-panning");
  return {
    move(ev) {
      canvas.setView({
        ...start.view,
        x: start.view.x + (ev.clientX - start.x),
        y: start.view.y + (ev.clientY - start.y),
      });
    },
    end() {
      canvas.svg.classList.remove("hs-panning");
    },
    cancel() {
      canvas.svg.classList.remove("hs-panning");
    },
  };
}

/** Two fingers: zoom about their midpoint and follow it. */
export function pinch(canvas, pointers) {
  const [a, b] = [...pointers.values()];
  const start = {
    distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    view: { ...canvas.view },
  };
  return {
    pinch: true,
    move() {
      if (pointers.size < 2) return;
      const [p, q] = [...pointers.values()];
      const distance = Math.hypot(p.x - q.x, p.y - q.y) || 1;
      const centre = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      const rect = canvas.svg.getBoundingClientRect();
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (start.view.k * distance) / start.distance));
      const sx = start.centre.x - rect.left;
      const sy = start.centre.y - rect.top;
      canvas.setView({
        k,
        x: sx - ((sx - start.view.x) * k) / start.view.k + (centre.x - start.centre.x),
        y: sy - ((sy - start.view.y) * k) / start.view.k + (centre.y - start.centre.y),
      });
    },
    end() {},
    cancel() {},
  };
}

/** The wheel pans, as on a trackpad; with Ctrl (or a pinch on one) it zooms. */
export function wheel(canvas, e) {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    canvas.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
  } else {
    canvas.setView({ ...canvas.view, x: canvas.view.x - e.deltaX, y: canvas.view.y - e.deltaY });
  }
}
