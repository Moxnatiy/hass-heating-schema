// The drawing sheet: shows a schema and turns pointer input into gestures.
//
// What a press starts depends on what is under it (gestures/):
//   a port               lay a pipe; drop on a port or on a pipe   pipe.js
//   a leg handle         move that leg of the selected pipe       leg.js
//   an element           select it (Shift adds) and drag          move.js
//   a pipe               select it
//   the empty sheet      a selection frame; with a finger, pan    band.js
// Space or the middle button held pans; two fingers pinch; the wheel pans
// and Ctrl + wheel zooms (viewport.js).
//
// Without editing the sheet is a live view: a tap on an element asks the host
// to show its entity, and every drag pans.

import { SchemaRenderer } from "../core/render.js";
import { evaluate } from "../core/live.js";
import { worldBox, GRID } from "../core/geometry.js";
import { bounds, problems } from "../core/model.js";
import { pathData, legs } from "../core/router.js";
import { screenToWorld, zoomed, fitted } from "./view.js";
import { pan, pinch, wheel } from "./gestures/viewport.js";
import { moveSelection } from "./gestures/move.js";
import { moveLegOf } from "./gestures/leg.js";
import { selectionFrame } from "./gestures/band.js";
import { layPipeFrom } from "./gestures/pipe.js";

const SVG = "http://www.w3.org/2000/svg";
export const ELEMENT_MIME = "application/x-heating-schema-element";

/** How far a press may wander and still count as a tap. */
const TAP_SLOP = 6;

export class SchemaCanvas {
  /**
   * @param {HTMLElement} container
   * @param {EditorState} state
   * @param {object} host  {
   *   editable(): bool, hass(): hass,
   *   onPick(node)            a tap on an element while viewing
   *   onDropElement(type, at) an element dragged in from the palette
   *   onMessage(text, level)  something the user should know
   * }
   */
  constructor(container, state, host) {
    this.state = state;
    this.host = host;
    this.view = { x: 40, y: 40, k: 1 };
    this.live = null;
    this.lastMedium = "heating_supply";
    this._gesture = null;
    this._pointers = new Map();
    this._spaceHeld = false;
    this._frame = 0;
    this._preview = "";

    this.svg = document.createElementNS(SVG, "svg");
    this.svg.classList.add("hs-canvas", "hs-sheet");
    this.svg.setAttribute("tabindex", "0");
    this.svg.innerHTML = `
      <defs>
        <pattern id="hs-grid-dots" width="${GRID * 2}" height="${GRID * 2}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="1.1" class="hs-grid-dot"/>
        </pattern>
      </defs>
      <g class="hs-viewport">
        <rect class="hs-grid" x="-100000" y="-100000" width="200000" height="200000" fill="url(#hs-grid-dots)"/>
        <g class="hs-content"></g>
        <g class="hs-overlay"></g>
      </g>`;
    container.append(this.svg);
    this.viewport = this.svg.querySelector(".hs-viewport");
    this.overlay = this.svg.querySelector(".hs-overlay");
    this.renderer = new SchemaRenderer(this.svg.querySelector(".hs-content"));

    this._bindInput();
    this._unlisten = state.listen((reason) => this._onState(reason));
  }

  destroy() {
    this._unlisten();
    cancelAnimationFrame(this._frame);
    this.svg.remove();
  }

  get editing() {
    return this.host.editable();
  }

  message(text, level) {
    this.host.onMessage(text, level);
  }

  // ---- drawing -------------------------------------------------------------------

  _onState(reason) {
    if (reason === "selection") this.renderOverlay();
    else if (reason === "preview") this._scheduleRender();
    else this.render();
  }

