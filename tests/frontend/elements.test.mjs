// Every element keeps the contract of elements/registry.js.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ELEMENTS, ELEMENT_TYPES, CATEGORIES, resolve, defaultParams } from "../../custom_components/heating_schema/frontend/elements/index.js";
import { toWorld, GRID } from "../../custom_components/heating_schema/frontend/core/geometry.js";
import { KINDS } from "../../custom_components/heating_schema/frontend/core/bindings.js";
import { setLanguage, has, t, portName, bindingName } from "../../custom_components/heating_schema/frontend/core/i18n.js";

const EMPTY = { values: {}, on: null, alarm: false, flowing: false };
const ctx = (ports) => ({ uid: "t", connected: new Set(ports.map((p) => p.id)), text: () => {} });

/** Every parameter combination worth checking: each select option once. */
function variants(type) {
  const base = defaultParams(type);
  const list = [base];
  for (const param of ELEMENTS[type].params) {
    if (param.type === "select") for (const o of param.options) list.push({ ...base, [param.key]: o });
    if (param.type === "bool") list.push({ ...base, [param.key]: !param.default });
    if (param.type === "number" && param.max <= 16) list.push({ ...base, [param.key]: param.max }, { ...base, [param.key]: param.min });
  }
  return list;
}

for (const type of ELEMENT_TYPES) {
  test(`${type}: box, ports and passages`, () => {
    const def0 = ELEMENTS[type];
    assert.ok(CATEGORIES.includes(def0.category), `unknown category ${def0.category}`);
    for (const params of variants(type)) {
      const def = resolve({ id: "x", type, x: 0, y: 0, params });
      assert.equal(def.w % (2 * GRID), 0, "width is a multiple of 20");
      assert.equal(def.h % (2 * GRID), 0, "height is a multiple of 20");
      const ids = def.ports.map((p) => p.id);
      assert.equal(new Set(ids).size, ids.length, "port ids are unique");
      for (const p of def.ports) {
        assert.equal(p.x % GRID, 0, `${p.id} x on the grid`);
        assert.equal(p.y % GRID, 0, `${p.id} y on the grid`);
        const onEdge = { l: p.x === 0, r: p.x === def.w, t: p.y === 0, b: p.y === def.h }[p.side];
        assert.ok(onEdge, `${p.id} sits on its ${p.side} edge`);
        assert.ok(["in", "out", "both"].includes(p.flow));
      }
      for (const [a, b] of def.passages(def.node, EMPTY, def.ports)) {
        assert.ok(ids.includes(a) && ids.includes(b), `passage ${a}→${b} joins real ports`);
      }
      for (const binding of def.bindings) assert.ok(KINDS[binding.kind], `${binding.key} has a known kind`);
      const svg = def.draw(def.node, EMPTY, ctx(def.ports), def);
      assert.equal(typeof svg, "string");
      assert.ok(!svg.includes("undefined") && !svg.includes("NaN"), "drawing has no holes");
    }
  });

  test(`${type}: ports stay on the grid when rotated and mirrored`, () => {
    const def = resolve({ id: "x", type, x: 0, y: 0, params: {} });
    for (const rotation of [0, 90, 180, 270]) {
      for (const flip of [false, true]) {
        const node = { x: 100, y: 200, rotation, flip };
        for (const p of def.ports) {
          const at = toWorld(node, def, p.x, p.y);
          assert.equal(at.x % GRID, 0, `${p.id} at ${rotation}° flip ${flip}`);
          assert.equal(at.y % GRID, 0, `${p.id} at ${rotation}° flip ${flip}`);
        }
      }
    }
  });

  for (const language of ["en", "uk"]) {
    test(`${type}: every text exists in ${language}`, () => {
      setLanguage(language);
      const missing = [];
      const need = (key) => {
        if (!has(key)) missing.push(key);
      };
      need(`element.${type}`);
      for (const param of ELEMENTS[type].params) {
        need(`param.${param.key}`);
        if (param.type === "select") for (const o of param.options) need(`option.${param.key}.${o}`);
      }
      for (const params of variants(type)) {
        const def = resolve({ id: "x", type, x: 0, y: 0, params });
        for (const p of def.ports) if (portName(p.id).startsWith("port.")) missing.push(`port.${p.id}`);
        for (const b of def.bindings) if (bindingName(b.key).startsWith("binding.")) missing.push(`binding.${b.key}`);
      }
      assert.deepEqual([...new Set(missing)], []);
      assert.ok(t(`category.${ELEMENTS[type].category}`) !== `category.${ELEMENTS[type].category}`);
    });
  }
}

