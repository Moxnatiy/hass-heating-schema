// Automatic air vent, at the high points of a system.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { path, rect, stub } from "../kit/svg.js";

export default defineElement({
  type: "air_vent",
  category: "valves",
  w: 20,
  h: 40,
  ports: () => [port("connection", 10, 40, "b", "both", "any")],
  draw() {
    return rect(3, 16, 14, 14, 3, "hs-body") + stub(10, 30, 10, 40) + path("M10 14 V3 M10 3 l-4 5 M10 3 l4 5");
  },
});
