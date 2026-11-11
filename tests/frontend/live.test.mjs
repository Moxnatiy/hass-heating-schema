// Where water moves: driven loops, closed valves, one-way valves, open taps.
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalize, resolveAll } from "../../custom_components/heating_schema/frontend/core/model.js";
import { evaluate } from "../../custom_components/heating_schema/frontend/core/live.js";
import { sampleDoc, sampleStates, entity } from "./fixtures.mjs";

const flowing = (doc, states) => {
  const defs = resolveAll(doc);
  const live = evaluate(doc, defs, states);
  return [...live.pipes].filter(([, s]) => s.flow > 0).map(([id]) => id).sort();
};

test("heating mode: the floor loop flows, the tank coil does not", () => {
  const doc = normalize(sampleDoc());
  assert.deepEqual(flowing(doc, sampleStates({ dhw: false })), ["p1", "p10", "p11", "p4", "p5", "p6", "p7", "p8", "p9"]);
});

test("hot water mode: the heat pump's own pump drives the tank coil", () => {
  const doc = normalize(sampleDoc());
  assert.deepEqual(flowing(doc, sampleStates({ dhw: true })), ["p1", "p2", "p3", "p4"]);
});

test("nothing runs, nothing flows", () => {
  const doc = normalize(sampleDoc());
  assert.deepEqual(flowing(doc, sampleStates({ pump: false, compressor: false })), []);
});

test("a heat pump without its own pump relies on the pumps outside", () => {
  const raw = sampleDoc();
  raw.nodes[0].params = { internal_pump: false };
  assert.deepEqual(flowing(normalize(raw), sampleStates({ dhw: true, pump: false })), []);
});

test("a closed loop actuator takes its loop out", () => {
  const raw = sampleDoc();
  raw.nodes.find((n) => n.id === "man").bindings = { loop_2: "binary_sensor.loop2" };
  const states = { ...sampleStates(), "binary_sensor.loop2": entity("binary_sensor.loop2", "off") };
  const pipes = flowing(normalize(raw), states);
  assert.ok(pipes.includes("p8") && !pipes.includes("p10") && !pipes.includes("p11"));
});

test("a pump turned against a check valve moves nothing", () => {
  const doc = normalize({
    id: "c",
    name: "check",
    nodes: [
      { id: "pump", type: "pump", x: 0, y: 0, bindings: { running: "switch.p" } },
      { id: "cv", type: "check_valve", x: 200, y: 0 },
      { id: "rad", type: "radiator", x: 400, y: 0 },
    ],
    pipes: [
      { id: "a", from: { node: "pump", port: "out" }, to: { node: "cv", port: "out" } },
      { id: "b", from: { node: "cv", port: "in" }, to: { node: "rad", port: "in" } },
      { id: "c", from: { node: "rad", port: "out" }, to: { node: "pump", port: "in" } },
    ],
  });
  assert.deepEqual(flowing(doc, { "switch.p": entity("switch.p", "on") }), []);
});

test("a loading unit warms its boiler through the bypass, then charges the tank", () => {
  const doc = normalize({
    id: "l",
    name: "laddomat",
    nodes: [
      { id: "boiler", type: "boiler", x: 0, y: 0, params: { fuel: "solid", internal_pump: false } },
      {
        id: "lu",
        type: "loading_unit",
        x: 200,
        y: 0,
        params: { opening_temp: 72 },
        bindings: { running: "switch.lu", from_boiler_temp: "sensor.hot" },
      },
      { id: "buf", type: "buffer_tank", x: 400, y: 0 },
    ],
    pipes: [
      { id: "f", from: { node: "boiler", port: "supply_out" }, to: { node: "lu", port: "boiler_flow" } },
      { id: "r", from: { node: "lu", port: "boiler_return" }, to: { node: "boiler", port: "return_in" } },
      { id: "t", from: { node: "lu", port: "tank_flow" }, to: { node: "buf", port: "l1" } },
      { id: "u", from: { node: "buf", port: "l2" }, to: { node: "lu", port: "tank_return" } },
    ],
  });
  const states = (running, hot) => ({
    "switch.lu": entity("switch.lu", running ? "on" : "off"),
    ...(hot === null ? {} : { "sensor.hot": entity("sensor.hot", hot, { unit_of_measurement: "°C", device_class: "temperature" }) }),
  });
  assert.deepEqual(flowing(doc, states(true, 60)), ["f", "r"]);
  assert.deepEqual(flowing(doc, states(true, 80)), ["f", "r", "t", "u"]);
  assert.deepEqual(flowing(doc, states(true, null)), ["f", "r", "t", "u"]);
  assert.deepEqual(flowing(doc, states(false, 80)), []);
});

test("an open tap draws water from the mains through the tank", () => {
  const doc = normalize({
    id: "w",
    name: "water",
    nodes: [
      { id: "mains", type: "cold_water_inlet", x: 400, y: 0 },
      { id: "tank", type: "dhw_tank", x: 0, y: 0 },
      { id: "tap", type: "dhw_tap", x: 300, y: 0, bindings: { flow: "sensor.tap" } },
    ],
    pipes: [
      { id: "cold", from: { node: "mains", port: "out" }, to: { node: "tank", port: "cold_in" } },
      { id: "hot", from: { node: "tank", port: "hot_out" }, to: { node: "tap", port: "in" } },
    ],
  });
  const tap = (value) => ({ "sensor.tap": entity("sensor.tap", value, { unit_of_measurement: "L/min" }) });
  assert.deepEqual(flowing(doc, tap(6)), ["cold", "hot"]);
  assert.deepEqual(flowing(doc, tap(0)), []);
});

