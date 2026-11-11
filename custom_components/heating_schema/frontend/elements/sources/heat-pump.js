// Heat pump: air, ground or water source; the unit's own pump moves water
// while the compressor runs, and its values show on the unit's display.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, select, bool, bind } from "../kit/fields.js";
import { rect, path, fan, bodyClass } from "../kit/svg.js";
import { onOf, numberOf, sourceDrives } from "../kit/readings.js";

export default defineElement({
  type: "heat_pump",
  category: "sources",
  w: 160,
  h: 100,
  ports: () => [
    port("supply_out", 160, 30, "r", "out", "heating", "supply"),
    port("return_in", 160, 70, "r", "in", "heating", "return"),
  ],
  params: [
    select("source", "air", ["air", "ground", "water"]),
    num("power_kw", 8, "kW", 1, 500, 0.5),
    bool("internal_pump", true),
  ],
  bindings: () => [
    bind("running", "running", false),
    bind("flow_temp", "temperature"),
    bind("return_temp", "temperature"),
    bind("outdoor_temp", "temperature"),
    bind("power", "power", false),
    bind("heat_output", "power", false),
    bind("cop", "number", false),
    bind("speed", "speed", false),
    bind("defrost", "running", false),
    bind("alarm", "alarm", false),
  ],
  panel: { x: 138, y: 24, align: "end" },
  passages: () => [["return_in", "supply_out"]],
  drives: sourceDrives,
  draw(node, live) {
    const on = live.on === true;
    const defrost = onOf(live, "defrost") === true;
    const speed = numberOf(live, "speed");
    const picture =
      node.params.source === "air"
        ? fan(48, 50, 34, on && !defrost, speed ? speed / 60 : 1)
        : path("M18 62 c8 -12 16 12 24 0 c8 -12 16 12 24 0 M18 76 c8 -12 16 12 24 0 c8 -12 16 12 24 0", "hs-wave");
    return (
      rect(2, 2, 156, 96, 8, `${bodyClass(live)}${defrost ? " hs-defrost" : ""}`) +
      picture +
      (defrost ? `<text class="hs-icon" text-anchor="middle" x="48" y="54">❄</text>` : "")
    );
  },
});
