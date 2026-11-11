// Solar collector: carries solar fluid (glycol), never heating water.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { line, poly, stub, bodyClass } from "../kit/svg.js";

export default defineElement({
  type: "solar_collector",
  category: "sources",
  w: 120,
  h: 80,
  ports: () => [
    port("flow_out", 120, 20, "r", "out", "solar", "supply"),
    port("return_in", 120, 60, "r", "in", "solar", "return"),
  ],
  params: [num("area_m2", 2.3, "m²", 0.5, 500, 0.1)],
  bindings: () => [bind("collector_temp", "temperature"), bind("alarm", "alarm", false)],
  panel: { x: 60, y: 74, align: "middle" },
  passages: () => [["return_in", "flow_out"]],
  draw(node, live) {
    let tubes = "";
    for (let x = 20; x <= 92; x += 9) tubes += line(x, 14, x - 8, 58, "hs-tube");
    return poly("14,8 108,8 98,62 4,62", bodyClass(live, "hs-body hs-solar")) + tubes + stub(106, 20, 120, 20) + stub(100, 60, 120, 60);
  },
});
