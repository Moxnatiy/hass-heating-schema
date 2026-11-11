// Safety valve: an angle valve held shut by a spring, opening at its set
// pressure. Its discharge belongs to a drain, never back into the system.
// It has no passage: a discharge is an alarm, not a flow.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { num, bind } from "../kit/fields.js";
import { path, poly, stub } from "../kit/svg.js";

export default defineElement({
  type: "safety_valve",
  category: "valves",
  w: 40,
  h: 60,
  ports: () => [port("in", 20, 60, "b", "in", "any"), port("discharge", 40, 40, "r", "out", "drain")],
  params: [num("set_pressure", 3, "bar", 0.5, 25, 0.5)],
  bindings: () => [bind("alarm", "alarm", false)],
  draw(node, live, ctx) {
    ctx.text(8, 10, `${node.params.set_pressure ?? ""}`, "hs-small");
    return (
      stub(20, 54, 20, 60) +
      stub(34, 40, 40, 40) +
      poly("11,54 20,40 29,54", live.alarm ? "hs-valve hs-alarm" : "hs-valve") +
      poly("34,31 20,40 34,49", "hs-valve") +
      path("M20 40 V34 l-6 -2 l12 -3 l-12 -3 l12 -3 l-12 -3 l6 -2 V12")
    );
  },
});
