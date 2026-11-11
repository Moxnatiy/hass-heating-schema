// Plate heat exchanger: two circuits that pass heat and never mix. Counter
// flow: primary enters top left, secondary enters bottom right.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { rect, line, stub } from "../kit/svg.js";

export default defineElement({
  type: "plate_hx",
  category: "hydraulics",
  w: 80,
  h: 100,
  ports: () => [
    port("p_in", 0, 20, "l", "in", "any", "supply"),
    port("p_out", 0, 80, "l", "out", "any", "return"),
    port("s_out", 80, 20, "r", "out", "any", "supply"),
    port("s_in", 80, 80, "r", "in", "any", "return"),
  ],
  params: [num("power_kw", 20, "kW", 1, 5000)],
  bindings: () => [bind("p_temp", "temperature", false), bind("s_temp", "temperature", false)],
  passages: () => [
    ["p_in", "p_out"],
    ["s_in", "s_out"],
  ],
  draw() {
    let plates = "";
    for (let x = 22; x <= 58; x += 6) plates += line(x, 10, x, 90, x % 12 === 10 ? "hs-plate-hot" : "hs-plate-cold");
    return (
      rect(10, 4, 60, 92, 6, "hs-body") +
      plates +
      stub(0, 20, 10, 20) +
      stub(0, 80, 10, 80) +
      stub(70, 20, 80, 20) +
      stub(70, 80, 80, 80)
    );
  },
});