  _scheduleRender() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this.render();
    });
  }

  render() {
    const { doc, defs } = this.state;
    if (!doc) return;
    const settings = doc.settings || {};
    this.svg.classList.toggle("hs-editing", this.editing);
    this.renderer.options = {
      ...this.renderer.options,
      editing: this.editing,
      showPorts: this.editing || Boolean(settings.show_ports),
      animate: settings.animate_flow !== false,
      showValues: settings.show_values !== false,
    };
    this.renderer.setDocument(doc, defs);
    this.updateLive();
    this.renderOverlay();
  }

  /** Recompute the live state from Home Assistant and apply it. */
  updateLive() {
    const { doc, defs } = this.state;
    if (!doc) return;
    const hass = this.host.hass();
    this.live = evaluate(doc, defs, hass ? hass.states : {});
    this.renderer.setLive(this.live);
  }

  /** Markup a gesture shows on top of the drawing: a pipe being laid, a frame. */
  setPreview(markup) {
    this._preview = markup;
    this.renderOverlay();
  }

  renderOverlay() {
    const { doc } = this.state;
    this.overlay.innerHTML = doc ? this._problemMarks() + this._selectionMarks() + this._preview : "";
  }

  _problemMarks() {
    if (!this.editing) return "";
    const { doc, defs } = this.state;
    const hass = this.host.hass();
    const worst = new Map();
    for (const problem of problems(doc, defs, hass ? hass.states : null)) {
      if (problem.node && worst.get(problem.node) !== "error") worst.set(problem.node, problem.level);
    }
    let out = "";
    for (const [id, level] of worst) {
      const node = doc.nodes.find((n) => n.id === id);
      if (!node || !defs.has(id)) continue;
      const box = worldBox(node, defs.get(id));
      out += `<g class="hs-problem hs-problem-${level}"><circle cx="${box.x + box.w}" cy="${box.y}" r="7"/><text x="${box.x + box.w}" y="${box.y}">!</text></g>`;
    }
    return out;
  }

  _selectionMarks() {
    const { doc, defs, selection } = this.state;
    let out = "";
    for (const node of doc.nodes) {
      if (!selection.nodes.has(node.id) || !defs.has(node.id)) continue;
      const box = worldBox(node, defs.get(node.id));
      out += `<rect class="hs-selection" x="${box.x - 6}" y="${box.y - 6}" width="${box.w + 12}" height="${box.h + 12}" rx="6"/>`;
    }
    const pipe = this.state.selectedPipe();
    const points = pipe && this.renderer.routes.get(pipe.id);
    if (points) {
      out += `<path class="hs-pipe-selected" d="${pathData(points)}"/>`;
      if (this.editing) {
        for (const leg of legs(points)) {
          const x = (leg.a.x + leg.b.x) / 2;
          const y = (leg.a.y + leg.b.y) / 2;
          const axis = leg.a.x === leg.b.x ? "hs-leg-v" : "hs-leg-h";
          out += `<rect class="hs-leg ${axis}" data-leg="${leg.index}" x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2"/>`;
        }
      }
    }
    return out;
  }

  // ---- view ----------------------------------------------------------------------------

  setView(view) {
    this.view = view;
    this.viewport.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`);
  }

  toWorld(clientX, clientY) {
    return screenToWorld(this.view, this.svg.getBoundingClientRect(), clientX, clientY);
  }

  zoomAt(factor, clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const sx = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const sy = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    this.setView(zoomed(this.view, factor, sx, sy));
  }

  fit() {
    const rect = this.svg.getBoundingClientRect();
    if (!rect.width || !rect.height || !this.state.doc) return;
    this.setView(fitted(bounds(this.state.doc, this.state.defs), rect.width, rect.height));
  }

  /** The middle of the visible sheet, where a picked element is placed. */
  centre() {
    const rect = this.svg.getBoundingClientRect();
    return this.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  /** The element under a screen point, inside the panel's shadow root too. */
  elementAt(clientX, clientY) {
    const root = this.svg.getRootNode();
    return root && root.elementFromPoint ? root.elementFromPoint(clientX, clientY) : null;
  }

  // ---- input routing --------------------------------------------------------------------

  _bindInput() {
    const svg = this.svg;
    svg.addEventListener("pointerdown", (e) => this._down(e));
    svg.addEventListener("pointermove", (e) => this._move(e));
    svg.addEventListener("pointerup", (e) => this._up(e));
    svg.addEventListener("pointercancel", (e) => this._cancel(e));
    svg.addEventListener("contextmenu", (e) => e.preventDefault());
    svg.addEventListener("wheel", (e) => wheel(this, e), { passive: false });
    svg.addEventListener("dragover", (e) => {
      if (this.editing && [...e.dataTransfer.types].includes(ELEMENT_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    });
    svg.addEventListener("drop", (e) => {
      const type = e.dataTransfer.getData(ELEMENT_MIME);
      if (!type || !this.editing) return;
      e.preventDefault();
      this.host.onDropElement(type, this.toWorld(e.clientX, e.clientY));
    });
    svg.addEventListener("keydown", (e) => {
      if (e.code !== "Space" || e.repeat) return;
      this._spaceHeld = true;
      svg.classList.add("hs-panning");
      e.preventDefault();
    });
    svg.addEventListener("keyup", (e) => {
      if (e.code !== "Space") return;
      this._spaceHeld = false;
      svg.classList.remove("hs-panning");
    });
  }

  _down(e) {
    this.svg.focus({ preventScroll: true });
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 2) {
      // A second finger turns whatever the first one started into a pinch.
      if (this._gesture) this._gesture.cancel();
      this._gesture = pinch(this, this._pointers);
      return;
    }
    if (this._pointers.size > 2) return;
    this.svg.setPointerCapture(e.pointerId);
    this._tap = { x: e.clientX, y: e.clientY };
    this._gesture = this._startGesture(e);
  }

  _startGesture(e) {
    if (e.button === 1 || e.button === 2 || this._spaceHeld) return pan(this, e);
    const at = this.toWorld(e.clientX, e.clientY);
    const hit = (selector) => (e.target.closest ? e.target.closest(selector) : null);
    const nodeEl = hit("[data-node]");

    if (!this.editing) {
      this._tapNode = nodeEl ? nodeEl.dataset.node : null;
      return pan(this, e);
    }
    const portEl = hit("[data-port]");
    if (portEl) {
      const [node, port] = portEl.dataset.port.split(":");
      return layPipeFrom(this, { node, port });
    }
    const legEl = hit("[data-leg]");
    if (legEl && this.state.selection.pipe) {
      return moveLegOf(this, this.state.selection.pipe, Number(legEl.dataset.leg), at);
    }
    if (nodeEl) {
      const id = nodeEl.dataset.node;
      if (e.shiftKey) this.state.toggleNode(id);
      else if (!this.state.selection.nodes.has(id)) this.state.select([id]);
      return moveSelection(this, at);
    }
    const pipeEl = hit("[data-pipe]");
    if (pipeEl) {
      this.state.select([], pipeEl.dataset.pipe);
      return null;
    }
    if (e.pointerType === "touch") {
      // A finger on the empty sheet pans; frames are for a mouse or a pen.
      this.state.clearSelection();
      return pan(this, e);
    }
    return selectionFrame(this, at, e.shiftKey);
  }

  _move(e) {
    if (this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._gesture) this._gesture.move(e, this.toWorld(e.clientX, e.clientY));
  }

  _up(e) {
    this._pointers.delete(e.pointerId);
    const gesture = this._gesture;
    if (!gesture) return;
    if (gesture.pinch && this._pointers.size) return;
    this._gesture = null;
    gesture.end(e, this.toWorld(e.clientX, e.clientY));

    // A tap while viewing opens the element's entity.
    const tapped = this._tapNode;
    this._tapNode = null;
    if (tapped && this._tap && Math.hypot(e.clientX - this._tap.x, e.clientY - this._tap.y) < TAP_SLOP) {
      const node = this.state.doc.nodes.find((n) => n.id === tapped);
      if (node) this.host.onPick(node);
    }
  }

  _cancel(e) {
    this._pointers.delete(e.pointerId);
    if (this._gesture) this._gesture.cancel();
    this._gesture = null;
  }

  /** Abandon what the pointer is doing (Escape); true if there was something. */
  abort() {
    if (!this._gesture) return false;
    this._gesture.cancel();
    this._gesture = null;
    return true;
  }
}
