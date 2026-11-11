// Hot water tank (indirect cylinder): heating coils on the left, potable
// water on the right. The coils' circuits never touch the tank water: they are
// separate passages, which is what keeps drinking water clean.
//
// A tank may have more connections than the basic three, as real ones do:
//   coils        one, two (upper and lower) or three (upper, middle, lower),
//                for instance a boiler, a heat pump and a solar circuit
//   hot_outlets  more hot water outlets on top, for separate branches
//   cold_inlets  a second cold inlet at the bottom
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

/** The extra hot outlets on top and the extra connections at the bottom. */
const TOP_X = { hot_out_2: 50, hot_out_3: 70 };
const BOTTOM_X = { drain: 30, cold_in_2: 70 };

function hotOutlets(node) {
  const list = ["hot_out"];
  for (let k = 2; k <= count(node.params.hot_outlets, 3); k += 1) list.push(`hot_out_${k}`);
  return list;
}

function potableInlets(node) {
  const list = ["cold_in"];
  if (count(node.params.cold_inlets, 2) === 2) list.push("cold_in_2");
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
    ports.push(port("hot_out", WIDTH, 40, "r", "out", "dhw", "supply"));
    for (const id of hotOutlets(node).slice(1)) ports.push(port(id, TOP_X[id], 0, "t", "out", "dhw", "supply"));
    if (node.params.circulation) ports.push(port("circ_in", WIDTH, h / 2, "r", "in", "dhw", "return"));
    ports.push(port("cold_in", WIDTH, h - 40, "r", "in", "cold"));
    if (potableInlets(node).includes("cold_in_2")) ports.push(port("cold_in_2", BOTTOM_X.cold_in_2, h, "b", "in", "cold"));
    if (node.params.drain) ports.push(port("drain", BOTTOM_X.drain, h, "b", "out", "drain"));
    return ports;
  },
  params: [
    num("volume_l", 200, "l", 30, 10000),
    select("coils", "1", ["1", "2", "3"]),
    num("hot_outlets", 1, "", 1, 3),
    num("cold_inlets", 1, "", 1, 2),
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
    body += stub(90, 40, 100, 40) + stub(90, h - 40, 100, h - 40);
    if (node.params.circulation) body += stub(90, h / 2, 100, h / 2);
    for (const id of hotOutlets(node).slice(1)) body += stub(TOP_X[id], 0, TOP_X[id], 10);
    for (const p of def.ports) if (p.side === "b") body += stub(p.x, h - 10, p.x, h);
    if (node.params.heater) body += heatingRod(52, h - 60, 36, onOf(live, "heater") === true);
    return body;
  },
});
