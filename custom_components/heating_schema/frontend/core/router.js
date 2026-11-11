// Pipe paths: right angles only, as pipes are laid.
//
// A pipe leaves a port straight out of the side it faces, for one stub, and
// arrives the same way. In between it either follows the bends the user
// placed, joined by right angles, or the router picks the best of a few
// simple shapes: an L, a Z with its middle leg halfway, or a U round the
// elements it joins. Shapes that turn back into an element or cut through one
// score worse.

import { sideVector, snap, GRID } from "./geometry.js";

export const STUB = 2 * GRID;

const same = (a, b) => a.x === b.x && a.y === b.y;

/** The start and end of a route: the port, and the end of its stub. */
function ends(start, end) {
  const [sx, sy] = sideVector(start.side);
  const [ex, ey] = sideVector(end.side);
  return {
    s0: { x: start.x, y: start.y },
    s1: { x: start.x + sx * STUB, y: start.y + sy * STUB },
    e1: { x: end.x + ex * STUB, y: end.y + ey * STUB },
    e0: { x: end.x, y: end.y },
    ds: [sx, sy],
    de: [ex, ey],
  };
}

/**
 * The route of a pipe as a list of points, ports included.
 *
 * start, end: { x, y, side } in drawing coordinates.
 * bends: the user's points, [[x, y], …], or empty for an automatic route.
 * obstacles: element boxes to keep clear of.
 */
export function route(start, end, bends = [], obstacles = []) {
  const { s0, s1, e1, e0, ds, de } = ends(start, end);
  if (bends.length) {
    const middle = [s1];
    let dir = ds;
    const targets = [...bends.map(([x, y]) => ({ x, y })), e1];
    targets.forEach((next, i) => {
      // The leg into the end stub must not run away from the port and back.
      const avoidLast = i === targets.length - 1 ? de : null;
      const corner = elbow(middle[middle.length - 1], next, dir, avoidLast);
      if (corner) {
        middle.push(corner);
        dir = direction(corner, next) || dir;
      } else {
        dir = direction(middle[middle.length - 1], next) || dir;
      }
      middle.push(next);
    });
    return withStubs(s0, middle, e0);
  }
  const best = candidates(s1, e1, obstacles)
    .map((middle) => {
      const points = withStubs(s0, [s1, ...middle, e1], e0);
      return { points, score: score(points, ds, de, obstacles) };
    })
    .sort((a, b) => a.score - b.score)[0];
  return best.points;
}

/**
 * The route with its ends: the ports, and the ends of their stubs kept as
 * points even where the pipe runs straight on, so the legs between them are
 * always the editable ones (legs(), moveLeg()).
 */
function withStubs(s0, middle, e0) {
  return [s0, ...simplify(middle), e0];
}

/**
 * The corner joining a to b, or null when they are aligned.
 *
 * Of the two corners, the one that turns back on the previous leg (dir), or
 * whose second leg would run along `avoid` into the end stub, is the worse;
 * otherwise the one that carries on straight is preferred.
 */
function elbow(a, b, dir, avoid = null) {
  if (a.x === b.x || a.y === b.y) return null;
  const options = [
    { corner: { x: b.x, y: a.y }, first: [Math.sign(b.x - a.x), 0], second: [0, Math.sign(b.y - a.y)] },
    { corner: { x: a.x, y: b.y }, first: [0, Math.sign(b.y - a.y)], second: [Math.sign(b.x - a.x), 0] },
  ];
  const cost = ({ first, second }) => {
    let c = 0;
    if (first[0] === -dir[0] && first[1] === -dir[1]) c += 10;
    if (avoid && second[0] === avoid[0] && second[1] === avoid[1]) c += 10;
    if (first[0] !== dir[0] || first[1] !== dir[1]) c += 1;
    return c;
  };
  return options.sort((p, q) => cost(p) - cost(q))[0].corner;
}

function candidates(a, b, obstacles = []) {
  const mx = snap((a.x + b.x) / 2);
  const my = snap((a.y + b.y) / 2);
  return [
    ...detours(a, b, obstacles),
    [{ x: b.x, y: a.y }],
    [{ x: a.x, y: b.y }],
    [
      { x: mx, y: a.y },
      { x: mx, y: b.y },
    ],
    [
      { x: a.x, y: my },
      { x: b.x, y: my },
    ],
  ];
}

/**
 * How bad a route is: its length, its bends, turning back over a stub, and
 * above all crossing an element's body. `points` keeps the stub ends (see
 * withStubs), so the legs between them are the ones to check.
 */
function score(points, ds, de, obstacles) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  let penalty = points.length * 15;
  // Turning straight back over the stub runs the pipe into its own element.
  const first = direction(points[1], points[2]);
  if (first && first[0] === -ds[0] && first[1] === -ds[1]) penalty += 400;
  const n = points.length;
  const last = direction(points[n - 3], points[n - 2]);
  if (last && last[0] === de[0] && last[1] === de[1]) penalty += 400;
  // Crossing an element's body is far worse than going round it.
  for (let i = 1; i < n - 2; i += 1) {
    for (const box of obstacles) if (segmentHitsBox(points[i], points[i + 1], box)) penalty += 2000;
  }
  return length + penalty;
}

