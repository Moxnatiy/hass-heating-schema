// Outdoor temperature sensor: not on a pipe, it only shows a reading.

import { defineElement } from "../registry.js";
import { bind } from "../kit/fields.js";
import { circle, path } from "../kit/svg.js";

export default defineElement({
  type: "outdoor_sensor",
  category: "sensors",
  w: 60,
  h: 60,
  ports: () => [],
  bindings: () => [bind("temperature", "temperature")],
  draw() {
    return (
      circle(30, 30, 12, "hs-sun") +
      path("M30 6 v7 M30 47 v7 M6 30 h7 M47 30 h7 M13 13 l5 5 M42 42 l5 5 M47 13 l-5 5 M18 42 l-5 5", "hs-sun-ray")
    );
  },
});
