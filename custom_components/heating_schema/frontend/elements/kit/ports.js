// Ports and the passages that join them inside an element.
//
// A port is where a pipe attaches:
//   id      unique within the element, used in saved pipes; never rename one
//   x, y    on the element's box edge, on the 10-point grid
//   side    the side it faces: t, r, b or l
//   flow    "in", "out" or "both": decides a pipe's direction
//   family  the circuit it belongs to: heating, dhw, cold, solar, brine,
//           drain, or any (a pump or valve takes whatever runs through it)
//   role    "supply" or "return" within the family, or null
//
// A passage [a, b] says water can go from port a to port b inside the
// element. The flow animation walks along passages, so an element that
// closes (a valve) or switches (a three-way valve) returns fewer of them.

export const port = (id, x, y, side, flow = "both", family = "any", role = null) => ({
  id,
  x,
  y,
  side,
  flow,
  family,
  role,
});

/** Passages both ways between two ports: a plain fitting. */
export const both = (a, b) => [
  [a, b],
  [b, a],
];

/** Every port to every other: a tank's volume, a junction. */
export function allJoined(ports) {
  const pairs = [];
  for (const a of ports) for (const b of ports) if (a.id !== b.id) pairs.push([a.id, b.id]);
  return pairs;
}

/** Every inlet to every outlet of a shared volume: a hydraulic separator. */
export function inletsToOutlets(ports) {
  const ins = ports.filter((p) => p.flow !== "out");
  const outs = ports.filter((p) => p.flow !== "in");
  const pairs = [];
  for (const a of ins) for (const b of outs) if (a.id !== b.id) pairs.push([a.id, b.id]);
  return pairs;
}