test("a tank's extra hot outlet draws from its second cold inlet; the drain stays shut", () => {
  const doc = normalize({
    id: "w",
    name: "water",
    nodes: [
      { id: "mains", type: "cold_water_inlet", x: 400, y: 300 },
      { id: "tank", type: "dhw_tank", x: 0, y: 0, params: { hot_outlets: 3, cold_inlets: 2, drain: true, coils: "3" } },
      { id: "tap", type: "dhw_tap", x: 300, y: -100, bindings: { flow: "sensor.tap" } },
      { id: "sink", type: "drain", x: 0, y: 300 },
    ],
    pipes: [
      { id: "cold", from: { node: "mains", port: "out" }, to: { node: "tank", port: "cold_in_2" } },
      { id: "hot", from: { node: "tank", port: "hot_out_3" }, to: { node: "tap", port: "in" } },
      { id: "drain", from: { node: "tank", port: "drain" }, to: { node: "sink", port: "in" } },
    ],
  });
  const defs = resolveAll(doc);
  assert.equal(defs.get("tank").h, 240, "three coils make a taller tank");
  const tap = (value) => ({ "sensor.tap": entity("sensor.tap", value, { unit_of_measurement: "L/min" }) });
  assert.deepEqual(flowing(doc, tap(6)), ["cold", "hot"]);
});

test("an unavailable sensor reads as unknown, not as zero", () => {
  const doc = normalize(sampleDoc());
  const defs = resolveAll(doc);
  const states = sampleStates();
  states["sensor.flow"] = entity("sensor.flow", "unavailable");
  const live = evaluate(doc, defs, states);
  const value = live.nodes.get("hp").values.flow_temp;
  assert.equal(value.ok, false);
  assert.equal(value.num, null);
});

test("water does not flow into a dead end, such as an expansion vessel on a junction", () => {
  const raw = sampleDoc();
  raw.nodes.push({ id: "ev", type: "expansion_vessel", x: 400, y: 380, rotation: 180 });
  raw.pipes.find((p) => p.id === "p7").to = { node: "j1", port: "e" };
  raw.pipes.push({ id: "to_ev", from: { node: "j1", port: "s" }, to: { node: "ev", port: "connection" }, medium: "heating_return" });
  const pipes = flowing(normalize(raw), sampleStates({ dhw: false }));
  assert.ok(pipes.includes("p7"), "the loop still flows");
  assert.ok(!pipes.includes("to_ev"), "the vessel's pipe does not");
});

test("a manifold fed from the right works as one fed from the left", () => {
  const raw = sampleDoc();
  raw.nodes.find((n) => n.id === "man").params = { outlets: 2, feed: "right" };
  const pipes = flowing(normalize(raw), sampleStates({ dhw: false }));
  assert.ok(["p6", "p7", "p8", "p11"].every((id) => pipes.includes(id)), pipes.join(" "));
});

test("a manifold fed at both ends passes water on to the next one", () => {
  const raw = sampleDoc();
  raw.nodes.find((n) => n.id === "man").params = { outlets: 2, feed: "both" };
  raw.nodes.push(
    { id: "man2", type: "manifold", x: 900, y: 380, params: { outlets: 1 } },
    { id: "ufh3", type: "ufh", x: 900, y: 600 }
  );
  raw.pipes.push(
    { id: "q1", from: { node: "man", port: "supply_in_r" }, to: { node: "man2", port: "supply_in" }, medium: "heating_supply" },
    { id: "q2", from: { node: "man2", port: "return_out" }, to: { node: "man", port: "return_out_r" }, medium: "heating_return" },
    { id: "q3", from: { node: "man2", port: "out_1" }, to: { node: "ufh3", port: "in" }, medium: "heating_supply" },
    { id: "q4", from: { node: "ufh3", port: "out" }, to: { node: "man2", port: "ret_1" }, medium: "heating_return" }
  );
  const pipes = flowing(normalize(raw), sampleStates({ dhw: false }));
  assert.ok(["q1", "q2", "q3", "q4", "p8"].every((id) => pipes.includes(id)), pipes.join(" "));
});

test("a manifold's unused second feed carries nothing", () => {
  const raw = sampleDoc();
  raw.nodes.find((n) => n.id === "man").params = { outlets: 2, feed: "both" };
  raw.nodes.push({ id: "ev2", type: "expansion_vessel", x: 900, y: 300 });
  raw.pipes.push({ id: "dead", from: { node: "man", port: "supply_in_r" }, to: { node: "ev2", port: "connection" }, medium: "heating_supply" });
  assert.ok(!flowing(normalize(raw), sampleStates({ dhw: false })).includes("dead"));
});

test("a manifold with supplies up and returns down carries the same water", () => {
  const raw = sampleDoc();
  raw.nodes.find((n) => n.id === "man").params = { outlets: 2, style: "split" };
  const pipes = flowing(normalize(raw), sampleStates({ dhw: false }));
  assert.ok(["p6", "p7", "p8", "p9", "p10", "p11"].every((id) => pipes.includes(id)), pipes.join(" "));
});
