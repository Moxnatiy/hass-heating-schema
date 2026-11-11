// Pipes run at right angles, leave ports straight, and keep their ends when edited.
import { test } from "node:test";
import assert from "node:assert/strict";

import { route, moveLeg } from "../../custom_components/heating_schema/frontend/core/router.js";
import { normalize, resolveAll } from "../../custom_components/heating_schema/frontend/core/model.js";
import { layPipe, branchPipe } from "../../custom_components/heating_schema/frontend/core/edits.js";
import { computeRoutes } from "../../custom_components/heating_schema/frontend/core/render.js";
import { sampleDoc } from "./fixtures.mjs";

const orthogonal = (points) => points.slice(1).every((p, i) => p.x === points[i].x || p.y === points[i].y);

test("every automatic route is orthogonal and starts at its ports", () => {
  const doc = normalize(sampleDoc());
  const routes = computeRoutes(doc, resolveAll(doc));
  assert.equal(routes.size, doc.pipes.length);
  for (const [id, points] of routes) assert.ok(orthogonal(points), id);
});

test("a route leaves a port the way it faces", () => {
  const points = route({ x: 0, y: 0, side: "r" }, { x: 100, y: 100, side: "l" });
  assert.ok(orthogonal(points));
  assert.equal(points[1].y, 0, "first leg is horizontal");
  assert.ok(points[1].x > 0, "and goes right");
});

test("user bends are kept and joined at right angles, without doubling back", () => {
  const points = route({ x: 0, y: 0, side: "r" }, { x: 200, y: 100, side: "l" }, [[100, -50]]);
  assert.ok(orthogonal(points));
  assert.ok(points.some((p) => p.x === 100 && p.y === -50));
  // From the bend the pipe goes on to the right, not back down over itself.
  const at = points.findIndex((p) => p.x === 100 && p.y === -50);
  assert.equal(points[at + 1].y, -50);
});

test("moving a leg next to a port adds a bend instead of moving the port", () => {
  const start = { x: 0, y: 0, side: "r" };
  const end = { x: 200, y: 100, side: "l" };
  const points = route(start, end, [[100, 0], [100, 100]]);
  const index = points.findIndex((p, i) => i > 0 && p.x === 100 && points[i + 1] && points[i + 1].x === 100);
  assert.ok(index > 0, "there is a vertical leg at x = 100");
  const after = route(start, end, moveLeg(points, index, 30));
  assert.ok(orthogonal(after));
  assert.deepEqual(after[0], { x: 0, y: 0 });
  assert.deepEqual(after[after.length - 1], { x: 200, y: 100 });
  assert.ok(after.some((p) => p.x === 130), "the vertical leg moved by 30");
});

test("the stub ends stay route points, so the first and last legs are the stubs", () => {
  const points = route({ x: 0, y: 0, side: "r" }, { x: 200, y: 0, side: "l" });
  assert.deepEqual(points[1], { x: 20, y: 0 });
  assert.deepEqual(points[points.length - 2], { x: 180, y: 0 });
});

test("a pipe is stored from outlet to inlet whichever end it was drawn from", () => {
  const doc = normalize({
    id: "d",
    name: "d",
    nodes: [
      { id: "pump", type: "pump", x: 0, y: 0 },
      { id: "rad", type: "radiator", x: 200, y: 0 },
    ],
    pipes: [],
  });
  const { pipe } = layPipe(doc, resolveAll(doc), { node: "rad", port: "in" }, { node: "pump", port: "out" });
  assert.deepEqual(pipe.from, { node: "pump", port: "out" });
  assert.equal(pipe.medium, "heating_supply");
});

test("a branch splits the pipe at a junction and keeps its direction", () => {
  const doc = normalize(sampleDoc());
  doc.nodes.push({ id: "ev", type: "expansion_vessel", x: 100, y: 400, rotation: 0, flip: false, label: "", params: {}, bindings: {} });
  const defs = resolveAll(doc);
  const leg = computeRoutes(doc, defs).get("p4");
  const before = doc.pipes.length;
  const made = branchPipe(doc, defs, { node: "ev", port: "connection" }, "p4", leg[0], leg[1], { x: 130, y: 480 });
  assert.ok(!made.error, made.error);
  assert.equal(doc.pipes.length, before + 2);
  assert.ok(!doc.pipes.some((p) => p.id === "p4"));
  const into = doc.pipes.filter((p) => p.to.node === made.junction.id || p.from.node === made.junction.id);
  assert.equal(into.length, 3);
  assert.ok(into.every((p) => p.medium === "heating_return"));
});

test("a branch refuses a circuit that may not join the pipe", () => {
  const doc = normalize(sampleDoc());
  doc.nodes.push({ id: "mains", type: "cold_water_inlet", x: 100, y: 400, rotation: 0, flip: false, label: "", params: {}, bindings: {} });
  const defs = resolveAll(doc);
  const leg = computeRoutes(doc, defs).get("p4");
  const made = branchPipe(doc, defs, { node: "mains", port: "out" }, "p4", leg[0], leg[1], { x: 130, y: 480 });
  assert.equal(made.error, "mix");
});

test("a pipe from a port facing away goes round its element instead of through it", () => {
  // A manifold's supply on top, to a loop drawn below the manifold.
  const box = { x: 0, y: 100, w: 200, h: 120 };
  const points = route({ x: 80, y: 100, side: "t" }, { x: 80, y: 300, side: "t" }, [], [box]);
  assert.ok(orthogonal(points));
  const crosses = points.slice(1).some((p, i) => {
    const a = points[i];
    const x1 = Math.min(a.x, p.x), x2 = Math.max(a.x, p.x), y1 = Math.min(a.y, p.y), y2 = Math.max(a.y, p.y);
    return x2 > box.x + 1 && x1 < box.x + box.w - 1 && y2 > box.y + 1 && y1 < box.y + box.h - 1;
  });
  assert.equal(crosses, false, JSON.stringify(points));
});
