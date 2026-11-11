// Grid, rotation and the mapping between an element's own coordinates and the
// drawing's.
//
// Every element is drawn in its own box, origin at the top left, and placed by
// the position of that corner. Rotation and mirroring turn the box about its
// centre. Element sizes are multiples of twice the grid, so the centre lies on
// the grid and a rotated element's ports stay on it: pipes between aligned
// ports then run dead straight.

export const GRID = 10;

export const snap = (value, step = GRID) => Math.round(value / step) * step;

const SIDES = ["t", "r", "b", "l"];
const VECTORS = { t: [0, -1], r: [1, 0], b: [0, 1], l: [-1, 0] };

/** The unit vector pointing out of a side. */
export const sideVector = (side) => VECTORS[side] || [0, 0];

/**
 * The sizes an element may be drawn at. An element keeps its own box and
 * ports; the scale only stretches them about the box's corner, so its ports
 * may leave the grid, and pipes still end exactly on them.
 */
export const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** An element's scale, 1 when none is set. */
export const scaleOf = (node) => node.scale || 1;

/** A point of the element's box, in drawing coordinates. */
export function toWorld(node, def, x, y) {
  const s = scaleOf(node);
  const cx = def.w / 2;
  const cy = def.h / 2;
  let dx = (x - cx) * s;
  let dy = (y - cy) * s;
  if (node.flip) dx = -dx;
  if (node.flip_y) dy = -dy;
  const turns = ((node.rotation || 0) / 90) % 4;
  for (let i = 0; i < turns; i += 1) [dx, dy] = [-dy, dx];
  return { x: node.x + cx * s + dx, y: node.y + cy * s + dy };
}

/** The side a port faces once the element is mirrored and rotated. */
export function worldSide(node, side) {
  let s = side;
  if (node.flip && (s === "l" || s === "r")) s = s === "l" ? "r" : "l";
  if (node.flip_y && (s === "t" || s === "b")) s = s === "t" ? "b" : "t";
  const turns = ((node.rotation || 0) / 90) % 4;
  return SIDES[(SIDES.indexOf(s) + turns) % 4];
}

/** The element's box in drawing coordinates, after rotation. */
export function worldBox(node, def) {
  const corners = [
    toWorld(node, def, 0, 0),
    toWorld(node, def, def.w, def.h),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.abs(xs[1] - xs[0]),
    h: Math.abs(ys[1] - ys[0]),
  };
}

/** The SVG transform that draws the element's own box in place. */
export function nodeTransform(node, def) {
  const cx = def.w / 2;
  const cy = def.h / 2;
  // Applied right to left: mirror, turn about the centre, scale, place.
  const parts = [`translate(${node.x} ${node.y})`];
  if (scaleOf(node) !== 1) parts.push(`scale(${scaleOf(node)})`);
  if (node.rotation) parts.push(`rotate(${node.rotation} ${cx} ${cy})`);
  if (node.flip) parts.push(`translate(${def.w} 0) scale(-1 1)`);
  if (node.flip_y) parts.push(`translate(0 ${def.h}) scale(1 -1)`);
  return parts.join(" ");
}

export function boxesIntersect(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Distance from a point to a segment, for picking a pipe under the pointer. */
export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(p.x - x, p.y - y);
}
