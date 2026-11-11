// Gauges on a pipe: thermometer, pressure gauge, flow meter, heat meter.
// The pipe runs through; the reading sits in the round face.

import { defineElement } from "../registry.js";
import { port, both } from "../kit/ports.js";
import { bind } from "../kit/fields.js";
import { circle, line, stub } from "../kit/svg.js";
import { shortValue } from "../kit/readings.js";

function gauge(type, glyph, bindings) {
  return defineElement({
    type,
    category: "sensors",
    w: 40,
    h: 60,
    ports: () => [port("in", 0, 50, "l"), port("out", 40, 50, "r")],
    bindings: () => bindings,
    passages: () => both("in", "out"),
    draw(node, live, ctx) {
      const v = live.values[bindings[0].key];
      ctx.text(20, 18, v && v.ok ? shortValue(v) : glyph, "hs-gauge-text");
      return stub(0, 50, 40, 50) + line(20, 50, 20, 34, "hs-line") + circle(20, 18, 16, "hs-gauge");
    },
  });
}

export const thermometer = gauge("thermometer", "°", [bind("temperature", "temperature")]);
export const manometer = gauge("manometer", "bar", [bind("pressure", "pressure")]);
export const flowmeter = gauge("flowmeter", "Q", [bind("flow", "flow")]);
export const heatMeter = gauge("heat_meter", "kWh", [
  bind("power", "power"),
  bind("energy", "energy", false),
  bind("flow", "flow", false),
  bind("supply_temp", "temperature", false),
  bind("return_temp", "temperature", false),
]);
