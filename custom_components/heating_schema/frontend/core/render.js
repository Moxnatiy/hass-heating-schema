// Drawing a schema into SVG, and keeping it current.
//
// The drawing is built once per document; live updates then touch only what
// changed. A state change of one pump redraws that pump, not the sheet, so
// the fans and the water in the other pipes keep moving instead of jumping
// back to the start of their animation on every sensor update.

import { toWorld, worldBox, nodeTransform, scaleOf } from "./geometry.js";
import { route, pathData } from "./router.js";
import { MEDIA } from "./media.js";
import { portWorld } from "./model.js";
import { temperatureColor } from "./colors.js";
import { t as tr, elementName } from "./i18n.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const EMPTY_LIVE = { values: {}, on: null, alarm: false, flowing: false };

/** How far above its element a label's centre sits. */
const LABEL_GAP = 17;

export class SchemaRenderer {
  /**
   * @param {SVGGElement} root  the group the drawing goes into
   * @param {object} options    { editing, showPorts, animate, showValues }
   */
  constructor(root, options = {}) {
    this.root = root;
    this.options = { editing: false, showPorts: false, animate: true, showValues: true, ...options };
    this.doc = null;
    this.defs = new Map();
    this.routes = new Map();
    this.live = null;
    this._nodeSignatures = new Map();
  }

  setOptions(options) {
    this.options = { ...this.options, ...options };
    if (this.doc) this.setDocument(this.doc, this.defs);
  }

  /** Draw a document from scratch. */
  setDocument(doc, defs) {
    this.doc = doc;
    this.defs = defs;
    this.routes = computeRoutes(doc, defs);
    this._nodeSignatures.clear();
    const pipes = doc.pipes.map((pipe) => this._pipe(pipe)).join("");
    const nodes = doc.nodes
      .filter((node) => defs.has(node.id))
      .map((node) => `<g class="hs-node" data-node="${esc(node.id)}">${this._nodeInner(node)}</g>`)
      .join("");
    this.root.innerHTML = `<g class="hs-pipes">${pipes}</g><g class="hs-nodes">${nodes}</g>`;
    if (this.live) this.setLive(this.live, true);
  }

  /** Apply a new live state; only elements and pipes that changed are touched. */
  setLive(live, force = false) {
    this.live = live;
    if (!this.doc) return;
    for (const node of this.doc.nodes) {
      const state = live.nodes.get(node.id);
      if (!state) continue;
      const signature = JSON.stringify(state);
      if (!force && this._nodeSignatures.get(node.id) === signature) continue;
      this._nodeSignatures.set(node.id, signature);
      const group = this.root.querySelector(`[data-node="${cssEscape(node.id)}"]`);
      if (group) group.innerHTML = this._nodeInner(node);
    }
    for (const pipe of this.doc.pipes) {
      const state = live.pipes.get(pipe.id);
      const group = this.root.querySelector(`[data-pipe="${cssEscape(pipe.id)}"]`);
      if (!state || !group) continue;
      const flow = group.querySelector(".hs-flow");
      const moving = this.options.animate && state.flow > 0;
      group.classList.toggle("hs-flowing", moving);
      if (flow) {
        flow.style.setProperty("--hs-flow-speed", `${(1.4 / Math.max(state.flow, 0.2)).toFixed(2)}s`);
        flow.classList.toggle("hs-reverse", !state.forward);
      }
      const reading = group.querySelector(".hs-pipe-value");
      const value = state.values && state.values.temperature;
      if (reading) reading.textContent = value ? value.text : "";
    }
  }

  // ---- pipes ---------------------------------------------------------------------

  _pipe(pipe) {
    const points = this.routes.get(pipe.id);
    if (!points) return "";
    const medium = MEDIA[pipe.medium] || MEDIA.other;
    const d = pathData(points);
    const dash = medium.dash ? ` stroke-dasharray="${medium.dash}"` : "";
    const label = [pipe.label, pipe.dn].filter(Boolean).join(" · ");
    const mid = middleOf(points);
    const text =
      label || (pipe.bindings && pipe.bindings.temperature)
        ? `<text class="hs-pipe-label" text-anchor="middle" x="${mid.x}" y="${mid.y - 8}">${esc(label)}<tspan class="hs-pipe-value" dx="${label ? 6 : 0}"></tspan></text>`
        : "";
    return (
      `<g class="hs-pipe-group" data-pipe="${esc(pipe.id)}" style="--hs-medium:${medium.color}">` +
      `<path class="hs-pipe-halo" d="${d}"/>` +
      `<path class="hs-pipe"${dash} d="${d}"/>` +
      `<path class="hs-flow" d="${d}"/>` +
      text +
      `</g>`
    );
  }

  // ---- elements ------------------------------------------------------------------

