// Boiler loading unit, of the Laddomat 21 kind: a pump, a thermostatic valve
// and a bypass in one body, between a solid fuel boiler and its buffer tank.
//
// Water from the boiler enters at the top and runs straight through to the
// tank. The pump pushes water back into the boiler, drawing it through the
// thermostatic valve: while the boiler's water is colder than the valve's
// opening temperature, it comes only from the bypass, so the boiler warms up
// quickly and does not sweat tar; above it, the valve opens to the tank's cold
// return and the tank charges. The ports line up with a boiler's, supply over
// return, so a boiler on the left joins it with straight pipes.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { circle, line, poly, rect, stub, bodyClass } from "../kit/svg.js";
import { numberOf, pumpSpeed } from "../kit/readings.js";

/** The pump's triangle, centred, pointing left to the boiler's return. */
const TRIANGLE = "-10,0 5,-8.66 5,8.66";
/** A full turn of the triangle at 100 % speed, in seconds. */
const TURN = 2.4;

/**
 * Whether the tank side is open: true or false from the boiler's water
 * temperature, null while it is not known.
 */
function charging(node, live) {
  const hot = numberOf(live, "from_boiler_temp");
  return hot === null ? null : hot >= node.params.opening_temp;
}

export default defineElement({
  type: "loading_unit",
  category: "hydraulics",
  w: 120,
  h: 100,
  ports: () => [
    port("boiler_flow", 0, 30, "l", "in", "heating", "supply"),
    port("boiler_return", 0, 70, "l", "out", "heating", "return"),
    port("tank_flow", 120, 30, "r", "out", "heating", "supply"),
    port("tank_return", 120, 70, "r", "in", "heating", "return"),
  ],
  params: [num("opening_temp", 72, "°C", 45, 95)],
  bindings: () => [
    bind("running", "running", false),
    bind("speed", "percent", false),
    bind("from_boiler_temp", "temperature"),
    bind("to_boiler_temp", "temperature"),
    bind("from_tank_temp", "temperature"),
    bind("alarm", "alarm", false),
  ],
  passages(node, live) {
    const pairs = [
      ["boiler_flow", "tank_flow"],
      ["boiler_flow", "boiler_return"],
    ];
    if (charging(node, live) !== false) pairs.push(["tank_return", "boiler_return"]);
    return pairs;
  },
  drives: (node, live) => (live.on === true ? pumpSpeed(live) : 0),
  // The pump sits on the boiler's return; it draws through the bypass and,
  // once the valve opens, from the tank.
  pumpOutlet: () => "boiler_return",
  draw(node, live, ctx) {
    const on = live.on === true;
    const open = charging(node, live);
    const leg = (isOpen) => (isOpen ? "hs-valve hs-valve-open" : "hs-valve");
    const spin = on ? ` class="hs-spin" style="--hs-speed:${(TURN / pumpSpeed(live)).toFixed(2)}s"` : "";
    ctx.text(104, 92, `${node.params.opening_temp}°`, "hs-port-tag", "middle");
    return (
      rect(2, 2, 116, 96, 8, "hs-body") +
      // Straight through from the boiler to the tank, and the bypass down.
      stub(0, 30, 6, 30) +
      stub(114, 30, 120, 30) +
      line(6, 30, 114, 30) +
      line(84, 30, 84, 58) +
      // The thermostatic valve: bypass from above, tank from the right.
      stub(114, 70, 120, 70) +
      line(96, 70, 114, 70) +
      poly("76,58 92,58 84,70", leg(open !== null)) +
      poly("96,62 96,78 84,70", leg(open === true)) +
      poly("72,62 72,78 84,70", "hs-valve") +
      line(84, 70, 84, 84) +
      rect(78, 84, 12, 8, 2, "hs-valve") +
      // The pump, pushing back into the boiler.
      line(56, 70, 72, 70) +
      line(6, 70, 24, 70) +
      stub(0, 70, 6, 70) +
      circle(40, 70, 16, bodyClass(live)) +
      `<g transform="translate(40 70)"><g${spin}>${poly(TRIANGLE, on ? "hs-arrow hs-arrow-turning" : "hs-arrow")}</g></g>`
    );
  },
});
