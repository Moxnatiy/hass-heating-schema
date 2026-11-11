// The schema document and what can be asked of it.
//
// A document:
//   { id, name, version, settings,
//     nodes: [{ id, type, x, y, rotation, flip, flip_y, scale, label, params,
//               bindings }],
//     pipes: [{ id, from: {node, port}, to: {node, port}, medium, dn, label,
//               points: [[x, y], …], bindings }] }
//
// Pipes join ports, one pipe per port: a branch is drawn with a junction, as
// it is built with a tee. `points` are the bends the user placed; without them
// the router finds a path.

import { resolve, defaultParams } from "../elements/index.js";
import { toWorld, worldSide, worldBox, snap, SCALES } from "./geometry.js";
import { MEDIA, familiesCompatible, mediumFits } from "./media.js";
import { checkEntity, KINDS } from "./bindings.js";

export const VERSION = 1;

export function uid(prefix = "n") {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${random}`;
}

export function newDocument(name) {
  return { id: null, name, version: VERSION, settings: {}, nodes: [], pipes: [] };
}

/** A fresh copy that later edits cannot reach into. */
export const clone = (value) => JSON.parse(JSON.stringify(value));

/** Fill in what an older or hand-written document leaves out. */
export function normalize(doc) {
  const out = {
    id: doc.id ?? null,
    name: doc.name || "",
    version: VERSION,
    settings: { ...(doc.settings || {}) },
    nodes: (doc.nodes || []).map((node) => ({
      id: node.id,
      type: node.type,
      x: Number(node.x) || 0,
      y: Number(node.y) || 0,
      rotation: [0, 90, 180, 270].includes(node.rotation) ? node.rotation : 0,
      flip: Boolean(node.flip),
      flip_y: Boolean(node.flip_y),
      scale: SCALES.includes(node.scale) ? node.scale : 1,
      label: node.label || "",
      params: { ...defaultParams(node.type), ...(node.params || {}) },
      bindings: { ...(node.bindings || {}) },
    })),
    pipes: (doc.pipes || []).map((pipe) => ({
      id: pipe.id,
      from: { ...pipe.from },
      to: { ...pipe.to },
      medium: MEDIA[pipe.medium] ? pipe.medium : "other",
      dn: pipe.dn || "",
      label: pipe.label || "",
      points: (pipe.points || []).map(([x, y]) => [Number(x), Number(y)]),
      bindings: { ...(pipe.bindings || {}) },
    })),
  };
  return out;
}

/** Resolved elements by node id; unknown types are left out. */
export function resolveAll(doc) {
  const map = new Map();
  for (const node of doc.nodes) {
    const def = resolve(node);
    if (def) map.set(node.id, def);
  }
  return map;
}

/** A port in drawing coordinates, with the side it faces. */
export function portWorld(node, def, portId) {
  const port = def.ports.find((p) => p.id === portId);
  if (!port) return null;
  const at = toWorld(node, def, port.x, port.y);
  return { ...port, x: at.x, y: at.y, side: worldSide(node, port.side) };
}

/** The pipe attached to each port, keyed "node:port". */
export function portUse(doc) {
  const used = new Map();
  for (const pipe of doc.pipes) {
    used.set(`${pipe.from.node}:${pipe.from.port}`, pipe.id);
    used.set(`${pipe.to.node}:${pipe.to.port}`, pipe.id);
  }
  return used;
}

/** A new element of a type, its box's corner snapped near (x, y). */
export function createNode(type, x, y) {
  const node = {
    id: uid("n"),
    type,
    x: 0,
    y: 0,
    rotation: 0,
    flip: false,
    flip_y: false,
    scale: 1,
    label: "",
    params: defaultParams(type),
    bindings: {},
  };
  const def = resolve(node);
  node.x = snap(x - (def ? def.w / 2 : 0));
  node.y = snap(y - (def ? def.h / 2 : 0));
  return node;
}

/**
 * Whether the schema lets circuits that must not mix be joined anyway
 * (settings.allow_mixing): the drawing may show what is really installed,
 * right or wrong. Such pipes are then warnings instead of refused.
 */
export function mixingAllowed(doc) {
  return Boolean(doc.settings && doc.settings.allow_mixing);
}

/**
 * Whether a pipe may join two ports, and why not.
 *
 * Returns { ok, level, reason }: level "error" refuses the pipe, "warning"
 * allows it and keeps a note in the problem list. Reasons are translation keys.
 */
export function canConnect(doc, defs, a, b) {
  if (a.node === b.node && a.port === b.port) return { ok: false, level: "error", reason: "same_port" };
  const used = portUse(doc);
  if (used.has(`${a.node}:${a.port}`) || used.has(`${b.node}:${b.port}`)) {
    return { ok: false, level: "error", reason: "port_taken" };
  }
  const pa = portSpec(doc, defs, a);
  const pb = portSpec(doc, defs, b);
  if (!pa || !pb) return { ok: false, level: "error", reason: "no_port" };
  if (a.node === b.node) {
    // Joining two ports of one element short-circuits it: a pipe from a
    // boiler's supply straight back to its return carries no heat anywhere.
    return { ok: true, level: "warning", reason: "same_element" };
  }
  if (!familiesCompatible(pa.family, pb.family)) {
    const allowed = mixingAllowed(doc);
    return { ok: allowed, level: allowed ? "warning" : "error", reason: "mix", families: [pa.family, pb.family] };
  }
  if (pa.flow === "out" && pb.flow === "out") return { ok: true, level: "warning", reason: "out_to_out" };
  if (pa.flow === "in" && pb.flow === "in") return { ok: true, level: "warning", reason: "in_to_in" };
  if (pa.role && pb.role && pa.role !== pb.role) return { ok: true, level: "warning", reason: "supply_to_return" };
  return { ok: true, level: null, reason: null };
}

export function portSpec(doc, defs, end) {
  const def = defs.get(end.node);
  return def ? def.ports.find((p) => p.id === end.port) || null : null;
}

/** An element's state when nothing is known: every valve as drawn. */
const UNKNOWN_LIVE = { values: {}, on: null, alarm: false, flowing: false };

/** Every way water may take through an element, whatever its live state. */
function possiblePassages(def) {
  return def && def.passages ? def.passages(def.node, UNKNOWN_LIVE, def.ports) : [];
}

/** The ports a port leads to inside its element. */
function portsBeyond(def, portId) {
  const beyond = new Set();
  for (const [a, b] of possiblePassages(def)) {
    if (a === portId) beyond.add(b);
    if (b === portId) beyond.add(a);
  }
  return beyond;
}

/**
 * The medium already flowing on the far side of a port: a pump's outlet
 * carries what reaches its inlet. Null when nothing is piped there yet.
 */
export function mediumThrough(doc, defs, end) {
  const beyond = portsBeyond(defs.get(end.node), end.port);
  for (const pipe of doc.pipes) {
    for (const side of [pipe.from, pipe.to]) {
      if (side.node === end.node && beyond.has(side.port)) return pipe.medium;
    }
  }
  return null;
}

/**
 * Pipes whose circuit changes inside an element without a heat exchanger:
 * a pump with heating water on one side and hot water on the other.
 */
function mediaAcross(doc, defs, list) {
  // One warning per element: which of its pipes is wrong is for the user to say.
  const flagged = new Set();
  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    const on = (port) =>
      doc.pipes.filter(
        (p) => (p.from.node === node.id && p.from.port === port) || (p.to.node === node.id && p.to.port === port)
      );
    for (const [a, b] of possiblePassages(def)) {
      for (const pa of on(a)) {
        for (const pb of on(b)) {
          const fa = (MEDIA[pa.medium] || MEDIA.other).family;
          const fb = (MEDIA[pb.medium] || MEDIA.other).family;
          if (familiesCompatible(fa, fb) || flagged.has(node.id)) continue;
          flagged.add(node.id);
          list.push({ level: "warning", code: "medium_across", pipe: pb.id, node: node.id });
        }
      }
    }
  }
}

/**
 * Everything in the drawing that is technically wrong or doubtful.
 *
 * Each problem: { level: "error" | "warning", code, node?, pipe?, port?,
 * binding? }. The editor lists them and marks the element they belong to.
 */
export function problems(doc, defs, states) {
  const list = [];
  const used = portUse(doc);

  for (const pipe of doc.pipes) {
    const a = portSpec(doc, defs, pipe.from);
    const b = portSpec(doc, defs, pipe.to);
    if (!a || !b) {
      list.push({ level: "error", code: "pipe_dangling", pipe: pipe.id });
      continue;
    }
    if (!familiesCompatible(a.family, b.family)) {
      list.push({ level: "error", code: "pipe_mixes", pipe: pipe.id });
    }
    for (const [port, end] of [
      [a, pipe.from],
      [b, pipe.to],
    ]) {
      const fit = mediumFits(pipe.medium, port);
      if (fit) list.push({ level: fit, code: fit === "error" ? "medium_wrong" : "medium_role", pipe: pipe.id, node: end.node, port: port.id });
    }
    if (a.flow === "out" && b.flow === "out") list.push({ level: "warning", code: "out_to_out", pipe: pipe.id });
    if (a.flow === "in" && b.flow === "in") list.push({ level: "warning", code: "in_to_in", pipe: pipe.id });
  }
  mediaAcross(doc, defs, list);
  if (mixingAllowed(doc)) {
    for (const problem of list) {
      if (problem.code === "pipe_mixes" || problem.code === "medium_wrong") problem.level = "warning";
    }
  }

  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (!def) {
      list.push({ level: "warning", code: "unknown_type", node: node.id });
      continue;
    }
    // An open port on anything but a sensor tapping a pipe is a missing pipe.
    if (def.type !== "junction") {
      for (const port of def.ports) {
        if (!used.has(`${node.id}:${port.id}`)) {
          list.push({ level: "warning", code: "port_open", node: node.id, port: port.id });
        }
      }
    }
    for (const binding of def.bindings) {
      const entityId = node.bindings[binding.key];
      if (!entityId) continue;
      const stateObj = states && states[entityId];
      if (states && !stateObj) {
        list.push({ level: "warning", code: "entity_missing", node: node.id, binding: binding.key });
        continue;
      }
      const fit = checkEntity(binding.kind, stateObj);
      if (fit !== "ok") {
        list.push({ level: fit, code: fit === "error" ? "entity_wrong_kind" : "entity_odd_unit", node: node.id, binding: binding.key });
      }
    }
  }

  // A heating circuit must be able to expand, and must be able to blow off
  // pressure: EN 12828 asks for both on every closed system with a heat source.
  const types = new Set(doc.nodes.map((n) => n.type));
  const heated = ["boiler", "heat_pump", "solar_collector"].some((t) => types.has(t));
  if (heated && !types.has("expansion_vessel")) list.push({ level: "warning", code: "no_expansion" });
  if (heated && !types.has("safety_valve")) list.push({ level: "warning", code: "no_safety_valve" });
  return list;
}

/** The box of the whole drawing, for zoom-to-fit. */
export function bounds(doc, defs) {
  const boxes = [];
  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (def) boxes.push(worldBox(node, def));
  }
  for (const pipe of doc.pipes) for (const [x, y] of pipe.points) boxes.push({ x, y, w: 0, h: 0 });
  if (!boxes.length) return { x: 0, y: 0, w: 400, h: 300 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Remove nodes and every pipe that touches them. */
export function removeNodes(doc, ids) {
  const gone = new Set(ids);
  doc.nodes = doc.nodes.filter((n) => !gone.has(n.id));
  doc.pipes = doc.pipes.filter((p) => !gone.has(p.from.node) && !gone.has(p.to.node));
}

/** Pipes whose ports no longer exist after a parameter changed the element. */
export function dropDanglingPipes(doc, defs) {
  doc.pipes = doc.pipes.filter((p) => portSpec(doc, defs, p.from) && portSpec(doc, defs, p.to));
}

/** Kinds a binding may use, for the binding editor's hint. */
export const bindingKinds = KINDS;
