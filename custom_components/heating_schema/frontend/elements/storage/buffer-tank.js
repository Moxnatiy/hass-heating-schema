// Buffer tank: one volume of heating water with connections on both sides,
// as many as the tank has. Every connection reaches every other.

import { defineElement } from "../registry.js";
import { GRID } from "../../core/geometry.js";
import { port, allJoined } from "../kit/ports.js";
import { num, bool, bind } from "../kit/fields.js";
import { stub, heatingRod } from "../kit/svg.js";
import { onOf } from "../kit/readings.js";
import { tankShell } from "../kit/tank.js";

const WIDTH = 100;

function height(node) {
  const most = Math.max(node.params.ports_left || 0, node.params.ports_right || 0);
  return Math.max(160, 40 * most + 40);
}

/** Connections spread evenly down one side, on the grid. */
function spread(count, x, side, prefix, h) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const y = count === 1 ? h / 2 : 40 + Math.round(((h - 80) * i) / (count - 1) / GRID) * GRID;
    list.push(port(`${prefix}${i + 1}`, x, y, side, "both", "any"));
  }
  return list;
}

export default defineElement({
  type: "buffer_tank",
  category: "storage",
  size: (node) => ({ w: WIDTH, h: height(node) }),
  ports(node) {
    const h = height(node);
    return [
      ...spread(node.params.ports_left || 0, 0, "l", "l", h),
      ...spread(node.params.ports_right || 0, WIDTH, "r", "r", h),
    ];
  },
  params: [
    num("volume_l", 500, "l", 10, 100000),
    num("ports_left", 2, "", 0, 6),
    num("ports_right", 2, "", 0, 6),
    bool("heater", false),
  ],
  bindings: () => [
    bind("temp_top", "temperature"),
    bind("temp_mid", "temperature"),
    bind("temp_bottom", "temperature"),
    bind("heater", "running", false),
  ],
  spotsFor: (def) => ({ temp_top: [50, 40], temp_mid: [50, def.h / 2], temp_bottom: [50, def.h - 40] }),
  passages: (node, live, ports) => allJoined(ports),
  draw(node, live, ctx, def) {
    let body = tankShell(live, ctx.uid, def.w, def.h);
    for (const p of def.ports) body += p.side === "l" ? stub(0, p.y, 10, p.y) : stub(90, p.y, 100, p.y);
    if (node.params.heater) body += heatingRod(30, def.h - 24, 40, onOf(live, "heater") === true);
    return body;
  },
});
