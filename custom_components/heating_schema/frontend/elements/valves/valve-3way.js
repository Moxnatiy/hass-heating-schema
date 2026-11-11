// Three-way valve, diverting or mixing. Ports are named as on the valve
// body: AB the common port, A and B the two paths. Position 100 % is path A
// alone, 0 % path B alone; a mixing valve in between takes from both.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { select, bind } from "../kit/fields.js";
import { line, poly, stub, actuator } from "../kit/svg.js";
import { numberOf, onOf } from "../kit/readings.js";

/** The share of path A, 0..1, or null while unknown. */
function shareOfA(live) {
  const position = numberOf(live, "position");
  if (position !== null) return Math.max(0, Math.min(1, position / 100));
  const a = onOf(live, "a_open");
  return a === null ? null : a ? 1 : 0;
}

const mixing = (node) => node.params.function === "mixing";

export default defineElement({
  type: "valve_3way",
  category: "valves",
  w: 80,
  h: 80,
  ports(node) {
    const into = mixing(node) ? "out" : "in";
    const away = mixing(node) ? "in" : "out";
    return [port("AB", 0, 50, "l", into), port("A", 80, 50, "r", away), port("B", 40, 80, "b", away)];
  },
  params: [
    select("function", "diverting", ["diverting", "mixing"]),
    select("actuator", "motor", ["none", "motor", "thermostatic"]),
  ],
  bindings: () => [
    bind("position", "percent", false),
    bind("a_open", "open", false),
    bind("mixed_temp", "temperature", false),
  ],
  passages(node, live) {
    const share = shareOfA(live);
    const pairs = [];
    if (share === null || share > 0) pairs.push(mixing(node) ? ["A", "AB"] : ["AB", "A"]);
    if (share === null || share < 1) pairs.push(mixing(node) ? ["B", "AB"] : ["AB", "B"]);
    return pairs;
  },
  draw(node, live, ctx) {
    const share = shareOfA(live);
    const leg = (open) => (share !== null && open ? "hs-valve hs-valve-open" : "hs-valve");
    ctx.text(66, 38, "A", "hs-port-tag");
    ctx.text(54, 74, "B", "hs-port-tag");
    const top =
      node.params.actuator === "none"
        ? line(40, 50, 40, 32, "hs-line") + line(32, 32, 48, 32, "hs-line")
        : actuator(40, 18, 50, node.params.actuator);
    return (
      stub(0, 50, 12, 50) +
      stub(68, 50, 80, 50) +
      stub(40, 68, 40, 80) +
      poly("12,38 40,50 12,62", "hs-valve") +
      poly("68,38 40,50 68,62", leg(share !== null && share >= 0.5)) +
      poly("28,68 40,50 52,68", leg(share !== null && share < 0.5)) +
      top
    );
  },
});
