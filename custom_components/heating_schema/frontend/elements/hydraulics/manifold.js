// Manifold for underfloor heating: the supply bar above, the return bar
// below, and for each loop a pair of connections pointing down, supply on the
// left, return on the right, as on a real manifold. Each loop's actuator, on
// the return, can be bound; a closed loop takes no water.
//
// Two looks ("style"): every loop's pair pointing down, as above, or the hot
// supplies going up from the supply bar and the cold returns down from the
// return bar. The port ids are the same in both, so the pipes follow.
//
// The heating water comes in from the left, from the right, or from both
// ends ("feed"). Switching sides keeps the port ids, so the pipes follow. With
// both ends the right-hand pair is extra and works either way: a second feed,
// or a pass-through to the next manifold, since the bars are one volume each.

import { defineElement } from "../registry.js";
import { port, both } from "../kit/ports.js";
import { num, select, bind } from "../kit/fields.js";
import { line, rect, stub } from "../kit/svg.js";
import { isOpen } from "../kit/readings.js";

const SPACING = 80;
const HEIGHT = 120;
const SUPPLY_Y = 30;
const RETURN_Y = 80;
const loops = (node) => Math.max(1, node.params.outlets || 1);
const width = (node) => SPACING * loops(node) + 40;
const split = (node) => node.params.style === "split";
// Side by side under the bars; or one above the other when split.
const supplyX = (node, k) => (split(node) ? SPACING * k : SPACING * k - 20);
const returnX = (node, k) => (split(node) ? SPACING * k : SPACING * k + 20);

/** The sides the heating water connects on. */
function feedSides(node) {
  if (node.params.feed === "right") return { main: "r", extra: false };
  if (node.params.feed === "both") return { main: "l", extra: true };
  return { main: "l", extra: false };
}

export default defineElement({
  type: "manifold",
  category: "hydraulics",
  size: (node) => ({ w: width(node), h: HEIGHT }),
  ports(node) {
    const { main, extra } = feedSides(node);
    const x = main === "l" ? 0 : width(node);
    const ports = [
      port("supply_in", x, SUPPLY_Y, main, "in", "heating", "supply"),
      port("return_out", x, RETURN_Y, main, "out", "heating", "return"),
    ];
    if (extra) {
      ports.push(
        port("supply_in_r", width(node), SUPPLY_Y, "r", "both", "heating", "supply"),
        port("return_out_r", width(node), RETURN_Y, "r", "both", "heating", "return")
      );
    }
    for (let k = 1; k <= loops(node); k += 1) {
      ports.push(
        split(node)
          ? port(`out_${k}`, supplyX(node, k), 0, "t", "out", "heating", "supply")
          : port(`out_${k}`, supplyX(node, k), HEIGHT, "b", "out", "heating", "supply")
      );
      ports.push(port(`ret_${k}`, returnX(node, k), HEIGHT, "b", "in", "heating", "return"));
    }
    return ports;
  },
  params: [
    num("outlets", 4, "", 1, 12),
    select("feed", "left", ["left", "right", "both"]),
    select("style", "down", ["down", "split"]),
  ],
  bindings(node) {
    const list = [
      bind("supply_temp", "temperature", false),
      bind("return_temp", "temperature", false),
      bind("pump", "running", false),
    ];
    for (let k = 1; k <= loops(node); k += 1) list.push(bind(`loop_${k}`, "open", false));
    return list;
  },
  passages(node, live) {
    const { extra } = feedSides(node);
    const pairs = [];
    for (let k = 1; k <= loops(node); k += 1) {
      if (!isOpen(live, `loop_${k}`)) continue;
      pairs.push(["supply_in", `out_${k}`], [`ret_${k}`, "return_out"]);
      if (extra) pairs.push(["supply_in_r", `out_${k}`], [`ret_${k}`, "return_out_r"]);
    }
    // Through the bars from one end to the other.
    if (extra) pairs.push(...both("supply_in", "supply_in_r"), ...both("return_out", "return_out_r"));
    return pairs;
  },
  draw(node, live, ctx, def) {
    const { main, extra } = feedSides(node);
    const right = def.w;
    const ends = (side) =>
      side === "l"
        ? stub(0, SUPPLY_Y, 8, SUPPLY_Y) + stub(0, RETURN_Y, 8, RETURN_Y)
        : stub(right - 8, SUPPLY_Y, right, SUPPLY_Y) + stub(right - 8, RETURN_Y, right, RETURN_Y);
    let body =
      rect(2, 8, def.w - 4, 100, 8, "hs-frame") +
      ends(main) +
      (extra ? ends("r") : "") +
      rect(8, 22, def.w - 16, 16, 6, "hs-bar hs-bar-supply") +
      rect(8, 72, def.w - 16, 16, 6, "hs-bar hs-bar-return");
    for (let k = 1; k <= loops(node); k += 1) {
      const out = supplyX(node, k);
      const ret = returnX(node, k);
      const v = live.values[`loop_${k}`];
      const state = !(v && v.ok) ? "hs-actuator hs-unknown" : isOpen(live, `loop_${k}`) ? "hs-actuator hs-actuator-on" : "hs-actuator";
      if (split(node)) {
        // Hot up from the supply bar, cold down from the return bar.
        body += stub(out, 0, out, 22) + stub(ret, 88, ret, HEIGHT) + rect(ret - 8, 94, 16, 12, 3, state);
        ctx.text(SPACING * k - 18, 55, String(k), "hs-number");
      } else {
        // The supply outlet passes the return bar on its way down.
        body += stub(out, 38, out, 66) + line(out - 4, 70, out + 4, 70, "hs-line") + stub(out, 94, out, HEIGHT);
        body += stub(ret, 88, ret, HEIGHT) + rect(ret - 8, 94, 16, 12, 3, state);
        ctx.text(SPACING * k, 52, String(k), "hs-number");
      }
    }
    return body;
  },
});
