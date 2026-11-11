// Circulation pump: the triangle points downstream. A running pump drives the
// flow animation of the loop it sits in, and shows that it runs in one of two
// looks ("style"):
//   impeller   an impeller turns over the triangle, which fades to a faint
//              mark of the direction while it does
//   triangle   the triangle itself turns, at half the impeller's pace
// Both turn faster with the pump's speed.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { select, bind } from "../kit/fields.js";
import { circle, poly, stub, bodyClass } from "../kit/svg.js";
import { pumpSpeed } from "../kit/readings.js";

/** Six curved blades about the centre, in the impeller's own coordinates. */
const BLADE = "M0 -4 C6 -8 12 -12 17 -9 C12 -9 7 -5 3 -1 Z";
const BLADES = [0, 60, 120, 180, 240, 300]
  .map((a) => `<path class="hs-impeller" transform="rotate(${a})" d="${BLADE}"/>`)
  .join("");

/** A full turn at 100 % speed, in seconds. */
const IMPELLER_TURN = 1.2;
const TRIANGLE_TURN = 2 * IMPELLER_TURN;

/** A group turning about the pump's centre while it runs. */
function turning(content, on, seconds) {
  const spin = on ? ` class="hs-spin" style="--hs-speed:${seconds.toFixed(2)}s"` : "";
  return `<g transform="translate(30 30)"><g${spin}>${content}</g></g>`;
}

/**
 * The direction triangle, equilateral and centred on the pump, so that it
 * turns in place; at rest it points to the outlet.
 */
const TRIANGLE = "14,0 -7,12.12 -7,-12.12";

export default defineElement({
  type: "pump",
  category: "hydraulics",
  w: 60,
  h: 60,
  ports: () => [port("in", 0, 30, "l", "in"), port("out", 60, 30, "r", "out")],
  params: [
    select("control", "variable", ["fixed", "variable", "dp_constant", "dp_variable"]),
    select("style", "impeller", ["impeller", "triangle"]),
  ],
  bindings: () => [
    bind("running", "running", false),
    bind("speed", "percent", false),
    bind("power", "power", false),
    bind("flow", "flow", false),
    bind("alarm", "alarm", false),
  ],
  passages: () => [["in", "out"]],
  drives: (node, live) => (live.on === true ? pumpSpeed(live) : 0),
  draw(node, live) {
    const on = live.on === true;
    const speed = pumpSpeed(live);
    const body = stub(0, 30, 6, 30) + stub(54, 30, 60, 30) + circle(30, 30, 24, bodyClass(live));
    if (node.params.style === "triangle") {
      return body + turning(poly(TRIANGLE, on ? "hs-arrow hs-arrow-turning" : "hs-arrow"), on, TRIANGLE_TURN / speed);
    }
    return (
      body +
      turning(poly(TRIANGLE, on ? "hs-arrow hs-arrow-on" : "hs-arrow"), false, 0) +
      turning(`${BLADES}<circle class="hs-hub" r="3"/>`, on, IMPELLER_TURN / speed)
    );
  },
});
