// Hydraulic separator (low-loss header): decouples the boiler's circuit
// (left) from the heating circuits (right). Every inlet reaches every outlet,
// which is exactly the short circuit it is built to be.

import { defineElement } from "../registry.js";
import { port, inletsToOutlets } from "../kit/ports.js";
import { bind } from "../kit/fields.js";
import { rect, line } from "../kit/svg.js";
import { strata } from "../kit/tank.js";

export default defineElement({
  type: "hydraulic_separator",
  category: "hydraulics",
  w: 40,
  h: 140,
  ports: () => [
    port("p_in", 0, 30, "l", "in", "heating", "supply"),
    port("p_out", 0, 110, "l", "out", "heating", "return"),
    port("s_out", 40, 30, "r", "out", "heating", "supply"),
    port("s_in", 40, 110, "r", "in", "heating", "return"),
  ],
  bindings: () => [bind("temp_top", "temperature"), bind("temp_bottom", "temperature")],
  spots: { temp_top: [20, 50], temp_bottom: [20, 92] },
  passages: (node, live, ports) => inletsToOutlets(ports),
  draw(node, live, ctx) {
    const fill = strata(live, ctx.uid, 140);
    return (
      fill.defs +
      rect(6, 4, 28, 132, 8, "hs-body") +
      rect(8, 6, 24, 128, 7, "hs-strata", `fill="${fill.paint}"`) +
      line(20, 20, 20, 120, "hs-dash")
    );
  },
});
