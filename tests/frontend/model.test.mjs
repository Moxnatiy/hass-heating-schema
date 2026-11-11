// Which ports may be joined, and what the checks find.
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalize, resolveAll, canConnect, problems } from "../../custom_components/heating_schema/frontend/core/model.js";
import { checkEntity } from "../../custom_components/heating_schema/frontend/core/bindings.js";
import { layPipe } from "../../custom_components/heating_schema/frontend/core/edits.js";
import { sampleDoc, entity } from "./fixtures.mjs";

const doc = () =>
  normalize({
    id: "m",
    name: "m",
    nodes: [
      { id: "boiler", type: "boiler", x: 0, y: 0 },
      { id: "tank", type: "dhw_tank", x: 300, y: 0 },
      { id: "solar", type: "solar_collector", x: 600, y: 0 },
      { id: "pump", type: "pump", x: 0, y: 300 },
      { id: "rad", type: "radiator", x: 300, y: 300 },
    ],
    pipes: [],
  });

test("heating water may not enter the potable side of a tank", () => {
  const d = doc();
  const verdict = canConnect(d, resolveAll(d), { node: "boiler", port: "supply_out" }, { node: "tank", port: "cold_in" });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "mix");
});

test("solar fluid may not enter a heating circuit", () => {
  const d = doc();
  const verdict = canConnect(d, resolveAll(d), { node: "solar", port: "flow_out" }, { node: "rad", port: "in" });
  assert.equal(verdict.ok, false);
});

test("a schema that allows mixing joins any circuits, with a warning", () => {
  const d = doc();
  d.settings.allow_mixing = true;
  const defs = resolveAll(d);
  const verdict = canConnect(d, defs, { node: "boiler", port: "supply_out" }, { node: "tank", port: "cold_in" });
  assert.deepEqual([verdict.ok, verdict.level, verdict.reason], [true, "warning", "mix"]);
  const { pipe } = layPipe(d, defs, { node: "boiler", port: "supply_out" }, { node: "tank", port: "cold_in" });
  assert.ok(pipe);
  const mixes = problems(d, defs, null).filter((p) => p.code === "pipe_mixes" || p.code === "medium_wrong");
  assert.ok(mixes.length && mixes.every((p) => p.level === "warning"));
});

test("a boiler may heat a tank's coil", () => {
  const d = doc();
  const verdict = canConnect(d, resolveAll(d), { node: "boiler", port: "supply_out" }, { node: "tank", port: "coil_in" });
  assert.deepEqual(verdict, { ok: true, level: null, reason: null });
});

test("supply into a return is allowed with a warning", () => {
  const d = doc();
  const verdict = canConnect(d, resolveAll(d), { node: "boiler", port: "supply_out" }, { node: "rad", port: "out" });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.level, "warning");
});

test("a port takes one pipe", () => {
  const d = doc();
  d.pipes.push({ id: "p", from: { node: "boiler", port: "supply_out" }, to: { node: "pump", port: "in" }, medium: "heating_supply", points: [] });
  const verdict = canConnect(d, resolveAll(d), { node: "boiler", port: "supply_out" }, { node: "rad", port: "in" });
  assert.equal(verdict.reason, "port_taken");
});

test("a heated system without expansion vessel and safety valve is reported", () => {
  const d = normalize(sampleDoc());
  const codes = problems(d, resolveAll(d), null).map((p) => p.code);
  assert.ok(codes.includes("no_expansion"));
  assert.ok(codes.includes("no_safety_valve"));
});

test("hot water on one side of a pump and heating water on the other is reported", () => {
  const d = doc();
  d.pipes.push(
    { id: "p1", from: { node: "boiler", port: "supply_out" }, to: { node: "pump", port: "in" }, medium: "heating_supply", points: [] },
    { id: "p2", from: { node: "pump", port: "out" }, to: { node: "rad", port: "in" }, medium: "dhw", points: [] }
  );
  const found = problems(d, resolveAll(d), null).filter((p) => p.code === "medium_across");
  assert.deepEqual(found.map((p) => [p.pipe, p.node]), [["p2", "pump"]]);
  d.pipes[1].medium = "heating_supply";
  assert.ok(!problems(d, resolveAll(d), null).some((p) => p.code === "medium_across"));
});

test("the demo schema has no circuit changing inside an element", () => {
  const d = normalize(sampleDoc());
  assert.ok(!problems(d, resolveAll(d), null).some((p) => p.code === "medium_across"));
});

test("a power meter is not a temperature", () => {
  assert.equal(checkEntity("temperature", entity("sensor.p", 5, { unit_of_measurement: "W", device_class: "power" })), "error");
  assert.equal(checkEntity("temperature", entity("sensor.t", 21, { unit_of_measurement: "°C", device_class: "temperature" })), "ok");
  assert.equal(checkEntity("temperature", entity("climate.room", "heat", { current_temperature: 21 })), "ok");
  assert.equal(checkEntity("running", entity("sensor.pump_power", 40, { unit_of_measurement: "W" })), "ok");
});

test("an unknown element type is kept, not lost", () => {
  const d = normalize({ id: "u", name: "u", nodes: [{ id: "x", type: "from_the_future", x: 0, y: 0 }], pipes: [] });
  assert.equal(d.nodes.length, 1);
  assert.ok(problems(d, resolveAll(d), null).some((p) => p.code === "unknown_type"));
});
