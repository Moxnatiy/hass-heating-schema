// Junction: a tee or a cross. The editor inserts one when a pipe is dropped
// onto another pipe. A dot marks a real branch; two pipes meeting is a bend.

import { defineElement } from "../registry.js";
import { port, allJoined } from "../kit/ports.js";
import { circle, stub } from "../kit/svg.js";

const ENDS = { n: [10, 0], e: [20, 10], s: [10, 20], w: [0, 10] };

export default defineElement({
  type: "junction",
  category: "hydraulics",
  w: 20,
  h: 20,
  hideLabel: true,
  ports: () => [port("n", 10, 0, "t"), port("e", 20, 10, "r"), port("s", 10, 20, "b"), port("w", 0, 10, "l")],
  passages: (node, live, ports) => allJoined(ports),
  draw(node, live, ctx) {
    let body = "";
    for (const [id, [x, y]] of Object.entries(ENDS)) if (ctx.connected.has(id)) body += stub(x, y, 10, 10);
    if (ctx.connected.size >= 3) body += circle(10, 10, 4, "hs-dot");
    return body || circle(10, 10, 3, "hs-dot hs-idle");
  },
});
