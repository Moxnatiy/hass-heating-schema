// Shut-off valve: ball, gate, globe or butterfly. Closed, it stops the flow;
// unbound, it is drawn in its normal position.

import { defineElement } from "../registry.js";
import { port, both } from "../kit/ports.js";
import { select, bind } from "../kit/fields.js";
import { circle, line, stub, valveBody } from "../kit/svg.js";
import { onOf } from "../kit/readings.js";

function open(node, live) {
  const state = onOf(live, "open");
  return state === null ? node.params.normally !== "closed" : state;
}

const MARKS = {
  ball: (isOpen) => circle(20, 20, 4, isOpen ? "hs-mark" : "hs-mark hs-closed"),
  gate: () => line(20, 11, 20, 29, "hs-line"),
  globe: () => circle(20, 20, 3, "hs-dot"),
  butterfly: () => line(15, 27, 25, 13, "hs-line"),
};

export default defineElement({
  type: "valve",
  category: "valves",
  w: 40,
  h: 40,
  ports: () => [port("in", 0, 20, "l"), port("out", 40, 20, "r")],
  params: [select("kind", "ball", ["ball", "gate", "globe", "butterfly"]), select("normally", "open", ["open", "closed"])],
  bindings: () => [bind("open", "open", false)],
  passages: (node, live) => (open(node, live) ? both("in", "out") : []),
  draw(node, live) {
    const isOpen = open(node, live);
    const mark = (MARKS[node.params.kind] || MARKS.ball)(isOpen);
    return stub(0, 20, 6, 20) + stub(34, 20, 40, 20) + valveBody(20, 20, 14, 9, isOpen ? "hs-valve" : "hs-valve hs-closed") + mark;
  },
});
