// Hot water tank (indirect cylinder): heating coils on the left, potable
// water on the right. The coils' circuits never touch the tank water: they are
// separate passages, which is what keeps drinking water clean.
//
// A tank may have more connections than the basic three, as real ones do:
//   coils        one, two (upper and lower) or three (upper, middle, lower),
//                for instance a boiler, a heat pump and a solar circuit
//   hot_outlets  up to three hot water outlets, for separate branches, next
//                to the main one: on the side, one under the other at the
//                top, or on top of the tank side by side (hot_connection)
//   cold_inlets  up to three cold inlets, next to the main one: on the side,
//                one above the other at the bottom, or underneath side by
//                side (cold_connection)
//   circulation  the hot water circulation return, midway up
//   drain        a drain connection at the lowest point
// Every potable inlet reaches every hot outlet: the tank is one volume. The
// drain is a closed cock, so it takes no flow. Existing port ids never move
// to another meaning, so the pipes of a saved schema stay where they were.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, select, bool, bind } from "../kit/fields.js";
import { stub, coil, heatingRod } from "../kit/svg.js";
import { onOf } from "../kit/readings.js";
import { tankShell } from "../kit/tank.js";

const WIDTH = 100;
const coils = (node) => Math.min(3, Math.max(1, Number(node.params.coils) || 1));
// Three coils need a taller tank; one or two keep the classic size.
const height = (node) => (coils(node) === 3 ? 240 : 200);
const count = (value, most) => Math.min(most, Math.max(1, Number(value) || 1));

/** Each coil as [prefix, top, bottom], top of the tank first. */
function coilSpans(node) {
  const n = coils(node);
  if (n === 3) {
    return [
      ["coil2", 40, 80],
      ["coil3", 110, 150],
      ["coil", 170, 210],
    ];
  }
  if (n === 2) {
    return [
      ["coil2", 40, 80],
      ["coil", 120, 170],
    ];
  }
  return [["coil", 40, 160]];
}

/** Where the hot outlets and the cold inlets sit: 20 apart, the main one first. */
const STEP = 20;
const hotY = (k) => 40 + STEP * (k - 1);
const coldY = (h, k) => h - 40 - STEP * (k - 1);
const TOP_X = [50, 70, 30];
const BOTTOM_X = [50, 70, 90];
const DRAIN_X = 30;
const hotOnTop = (node) => node.params.hot_connection === "top";
const coldUnder = (node) => node.params.cold_connection === "bottom";
/** How far up from the box's bottom the shell is at x: its corners are round. */
const shellLift = (x) => (x > 72 || x < 28 ? 22 : 4);

function hotOutlets(node) {
  const list = ["hot_out"];
  for (let k = 2; k <= count(node.params.hot_outlets, 3); k += 1) list.push(`hot_out_${k}`);
  return list;
}

function coldInlets(node) {
  const list = ["cold_in"];
  for (let k = 2; k <= count(node.params.cold_inlets, 3); k += 1) list.push(`cold_in_${k}`);
  return list;
}

function potableInlets(node) {
  const list = coldInlets(node);
  if (node.params.circulation) list.push("circ_in");
  return list;
}

export default defineElement({
  type: "dhw_tank",
  category: "storage",
  size: (node) => ({ w: WIDTH, h: height(node) }),
  ports(node) {
    const h = height(node);
    const ports = [];
    for (const [prefix, top, bottom] of coilSpans(node)) {
      ports.push(
        port(`${prefix}_in`, 0, top, "l", "in", "any", "supply"),
        port(`${prefix}_out`, 0, bottom, "l", "out", "any", "return")
      );
    }
    hotOutlets(node).forEach((id, i) =>
      ports.push(
        hotOnTop(node)
          ? port(id, TOP_X[i], 0, "t", "out", "dhw", "supply")
          : port(id, WIDTH, hotY(i + 1), "r", "out", "dhw", "supply")
      )
    );
    if (node.params.circulation) ports.push(port("circ_in", WIDTH, h / 2, "r", "in", "dhw", "return"));
    coldInlets(node).forEach((id, i) =>
      ports.push(coldUnder(node) ? port(id, BOTTOM_X[i], h, "b", "in", "cold") : port(id, WIDTH, coldY(h, i + 1), "r", "in", "cold"))
    );
    if (node.params.drain) ports.push(port("drain", DRAIN_X, h, "b", "out", "drain"));
    return ports;
  },
  params: [
    num("volume_l", 200, "l", 30, 10000),
    select("coils", "1", ["1", "2", "3"]),
    num("hot_outlets", 1, "", 1, 3),
    select("hot_connection", "side", ["side", "top"]),
    num("cold_inlets", 1, "", 1, 3),
    select("cold_connection", "side", ["side", "bottom"]),
    bool("circulation", false),
    bool("drain", false),
    bool("heater", true),
  ],
  bindings: () => [
    bind("temp_top", "temperature"),
    bind("temp_mid", "temperature"),
    bind("temp_bottom", "temperature"),
    bind("setpoint", "setpoint", false),
    bind("heater", "running", false),
  ],
  // The tank's sensors are shown where they sit.
  spotsFor: (def) => ({ temp_top: [62, 42], temp_mid: [62, def.h / 2], temp_bottom: [62, def.h - 40] }),
  passages(node) {
    const pairs = coilSpans(node).map(([prefix]) => [`${prefix}_in`, `${prefix}_out`]);
    for (const inlet of potableInlets(node)) for (const outlet of hotOutlets(node)) pairs.push([inlet, outlet]);
    return pairs;
  },
  draw(node, live, ctx, def) {
    const h = def.h;
    let body = tankShell(live, ctx.uid, def.w, h);
    for (const [, top, bottom] of coilSpans(node)) body += coil(10, 44, top, bottom);
    for (const p of def.ports) {
      if (p.side === "r") body += stub(90, p.y, 100, p.y);
      else if (p.side === "t") body += stub(p.x, 0, p.x, 10);
      else if (p.side === "b") body += stub(p.x, h - Math.max(10, shellLift(p.x)), p.x, h);
    }
    if (node.params.heater) body += heatingRod(52, h - 60, 36, onOf(live, "heater") === true);
    return body;
  },
});
