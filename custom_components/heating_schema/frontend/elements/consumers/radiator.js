// Radiator. Where its connections are depends on how it is piped: side
// (both on one end), cross (supply top on one end, return bottom on the
// other) or bottom. Fins turn warm while water flows through.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, select, bind } from "../kit/fields.js";
import { rect, stub } from "../kit/svg.js";
import { isOpen, onOf } from "../kit/readings.js";

const CONNECTIONS = {
  side: () => [port("in", 0, 20, "l", "in", "heating", "supply"), port("out", 0, 40, "l", "out", "heating", "return")],
  cross: () => [port("in", 0, 20, "l", "in", "heating", "supply"), port("out", 100, 40, "r", "out", "heating", "return")],
  bottom: () => [port("in", 30, 60, "b", "in", "heating", "supply"), port("out", 70, 60, "b", "out", "heating", "return")],
};

export default defineElement({
  type: "radiator",
  category: "consumers",
  w: 100,
  h: 60,
  ports: (node) => (CONNECTIONS[node.params.connection] || CONNECTIONS.side)(),
  params: [select("connection", "side", ["side", "cross", "bottom"]), num("power_w", 1500, "W", 50, 20000, 10)],
  bindings: () => [
    bind("room_temp", "temperature"),
    bind("valve", "percent", false),
    bind("setpoint", "setpoint", false),
    bind("window", "open", false),
  ],
  passages: (node, live) => (isOpen(live, "valve") ? [["in", "out"]] : []),
  draw(node, live, ctx, def) {
    let fins = "";
    for (let x = 22; x <= 78; x += 8) fins += rect(x - 3, 10, 6, 40, 3, live.flowing ? "hs-fin hs-warm" : "hs-fin");
    let stubs = "";
    for (const p of def.ports) {
      if (p.side === "l") stubs += stub(0, p.y, 14, p.y);
      else if (p.side === "r") stubs += stub(86, p.y, 100, p.y);
      else stubs += stub(p.x, 50, p.x, 60);
    }
    const window = onOf(live, "window") === true ? `<text class="hs-icon" text-anchor="middle" x="92" y="12">⊞</text>` : "";
    return rect(14, 6, 72, 48, 6, "hs-body") + fins + stubs + window;
  },
});