function direction(a, b) {
  if (!a || !b || same(a, b)) return null;
  return [Math.sign(b.x - a.x), Math.sign(b.y - a.y)];
}

function segmentHitsBox(a, b, box) {
  const pad = 1;
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return x2 > box.x + pad && x1 < box.x + box.w - pad && y2 > box.y + pad && y1 < box.y + box.h - pad;
}

/** Drop repeated points and the middle of straight runs. */
export function simplify(points) {
  const out = [];
  for (const p of points) {
    if (out.length && same(out[out.length - 1], p)) continue;
    out.push({ x: p.x, y: p.y });
  }
  for (let i = out.length - 2; i >= 1; i -= 1) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) out.splice(i, 1);
  }
  return out;
}

/** An SVG path through the points, its corners rounded like bent pipe. */
export function pathData(points, radius = 6) {
  if (points.length < 2) return "";
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const r = Math.min(radius, dist(a, b) / 2, dist(b, c) / 2);
    const p1 = toward(b, a, r);
    const p2 = toward(b, c, r);
    d += ` L${p1.x} ${p1.y} Q${b.x} ${b.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x} ${last.y}`;
}

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function toward(from, to, r) {
  const d = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / d) * r, y: from.y + ((to.y - from.y) / d) * r };
}

/**
 * Move one leg of a route sideways, and return the bends to store.
 *
 * points: the route as drawn; index: the leg from points[index] to
 * points[index + 1]; offset: how far, along the axis the leg can move.
 * The stubs at both ends stay where their ports are, so moving the leg next
 * to one adds a short bend instead of tearing the pipe off the port.
 */
export function moveLeg(points, index, offset) {
  const n = points.length;
  if (index <= 0 || index >= n - 2) return bendsOf(points);
  const a = points[index];
  const b = points[index + 1];
  const vertical = a.x === b.x;
  const shift = (p) => (vertical ? { x: snap(p.x + offset), y: p.y } : { x: p.x, y: snap(p.y + offset) });
  const next = points.slice(0, index);
  if (index === 1) next.push(a);
  next.push(shift(a), shift(b));
  if (index + 1 === n - 2) next.push(b);
  next.push(...points.slice(index + 2));
  return bendsOf(withStubs(next[0], next.slice(1, -1), next[next.length - 1]));
}

/** The bends of a route: everything but the ports and their stub ends. */
export function bendsOf(points) {
  return points.slice(2, -2).map((p) => [p.x, p.y]);
}

/** The legs a pointer can grab, with their index into the route. */
export function legs(points) {
  const list = [];
  for (let i = 1; i < points.length - 2; i += 1) {
    list.push({ index: i, a: points[i], b: points[i + 1] });
  }
  return list;
}

/** Points where pipe a crosses pipe b, for the small jumps over crossings. */
export function crossings(a, b) {
  const found = [];
  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      const p = cross(a[i], a[i + 1], b[j], b[j + 1]);
      if (p) found.push({ ...p, leg: i });
    }
  }
  return found;
}

function cross(a1, a2, b1, b2) {
  const aHorizontal = a1.y === a2.y;
  const bHorizontal = b1.y === b2.y;
  if (aHorizontal === bHorizontal) return null;
  const [h1, h2, v1, v2] = aHorizontal ? [a1, a2, b1, b2] : [b1, b2, a1, a2];
  const x = v1.x;
  const y = h1.y;
  const inside = (value, p, q) => value > Math.min(p, q) + 2 && value < Math.max(p, q) - 2;
  return inside(x, h1.x, h2.x) && inside(y, v1.y, v2.y) ? { x, y, horizontal: aHorizontal } : null;
}

/**
 * Shapes that go round the elements a pipe joins: out to one side of them,
 * along it, and back. Needed when the ports face away from each other, such as
 * a manifold's supply going up to a loop drawn below it.
 */
function detours(a, b, obstacles) {
  if (!obstacles.length) return [];
  const margin = 2 * GRID;
  const left = Math.min(...obstacles.map((o) => o.x)) - margin;
  const right = Math.max(...obstacles.map((o) => o.x + o.w)) + margin;
  const top = Math.min(...obstacles.map((o) => o.y)) - margin;
  const bottom = Math.max(...obstacles.map((o) => o.y + o.h)) + margin;
  const list = [];
  for (const x of [snap(left), snap(right)]) {
    list.push([
      { x, y: a.y },
      { x, y: b.y },
    ]);
  }
  for (const y of [snap(top), snap(bottom)]) {
    list.push([
      { x: a.x, y },
      { x: b.x, y },
    ]);
  }
  return list;
}
