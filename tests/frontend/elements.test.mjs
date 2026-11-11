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
