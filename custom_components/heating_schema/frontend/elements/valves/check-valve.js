// Check valve: water passes one way only, from the open side to the dark one.

import { defineElement } from "../registry.js";
import { port } from "../kit/ports.js";
import { line, poly, stub } from "../kit/svg.js";

export default defineElement({
  type: "check_valve",
  category: "valves",
  w: 40,
  h: 40,
  ports: () => [port("in", 0, 20, "l", "in"), port("out", 40, 20, "r", "out")],
  passages: () => [["in", "out"]],
  draw() {
    return (
      stub(0, 20, 6, 20) +
      stub(34, 20, 40, 20) +
      poly("6,11 20,20 6,29", "hs-valve") +
      poly("34,11 20,20 34,29", "hs-valve hs-closed") +
      line(20, 10, 20, 30, "hs-line")
    );
  },
});
