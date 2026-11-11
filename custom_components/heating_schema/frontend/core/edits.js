// Edits of a schema document, as plain functions.
//
// Each takes the document (and the resolved elements where it needs ports),
// changes the document in place and returns what it made. The editor runs
// them inside EditorState.commit(), which makes them undoable; the tests run
// them directly.

import { snap, GRID } from "./geometry.js";
import { MEDIA, mediumFor, mediumFits } from "./media.js";
import { canConnect, portSpec, portWorld, createNode, mediumThrough, uid } from "./model.js";

/**
 * The medium for a pipe from port a (to port b, if known yet).
 *
 * A port that names its medium decides. Otherwise what already flows through
 * the element on the far side of either port does: a pipe drawn from a pump's
 * outlet carries what reaches its inlet. The medium last drawn comes last.
 */
export function newPipeMedium(doc, defs, a, b, fallbackMedium) {
  const pa = portSpec(doc, defs, a);
  const pb = b ? portSpec(doc, defs, b) : null;
  if (!(pa && pa.medium) && !(pb && pb.medium)) {
    for (const end of [a, b]) {
      if (!end) continue;
      const medium = mediumThrough(doc, defs, end);
      if (medium && !(pa && mediumFits(medium, pa)) && !(pb && mediumFits(medium, pb))) return medium;
    }
  }
  return mediumFor(pa, pb, fallbackMedium);
}

/**
 * Lay a pipe between two ports.
 *
 * Returns { pipe, verdict }: pipe is null when the ports may not be joined,
 * and verdict says why (see canConnect). The pipe is stored from outlet to
 * inlet whichever end the user started at, so its direction is the water's.
 */
export function layPipe(doc, defs, a, b, fallbackMedium) {
  const verdict = canConnect(doc, defs, a, b);
  if (!verdict.ok) return { pipe: null, verdict };
  const pa = portSpec(doc, defs, a);
  const pb = portSpec(doc, defs, b);
  const pipe = {
    id: uid("p"),
    from: { ...a },
    to: { ...b },
    medium: newPipeMedium(doc, defs, a, b, fallbackMedium),
    dn: "",
    label: "",
    points: [],
    bindings: {},
  };
  if (pa.flow === "in" || pb.flow === "out") [pipe.from, pipe.to] = [pipe.to, pipe.from];
  doc.pipes.push(pipe);
  return { pipe, verdict };
}

/**
 * Branch off a pipe: put a junction on one of its legs and join a new pipe
 * from a port to it.
 *
 * legA, legB: the leg's ends as routed; near: the point the junction should
 * be close to (the port the branch comes from). Returns { branch, junction }
 * or { error, families } when the port's circuit cannot join the pipe's.
 */
export function branchPipe(doc, defs, from, pipeId, legA, legB, near) {
  const pipe = doc.pipes.find((p) => p.id === pipeId);
  const startPort = portSpec(doc, defs, from);
  if (!pipe || !startPort) return { error: "no_port" };
  if (pipe.from.node === from.node || pipe.to.node === from.node) return { error: "same_element" };
  if (mediumFits(pipe.medium, startPort) === "error") {
    return { error: "mix", families: [startPort.family, (MEDIA[pipe.medium] || MEDIA.other).family] };
  }

  // The junction sits on the leg, on the grid, as close to the port as the
  // leg allows, and a grid step away from the leg's ends.
  const horizontal = legA.y === legB.y;
  const lo = (horizontal ? Math.min(legA.x, legB.x) : Math.min(legA.y, legB.y)) + GRID;
  const hi = (horizontal ? Math.max(legA.x, legB.x) : Math.max(legA.y, legB.y)) - GRID;
  const along = Math.min(Math.max(snap(horizontal ? near.x : near.y), lo), Math.max(lo, hi));
  const centre = horizontal ? { x: along, y: legA.y } : { x: legA.x, y: along };

  const junction = createNode("junction", centre.x, centre.y);
  junction.x = centre.x - 10;
  junction.y = centre.y - 10;

  // The pipe keeps its direction through the junction.
  const forward = horizontal ? legB.x > legA.x : legB.y > legA.y;
  const [inPort, outPort] = horizontal ? (forward ? ["w", "e"] : ["e", "w"]) : forward ? ["n", "s"] : ["s", "n"];
  const branchPort = horizontal ? (near.y < centre.y ? "n" : "s") : near.x < centre.x ? "w" : "e";

  const first = { ...pipe, id: uid("p"), to: { node: junction.id, port: inPort }, points: [] };
  const second = { ...pipe, id: uid("p"), from: { node: junction.id, port: outPort }, points: [] };
  const branch = {
    id: uid("p"),
    from: { ...from },
    to: { node: junction.id, port: branchPort },
    medium: pipe.medium,
    dn: "",
    label: "",
    points: [],
    bindings: {},
  };
  if (startPort.flow === "in") [branch.from, branch.to] = [branch.to, branch.from];

  doc.nodes.push(junction);
  doc.pipes = doc.pipes.filter((p) => p.id !== pipe.id);
  doc.pipes.push(first, second, branch);
  return { branch, junction };
}

/** Turn elements by a quarter; their pipes drop their bends and re-route. */
export function rotateNodes(doc, ids, step = 90) {
  for (const node of doc.nodes) {
    if (ids.has(node.id)) node.rotation = ((((node.rotation || 0) + step) % 360) + 360) % 360;
  }
  resetPipesOf(doc, ids);
}

/** Mirror elements left to right. */
export function flipNodes(doc, ids) {
  for (const node of doc.nodes) if (ids.has(node.id)) node.flip = !node.flip;
  resetPipesOf(doc, ids);
}

function resetPipesOf(doc, ids) {
  for (const pipe of doc.pipes) {
    if (ids.has(pipe.from.node) || ids.has(pipe.to.node)) pipe.points = [];
  }
}

/** Remove elements with their pipes, and a pipe on its own. */
export function removeSelection(doc, ids, pipeId = null) {
  doc.nodes = doc.nodes.filter((n) => !ids.has(n.id));
  doc.pipes = doc.pipes.filter((p) => p.id !== pipeId && !ids.has(p.from.node) && !ids.has(p.to.node));
}

export function moveNodes(doc, ids, dx, dy) {
  for (const node of doc.nodes) {
    if (!ids.has(node.id)) continue;
    node.x += dx;
    node.y += dy;
  }
}

/**
 * Insert a copy of clipboard content, offset from the original. Elements get
 * new ids, and the pipes between them follow. Returns the new element ids.
 */
export function pasteClip(doc, clip, offset = 2 * GRID) {
  const ids = new Map(clip.nodes.map((n) => [n.id, uid("n")]));
  const nodes = clip.nodes.map((n) => ({
    ...structuredClone(n),
    id: ids.get(n.id),
    x: n.x + offset,
    y: n.y + offset,
  }));
  const pipes = clip.pipes.map((p) => ({
    ...structuredClone(p),
    id: uid("p"),
    from: { node: ids.get(p.from.node), port: p.from.port },
    to: { node: ids.get(p.to.node), port: p.to.port },
    points: p.points.map(([x, y]) => [x + offset, y + offset]),
  }));
  doc.nodes.push(...nodes);
  doc.pipes.push(...pipes);
  return nodes.map((n) => n.id);
}

/** Where a port of an element is in the drawing, for gestures. */
export function portAt(doc, defs, end) {
  const node = doc.nodes.find((n) => n.id === end.node);
  const def = defs.get(end.node);
  return node && def ? portWorld(node, def, end.port) : null;
}
