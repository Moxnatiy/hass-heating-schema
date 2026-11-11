// Expansion vessel: a membrane splits gas from water. A dead end for flow;
// what matters about it is its pressure.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, select, bind } from "../kit/fields.js";
import { rect, line, stub } from "../kit/svg.js";

const WATER = { heating: "hs-water-heating", dhw: "hs-water-dhw", solar: "hs-water-solar" };

export default defineElement({
  type: "expansion_vessel",
  category: "storage",
  w: 60,
  h: 80,
  ports: () => [port("connection", 30, 80, "b", "both", "any")],
  params: [
    select("purpose", "heating", ["heating", "dhw", "solar"]),
    num("volume_l", 18, "l", 1, 5000),
    num("precharge_bar", 1, "bar", 0, 10, 0.1),
  ],
  bindings: () => [bind("pressure", "pressure")],
  panel: { x: 30, y: 24, align: "middle" },
  draw(node) {
    const water = WATER[node.params.purpose] || WATER.heating;
    return (
      rect(6, 4, 48, 62, 22, "hs-body") +
      `<path class="${water}" d="M8 40 H52 V44 A20 20 0 0 1 32 64 H28 A20 20 0 0 1 8 44 Z"/>` +
      line(8, 40, 52, 40, "hs-membrane") +
      stub(30, 66, 30, 80)
    );
  },
});