test("a two-sided manifold puts odd loops down and even loops up, two to a place", () => {
  const def = resolve({ id: "m", type: "manifold", x: 0, y: 0, params: { outlets: 5, style: "both" } });
  const at = (id) => def.ports.find((p) => p.id === id);
  assert.equal(def.w, 80 * 3 + 40);
  for (const k of [1, 3, 5]) assert.deepEqual([at(`out_${k}`).side, at(`ret_${k}`).side], ["b", "b"], `loop ${k}`);
  for (const k of [2, 4]) assert.deepEqual([at(`out_${k}`).side, at(`ret_${k}`).side], ["t", "t"], `loop ${k}`);
  // A pair up and a pair down share a place, supply on the left of each.
  assert.deepEqual([at("out_1").x, at("ret_1").x, at("out_2").x, at("ret_2").x], [60, 100, 60, 100]);
});

test("a towel rail on the hot water circulation takes hot water, not heating", () => {
  const heating = resolve({ id: "t", type: "towel_rail", x: 0, y: 0, params: {} });
  const dhw = resolve({ id: "t", type: "towel_rail", x: 0, y: 0, params: { purpose: "dhw", connection: "cross" } });
  assert.deepEqual(heating.ports.map((p) => [p.id, p.family, p.side]), [["in", "heating", "b"], ["out", "heating", "b"]]);
  assert.deepEqual(dhw.ports.map((p) => [p.id, p.family, p.side]), [["in", "dhw", "l"], ["out", "dhw", "r"]]);
  assert.ok(!heating.bindings.some((b) => b.key === "heater"));
  const hybrid = resolve({ id: "t", type: "towel_rail", x: 0, y: 0, params: { heater: true } });
  assert.ok(hybrid.bindings.some((b) => b.key === "heater"));
});

test("a hot water tank's extra outlets and inlets sit beside the main ones", () => {
  const def = resolve({
    id: "t",
    type: "dhw_tank",
    x: 0,
    y: 0,
    params: { hot_outlets: 3, cold_inlets: 3, circulation: true, drain: true },
  });
  const at = (id) => def.ports.find((p) => p.id === id);
  const right = (id) => [at(id).side, at(id).x, at(id).y];
  assert.deepEqual(["hot_out", "hot_out_2", "hot_out_3"].map(right), [["r", 100, 40], ["r", 100, 60], ["r", 100, 80]]);
  assert.deepEqual(["cold_in", "cold_in_2", "cold_in_3"].map(right), [["r", 100, 160], ["r", 100, 140], ["r", 100, 120]]);
  // The circulation and the drain stay where they were.
  assert.deepEqual(right("circ_in"), ["r", 100, 100]);
  assert.deepEqual([at("drain").side, at("drain").x], ["b", 30]);
  // Every cold inlet reaches every hot outlet.
  const passages = def.passages(def.node, {});
  for (const c of ["cold_in_2", "cold_in_3"]) assert.ok(passages.some(([a, b]) => a === c && b === "hot_out_3"));
});

test("a hot water tank's hot water can leave on top and cold come in underneath", () => {
  const def = resolve({
    id: "t",
    type: "dhw_tank",
    x: 0,
    y: 0,
    params: { hot_outlets: 3, cold_inlets: 3, hot_connection: "top", cold_connection: "bottom", drain: true },
  });
  const where = (id) => {
    const p = def.ports.find((q) => q.id === id);
    return [p.side, p.x, p.y];
  };
  assert.deepEqual(["hot_out", "hot_out_2", "hot_out_3"].map(where), [["t", 50, 0], ["t", 70, 0], ["t", 30, 0]]);
  assert.deepEqual(["cold_in", "cold_in_2", "cold_in_3"].map(where), [["b", 50, 200], ["b", 70, 200], ["b", 90, 200]]);
  assert.deepEqual(where("drain"), ["b", 30, 200]);
});

test("a drawn line or frame keeps to the grid whatever length is typed", () => {
  assert.deepEqual([resolve({ id: "l", type: "line", x: 0, y: 0, params: { length: 333 } }).w], [340]);
  assert.equal(resolve({ id: "l", type: "dashed_line", x: 0, y: 0, params: { length: 5 } }).w, 40);
  const frame = resolve({ id: "f", type: "frame", x: 0, y: 0, params: { width: 250, height: 90 } });
  assert.deepEqual([frame.w, frame.h], [260, 100]);
  assert.equal(resolve({ id: "l", type: "dashed_line", x: 0, y: 0, params: {} }).node.params.stroke, "dashed");
});