  _nodeInner(node) {
    const def = this.defs.get(node.id);
    const live = (this.live && this.live.nodes.get(node.id)) || EMPTY_LIVE;
    const texts = [];
    const connected = new Set();
    for (const pipe of this.doc.pipes) {
      if (pipe.from.node === node.id) connected.add(pipe.from.port);
      if (pipe.to.node === node.id) connected.add(pipe.to.port);
    }
    const ctx = {
      uid: node.id,
      connected,
      text: (x, y, value, cls = "", anchor = "middle") => texts.push({ x, y, value, cls, anchor }),
    };
    const body = def.draw(def.node, live, ctx, def);
    const transform = nodeTransform(node, def);

    // The drawing's own letters grow and shrink with it, upright; the label
    // and the live values keep their size, to stay readable.
    const s = scaleOf(node);
    let upright = "";
    for (const item of texts) {
      const at = toWorld(node, def, item.x, item.y);
      const sized = s === 1 ? "" : ` transform="translate(${at.x} ${at.y}) scale(${s}) translate(${-at.x} ${-at.y})"`;
      upright += `<text class="hs-text ${item.cls}" x="${at.x}" y="${at.y}" text-anchor="${item.anchor}"${sized}>${esc(item.value)}</text>`;
    }
    upright += this._label(node, def);
    if (this.options.showValues) upright += this._values(node, def, live);
    const ports = this.options.editing || this.options.showPorts ? this._ports(node, def, connected) : "";
    // An invisible box under the drawing, so an element with an open or
    // transparent body is grabbed anywhere inside it, not only on its lines.
    // The ports come after it and stay on top.
    const hit = `<rect class="hs-hit" width="${def.w}" height="${def.h}"/>`;
    return `<g class="hs-symbol${live.flowing ? " hs-flowing-node" : ""}" transform="${transform}">${hit}${body}</g>${upright}${ports}`;
  }

  _label(node, def) {
    if (def.hideLabel) return "";
    const box = worldBox(node, def);
    const name = node.label || elementName(node.type);
    // Text is centred on its y: high enough that the letters and their halo
    // clear the ports on the element's top edge.
    return `<text class="hs-label" text-anchor="middle" x="${box.x + box.w / 2}" y="${box.y - LABEL_GAP}">${esc(name)}</text>`;
  }

  /**
   * The element's live values: at their spot (a tank's sensors), in its value
   * panel (a heat pump's display), or listed under it.
   */
  _values(node, def, live) {
    // An element decides what it shows by default; the inspector can show or
    // hide each value (params show_<key> / hide_<key>).
    const shown = def.bindings.filter(
      (b) => live.values[b.key] && (b.show ? !node.params[`hide_${b.key}`] : node.params[`show_${b.key}`])
    );
    if (!shown.length) return "";
    let out = "";
    const listed = [];
    for (const binding of shown) {
      const value = live.values[binding.key];
      const spot = def.spots && def.spots[binding.key];
      if (spot) {
        const at = toWorld(node, def, spot[0], spot[1]);
        out += pill(at.x, at.y, value, binding);
      } else {
        listed.push([binding, value]);
      }
    }
    if (!listed.length) return out;
    if (def.panel) {
      const at = toWorld(node, def, def.panel.x, def.panel.y);
      listed.forEach(([binding, value], i) => {
        out += valueText(at.x, at.y + i * 18, value, binding, def.panel.align);
      });
      return out;
    }
    const box = worldBox(node, def);
    listed.forEach(([binding, value], i) => {
      out += valueText(box.x + box.w / 2, box.y + box.h + 16 + i * 17, value, binding, "middle");
    });
    return out;
  }

  _ports(node, def, connected) {
    let out = "";
    const radius = Math.min(def.w, def.h) <= 20 ? 4 : 6;
    for (const port of def.ports) {
      const at = portWorld(node, def, port.id);
      const state = connected.has(port.id) ? " hs-port-used" : "";
      out += `<circle class="hs-port hs-port-${port.flow}${state}" data-port="${esc(node.id)}:${esc(port.id)}" cx="${at.x}" cy="${at.y}" r="${radius}"/>`;
    }
    return out;
  }
}

/** Every pipe's route, keyed by id. */
export function computeRoutes(doc, defs) {
  const routes = new Map();
  const boxes = new Map();
  for (const node of doc.nodes) {
    const def = defs.get(node.id);
    if (def) boxes.set(node.id, worldBox(node, def));
  }
  for (const pipe of doc.pipes) {
    const a = endOf(doc, defs, pipe.from);
    const b = endOf(doc, defs, pipe.to);
    if (!a || !b) continue;
    const obstacles = [boxes.get(pipe.from.node), boxes.get(pipe.to.node)].filter(Boolean);
    routes.set(pipe.id, route(a, b, pipe.points || [], obstacles));
  }
  return routes;
}

function endOf(doc, defs, end) {
  const node = doc.nodes.find((n) => n.id === end.node);
  const def = defs.get(end.node);
  return node && def ? portWorld(node, def, end.port) : null;
}

/** The middle of the longest leg: where a pipe's label reads best. */
function middleOf(points) {
  let best = { x: points[0].x, y: points[0].y };
  let longest = -1;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (length > longest) {
      longest = length;
      best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return best;
}

function valueColor(value, binding) {
  if (!value.ok) return "";
  if ((binding.kind === "temperature" || binding.kind === "setpoint") && value.num !== null) {
    return ` style="fill:${temperatureColor(value.num)}"`;
  }
  return "";
}

function valueText(x, y, value, binding, align) {
  const anchor = align === "start" ? "start" : align === "end" ? "end" : "middle";
  const stale = value.ok ? "" : " hs-stale";
  return `<text class="hs-value${stale}" x="${x}" y="${y}" text-anchor="${anchor}"${valueColor(value, binding)}><title>${esc(tr(`binding.${binding.key}`))}</title>${esc(value.text)}</text>`;
}

function pill(x, y, value, binding) {
  const width = Math.max(44, value.text.length * 8 + 12);
  const stale = value.ok ? "" : " hs-stale";
  return (
    `<g class="hs-pill${stale}"><title>${esc(tr(`binding.${binding.key}`))}</title>` +
    `<rect x="${x - width / 2}" y="${y - 11}" width="${width}" height="22" rx="5"/>` +
    `<text class="hs-value" text-anchor="middle" x="${x}" y="${y}"${valueColor(value, binding)}>${esc(value.text)}</text></g>`
  );
}

function cssEscape(value) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
}
