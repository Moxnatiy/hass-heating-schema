// The sheet's view: pan offset and zoom, and the mapping to screen pixels.
//
// A point of the drawing (x, y) shows at (x · k + view.x, y · k + view.y)
// pixels from the sheet's top left corner.

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4;

/** The drawing point under a screen point. */
export function screenToWorld(view, rect, clientX, clientY) {
  return { x: (clientX - rect.left - view.x) / view.k, y: (clientY - rect.top - view.y) / view.k };
}

/** A view zoomed by factor about a screen point of the sheet. */
export function zoomed(view, factor, sx, sy) {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  return {
    k,
    x: sx - ((sx - view.x) * k) / view.k,
    y: sy - ((sy - view.y) * k) / view.k,
  };
}

/**
 * A view that shows a box of the drawing whole, centred, with a margin for
 * labels. Never zooms in beyond 150 %: a single element should not fill the
 * screen.
 */
export function fitted(box, width, height, margin = 60) {
  const scale = Math.min((width - margin * 2) / Math.max(box.w, 200), (height - margin * 2) / Math.max(box.h, 150));
  const k = Math.min(1.5, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)));
  return { k, x: width / 2 - (box.x + box.w / 2) * k, y: height / 2 - (box.y + box.h / 2) * k };
}
