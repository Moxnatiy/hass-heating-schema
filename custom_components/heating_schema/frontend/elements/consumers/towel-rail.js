// Heated towel rail: a ladder of bars between two upright rails. It hangs on
// the heating, or on the hot water circulation as it often does in a
// bathroom ("purpose"). Connected at the bottom, at one side (same end) or
// across. With an electric heater it warms without water too, in summer.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, select, bool, bind } from "../kit/fields.js";
import { rect, stub, heatingRod } from "../kit/svg.js";
import { isOpen, onOf } from "../kit/readings.js";

const W = 60;
const H = 120;
const LEFT = 10;
const RIGHT = 50;
const BARS = [16, 28, 40, 60, 72, 84];

function connections(node) {
  const family = node.params.purpose === "dhw" ? "dhw" : "heating";
  const at = {
    side: [["in", 0, 20, "l"], ["out", 0, 100, "l"]],
    cross: [["in", 0, 20, "l"], ["out", W, 100, "r"]],
    bottom: [["in", LEFT, H, "b"], ["out", RIGHT, H, "b"]],
  }[node.params.connection] || [["in", LEFT, H, "b"], ["out", RIGHT, H, "b"]];
  return [
    port(at[0][0], at[0][1], at[0][2], at[0][3], "in", family, "supply"),
    port(at[1][0], at[1][1], at[1][2], at[1][3], "out", family, "return"),
  ];
}

export default defineElement({
  type: "towel_rail",
  category: "consumers",
  w: W,
  h: H,
  ports: connections,
  params: [
    select("connection", "bottom", ["bottom", "side", "cross"]),
    select("purpose", "heating", ["heating", "dhw"]),
    num("power_w", 400, "W", 50, 3000, 10),
    bool("heater", false),
  ],
  bindings: (node) => {
    const list = [bind("room_temp", "temperature"), bind("valve", "percent", false)];
    if (node.params.heater) list.push(bind("heater", "running", false));
    return list;
  },
  passages: (node, live) => (isOpen(live, "valve") ? [["in", "out"]] : []),
  draw(node, live, ctx, def) {
    const heating = node.params.heater && onOf(live, "heater") === true;
    const warm = live.flowing || heating;
    const cls = warm ? "hs-fin hs-warm" : "hs-fin";
    let bars = "";
    for (const y of BARS) bars += rect(LEFT + 2, y - 2, RIGHT - LEFT - 4, 5, 2, cls);
    const rails = rect(LEFT - 4, 6, 8, 102, 4, "hs-body") + rect(RIGHT - 4, 6, 8, 102, 4, "hs-body");
    let stubs = "";
    for (const p of def.ports) {
      if (p.side === "b") stubs += stub(p.x, 108, p.x, H);
      else if (p.side === "l") stubs += stub(0, p.y, LEFT - 4, p.y);
      else stubs += stub(RIGHT + 4, p.y, W, p.y);
    }
    const heater = node.params.heater ? heatingRod(LEFT + 8, 100, RIGHT - LEFT - 16, heating) : "";
    return bars + rails + stubs + heater;
  },
});
