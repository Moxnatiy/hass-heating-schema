// Cold water supply: the mains, where an open circuit begins.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { bind } from "../kit/fields.js";
import { circle, drop, stub } from "../kit/svg.js";

export default defineElement({
  type: "cold_water_inlet",
  category: "water",
  w: 60,
  h: 60,
  ports: () => [port("out", 0, 30, "l", "out", "cold")],
  bindings: () => [bind("pressure", "pressure", false), bind("flow", "flow", false)],
  source: () => "out",
  draw() {
    return stub(0, 30, 10, 30) + circle(34, 30, 22, "hs-body") + drop(34, 30, 1.3, "hs-drop hs-drop-cold");
  },
});
