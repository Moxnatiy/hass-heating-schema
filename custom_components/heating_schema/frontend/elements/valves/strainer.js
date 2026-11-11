// Strainer or magnetic dirt separator: the dashed line marks a filter.

import { defineElement } from "../registry.js";
import { port, both } from "../kit/ports.js";
import { select } from "../kit/fields.js";
import { line, path, poly, stub } from "../kit/svg.js";

export default defineElement({
  type: "strainer",
  category: "valves",
  w: 40,
  h: 40,
  ports: () => [port("in", 0, 20, "l"), port("out", 40, 20, "r")],
  params: [select("filter", "strainer", ["strainer", "magnetic"])],
  passages: () => both("in", "out"),
  draw(node) {
    const magnet = node.params.filter === "magnetic" ? path("M15 30 v3 a5 5 0 0 0 10 0 v-3", "hs-magnet") : "";
    return stub(0, 20, 6, 20) + stub(34, 20, 40, 20) + poly("20,6 34,20 20,34 6,20", "hs-valve") + line(13, 13, 27, 27, "hs-dash") + magnet;
  },
});
