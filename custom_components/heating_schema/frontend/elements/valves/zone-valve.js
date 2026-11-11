// Zone valve: a two-way valve with a motor or a thermal actuator, opened by
// a thermostat. Bind its end switch or its position.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { select, bind } from "../kit/fields.js";
import { stub, valveBody, actuator } from "../kit/svg.js";
import { numberOf, onOf } from "../kit/readings.js";

function open(live) {
  const position = numberOf(live, "position");
  if (position !== null) return position > 0;
  const state = onOf(live, "open");
  return state === null ? true : state;
}

export default defineElement({
  type: "zone_valve",
  category: "valves",
  w: 40,
  h: 60,
  ports: () => [port("in", 0, 40, "l", "in"), port("out", 40, 40, "r", "out")],
  params: [select("actuator", "motor", ["motor", "thermal"]), select("normally", "closed", ["open", "closed"])],
  bindings: () => [bind("open", "open", false), bind("position", "percent", false)],
  passages: (node, live) => (open(live) ? [["in", "out"]] : []),
  draw(node, live) {
    const isOpen = open(live);
    return (
      stub(0, 40, 6, 40) +
      stub(34, 40, 40, 40) +
      valveBody(20, 40, 14, 9, isOpen ? "hs-valve hs-valve-open" : "hs-valve hs-closed") +
      actuator(20, 8, 40, node.params.actuator)
    );
  },
});
