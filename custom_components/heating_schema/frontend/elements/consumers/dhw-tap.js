// Hot water tap: where an open circuit ends. Bind a flow sensor or a flow
// switch and water runs from the mains through the tank while it is open.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { bind } from "../kit/fields.js";
import { drop, path, stub } from "../kit/svg.js";
import { numberOf, onOf } from "../kit/readings.js";

function open(live) {
  const flow = numberOf(live, "flow");
  if (flow !== null) return flow > 0;
  return onOf(live, "open") === true;
}

export default defineElement({
  type: "dhw_tap",
  category: "consumers",
  w: 60,
  h: 60,
  ports: () => [port("in", 0, 20, "l", "in", "dhw")],
  bindings: () => [bind("flow", "flow", false), bind("open", "open", false)],
  sink: (node, live) => open(live),
  draw(node, live) {
    return (
      stub(0, 20, 12, 20) +
      path("M12 15 H40 Q50 15 50 25 V30 H42 V25 Q42 23 40 23 H12 Z", "hs-tap") +
      path("M28 15 V7 M20 7 H36", "hs-line") +
      (open(live) ? drop(46, 44, 0.9) : "")
    );
  },
});
