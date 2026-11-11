// Drain funnel: where a safety valve discharges.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { path, stub } from "../kit/svg.js";

export default defineElement({
  type: "drain",
  category: "water",
  w: 40,
  h: 40,
  ports: () => [port("in", 20, 0, "t", "in", "drain")],
  draw() {
    return stub(20, 0, 20, 10) + path("M6 10 H34 L25 24 V36 H15 V24 Z", "hs-body");
  },
});
