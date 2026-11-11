// The live state of a schema: what each element reads, and where water moves.
//
// Water moves where a running pump pushes it round a closed loop. A pipe is
// flowing when it lies on a path from a running pump's outlet back to that
// pump's inlet, through the open passages of the elements in between: a
// closed valve, a three-way valve turned the other way, a check valve facing
// the wrong way all break that path. Open circuits — the mains through a hot
// water tank to an open tap — flow from a source to a sink the same way.
//
// Direction comes from the ports: a pipe from an outlet to an inlet runs one
// way; a pipe between two-way ports (a junction, a tank's side) runs whichever
// way the loop needs.

import { readBinding } from "./bindings.js";

/**
 * Evaluate a schema against Home Assistant's states.
 *
 * Returns { nodes: Map(id → live), pipes: Map(id → { flow, forward, values }) }
 * where live is { values, on, alarm, flowing } and flow is 0 when still, or
 * the speed of the fastest pump moving it (1 is full speed).
 */
export function evaluate(doc, defs, states) {
  const nodes = new Map();
  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (!def) continue;
    nodes.set(node.id, nodeLive(node, def, states));
  }

  const pipes = new Map();
  for (const pipe of doc.pipes) {
    const values = {};
    const entity = pipe.bindings && pipe.bindings.temperature;
    if (entity) values.temperature = readBinding("temperature", states && states[entity]);
    pipes.set(pipe.id, { flow: 0, forward: true, values });
  }

  const graph = buildGraph(doc, defs, nodes);
  for (const { node, def, speed } of drivers(doc, defs, nodes)) {
    const ports = def.ports.map((p) => p.id);
    const outlet = def.ports.find((p) => p.flow === "out");
    const inlet = def.ports.find((p) => p.flow === "in");
    if (!outlet || !inlet || !ports.length) continue;
    const starts = [`${node.id}:${outlet.id}`];
    const ends = [`${node.id}:${inlet.id}`];
    mark(graph, starts, ends, speed, pipes, nodes, node.id);
  }

  const sources = [];
  const sinks = [];
  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (!def) continue;
    if (def.source) sources.push(`${node.id}:${def.source(node)}`);
    if (def.sink && def.sink(node, nodes.get(node.id))) {
      for (const port of def.ports) if (port.flow !== "out") sinks.push(`${node.id}:${port.id}`);
    }
  }
  if (sources.length && sinks.length) {
    mark(graph, sources, sinks, 1, pipes, nodes);
  }

  return { nodes, pipes };
}

/** The readings of one element and the state they add up to. */
function nodeLive(node, def, states) {
  const values = {};
  for (const binding of def.bindings) {
    const entityId = node.bindings && node.bindings[binding.key];
    if (entityId) values[binding.key] = readBinding(binding.kind, states && states[entityId]);
  }
  const running = values.running;
  return {
    values,
    on: running && running.ok ? running.on : null,
    alarm: Boolean(values.alarm && values.alarm.ok && values.alarm.on),
    flowing: false,
  };
}

/** Elements that push water, with how fast. */
function drivers(doc, defs, nodes) {
  const list = [];
  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (!def || !def.drives) continue;
    const speed = def.drives(def.node, nodes.get(node.id));
    if (speed > 0) list.push({ node, def, speed });
  }
  return list;
}

/**
 * The hydraulic graph: a vertex per port, an edge per pipe and per open
 * passage, each with the direction water may take along it.
 */
function buildGraph(doc, defs, nodes) {
  const edges = [];
  const add = (u, v, extra) => edges.push({ u, v, ...extra });

  for (const pipe of doc.pipes) {
    const a = portOf(defs, pipe.from);
    const b = portOf(defs, pipe.to);
    if (!a || !b) continue;
    const u = `${pipe.from.node}:${pipe.from.port}`;
    const v = `${pipe.to.node}:${pipe.to.port}`;
    const forwardOnly = a.flow === "out" || b.flow === "in";
    const backwardOnly = a.flow === "in" || b.flow === "out";
    if (!backwardOnly || forwardOnly) add(u, v, { pipe: pipe.id, forward: true });
    if (!forwardOnly || backwardOnly) add(v, u, { pipe: pipe.id, forward: false });
  }

  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (!def || !def.passages) continue;
    for (const [from, to] of def.passages(def.node, nodes.get(node.id), def.ports)) {
      add(`${node.id}:${from}`, `${node.id}:${to}`, { node: node.id });
    }
  }

  const out = new Map();
  const into = new Map();
  for (const edge of edges) {
    if (!out.has(edge.u)) out.set(edge.u, []);
    if (!into.has(edge.v)) into.set(edge.v, []);
    out.get(edge.u).push(edge);
    into.get(edge.v).push(edge);
  }
  return { edges, out, in: into };
}

function portOf(defs, end) {
  const def = defs.get(end.node);
  return def ? def.ports.find((p) => p.id === end.port) : null;
}

/**
 * Vertices reachable from the starts along the edges of `adjacency`.
 *
 * `skip` is the driving pump: the search must go round the loop, not back
 * through the pump itself. `without` is a pipe the search may not use.
 */
function reach(adjacency, starts, skip = null, without = null) {
  const seen = new Set(starts);
  const queue = [...starts];
  while (queue.length) {
    const vertex = queue.shift();
    for (const edge of adjacency.get(vertex) || []) {
      if (skip && edge.node === skip) continue;
      if (without && edge.pipe === without) continue;
      const next = edge.u === vertex ? edge.v : edge.u;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/**
 * Mark every edge that lies on a path from the starts to the ends.
 *
 * A pipe that may carry water both ways needs a closer look: a dead end — an
 * expansion vessel on a junction — is reachable from the pump and leads back
 * to it, but only by going back through the very same pipe. Such a pipe flows
 * only if its two ends are joined to the loop without it.
 */
function mark(graph, starts, ends, speed, pipes, nodes, skip = null) {
  const forward = reach(graph.out, starts, skip);
  const backward = reach(graph.in, ends, skip);
  const twoWay = new Set();
  const seenOnce = new Set();
  for (const edge of graph.edges) {
    if (!edge.pipe) continue;
    if (seenOnce.has(edge.pipe)) twoWay.add(edge.pipe);
    seenOnce.add(edge.pipe);
  }
  const check = new Map();
  const onLoop = (edge) => {
    if (!twoWay.has(edge.pipe)) return true;
    if (!check.has(edge.pipe)) {
      check.set(edge.pipe, {
        forward: reach(graph.out, starts, skip, edge.pipe),
        backward: reach(graph.in, ends, skip, edge.pipe),
      });
    }
    const without = check.get(edge.pipe);
    return without.forward.has(edge.u) && without.backward.has(edge.v);
  };

  for (const edge of graph.edges) {
    if (skip && edge.node === skip) continue;
    if (!forward.has(edge.u) || !backward.has(edge.v)) continue;
    if (edge.pipe) {
      if (!onLoop(edge)) continue;
      const state = pipes.get(edge.pipe);
      if (speed > state.flow) {
        state.flow = speed;
        state.forward = edge.forward;
      }
    } else if (edge.node) {
      nodes.get(edge.node).flowing = true;
    }
  }
  if (skip) nodes.get(skip).flowing = true;
}
