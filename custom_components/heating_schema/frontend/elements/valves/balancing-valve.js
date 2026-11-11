// Balancing valve: sets a circuit's flow; the oblique arrow marks an
// adjustable setting.

import { defineElement } from "../registry.js";
import { port, both } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { path, stub, valveBody } from "../kit/svg.js";

export default defineElement({
  type: "balancing_valve",
  category: "valves",
  w: 40,
  h: 40,
  ports: () => [port("in", 0, 20, "l"), port("out", 40, 20, "r")],
  params: [num("kvs", 2.5, "m³/h", 0.1, 1000, 0.1), num("setting", 0, "", 0, 100, 0.1)],
  bindings: () => [bind("flow", "flow")],
  passages: () => both("in", "out"),
  draw() {
    return stub(0, 20, 6, 20) + stub(34, 20, 40, 20) + valveBody(20, 20, 14, 9) + path("M10 32 L30 8 M30 8 l-7 1 M30 8 l-1 7");
  },
});
