// Underfloor heating loop: the meander warms up while water flows.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { path, rect } from "../kit/svg.js";
import { isOpen } from "../kit/readings.js";

export default defineElement({
  type: "ufh",
  category: "consumers",
  w: 120,
  h: 80,
  ports: () => [port("in", 0, 20, "l", "in", "heating", "supply"), port("out", 0, 60, "l", "out", "heating", "return")],
  params: [num("area_m2", 15, "m²", 1, 1000), num("pipe_spacing_mm", 150, "mm", 50, 400, 10)],
  bindings: () => [
    bind("room_temp", "temperature"),
    bind("floor_temp", "temperature", false),
    bind("actuator", "open", false),
    bind("setpoint", "setpoint", false),
  ],
  passages: (node, live) => (isOpen(live, "actuator") ? [["in", "out"]] : []),
  draw(node, live) {
    return (
      rect(4, 4, 112, 72, 8, "hs-frame") +
      path("M0 20 H104 V30 H20 V40 H104 V50 H20 V60 H0", live.flowing ? "hs-loop hs-warm" : "hs-loop")
    );
  },
});
