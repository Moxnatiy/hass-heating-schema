// Boiler: gas, oil, pellet, solid fuel or electric; a flame or a heating
// element shows when it fires.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, select, bool, bind } from "../kit/fields.js";
import { rect, flame, heatingRod, bodyClass } from "../kit/svg.js";
import { sourceDrives } from "../kit/readings.js";

export default defineElement({
  type: "boiler",
  category: "sources",
  w: 120,
  h: 100,
  ports: () => [
    port("supply_out", 120, 30, "r", "out", "heating", "supply"),
    port("return_in", 120, 70, "r", "in", "heating", "return"),
  ],
  params: [
    select("fuel", "gas", ["gas", "oil", "pellet", "solid", "electric"]),
    num("power_kw", 24, "kW", 1, 2000, 0.5),
    bool("condensing", true),
    bool("internal_pump", true),
  ],
  bindings: () => [
    bind("running", "running", false),
    bind("flow_temp", "temperature"),
    bind("return_temp", "temperature"),
    bind("modulation", "percent", false),
    bind("pressure", "pressure"),
    bind("setpoint", "setpoint", false),
    bind("power", "power", false),
    bind("alarm", "alarm", false),
  ],
  panel: { x: 100, y: 24, align: "end" },
  passages: () => [["return_in", "supply_out"]],
  drives: sourceDrives,
  draw(node, live) {
    const on = live.on === true;
    const heat = node.params.fuel === "electric" ? heatingRod(16, 56, 40, on) : flame(36, 50, on);
    return rect(2, 2, 116, 96, 8, bodyClass(live)) + heat;
  },
});
