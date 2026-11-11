// Fan coil: a coil with a fan blowing through it.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { coil, fan, rect } from "../kit/svg.js";
import { isOpen, onOf } from "../kit/readings.js";

export default defineElement({
  type: "fan_coil",
  category: "consumers",
  w: 100,
  h: 60,
  ports: () => [port("in", 0, 20, "l", "in", "heating", "supply"), port("out", 0, 40, "l", "out", "heating", "return")],
  params: [num("power_w", 3000, "W", 100, 100000, 100)],
  bindings: () => [
    bind("fan", "running", false),
    bind("room_temp", "temperature"),
    bind("valve", "percent", false),
    bind("setpoint", "setpoint", false),
  ],
  passages: (node, live) => (isOpen(live, "valve") ? [["in", "out"]] : []),
  draw(node, live) {
    const on = onOf(live, "fan") === true;
    return (
      rect(2, 2, 96, 56, 8, on ? "hs-body hs-running" : "hs-body") +
      coil(2, 34, 12, 48, live.flowing ? "hs-coil" : "hs-coil hs-idle") +
      fan(68, 30, 20, on)
    );
  },
});
