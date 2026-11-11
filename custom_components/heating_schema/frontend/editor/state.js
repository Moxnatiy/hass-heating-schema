// The editor's state: the document being drawn, the selection, and history.
//
// Every change goes through commit(), which keeps a snapshot for undo. A drag
// changes the document many times a second, so it edits in place through
// preview() and leaves a single history entry when it ends.

import { clone, normalize, resolveAll, dropDanglingPipes } from "../core/model.js";

const HISTORY_LIMIT = 200;

export class EditorState {
  constructor() {
    this.doc = null;
    this.defs = new Map();
    this.selection = { nodes: new Set(), pipe: null };
    this._past = [];
    this._future = [];
    this._saved = null;
    this._dragStart = null;
    this._listeners = new Set();
  }

  /** Call fn(reason) after every change; reason is "doc", "preview" or "selection". */
  listen(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(reason) {
    for (const fn of this._listeners) fn(reason);
  }

  /** Open a document; it counts as saved. */
  load(doc) {
    this.doc = normalize(doc);
    this.defs = resolveAll(this.doc);
    this._past = [];
    this._future = [];
    this._saved = JSON.stringify(this.doc);
    this.clearSelection(false);
    this._emit("doc");
  }

  /** The document was stored; what is on screen is now the saved state. */
  markSaved(doc) {
    if (doc) {
      this.doc.id = doc.id;
      this.doc.name = doc.name;
    }
    this._saved = JSON.stringify(this.doc);
    this._emit("selection");
  }

  get dirty() {
    return Boolean(this.doc) && JSON.stringify(this.doc) !== this._saved;
  }

  get canUndo() {
    return this._past.length > 0;
  }

  get canRedo() {
    return this._future.length > 0;
  }

  /** Change the document as one undoable step. */
  commit(mutate) {
    const before = JSON.stringify(this.doc);
    mutate(this.doc);
    this._refresh();
    if (JSON.stringify(this.doc) === before) return;
    this._past.push(before);
    if (this._past.length > HISTORY_LIMIT) this._past.shift();
    this._future = [];
    this._emit("doc");
  }

  /** Start a drag: the document as it is now is what undo returns to. */
  beginPreview() {
    if (this._dragStart === null) this._dragStart = JSON.stringify(this.doc);
  }

  /** Change the document during a drag, without a history entry. */
  preview(mutate) {
    this.beginPreview();
    mutate(this.doc);
    this._refresh();
    this._emit("preview");
  }

  /** End a drag: one history entry for the whole of it. */
  endPreview() {
    if (this._dragStart === null) return;
    const before = this._dragStart;
    this._dragStart = null;
    if (JSON.stringify(this.doc) !== before) {
      this._past.push(before);
      this._future = [];
    }
    this._emit("doc");
  }

  /** Abandon a drag: the document goes back to how it was. */
  cancelPreview() {
    if (this._dragStart === null) return;
    this.doc = JSON.parse(this._dragStart);
    this._dragStart = null;
    this._refresh();
    this._emit("doc");
  }

  undo() {
    if (!this._past.length) return;
    this._future.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this._past.pop());
    this._refresh();
    this._pruneSelection();
    this._emit("doc");
  }

  redo() {
    if (!this._future.length) return;
    this._past.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this._future.pop());
    this._refresh();
    this._pruneSelection();
    this._emit("doc");
  }

  _refresh() {
    this.defs = resolveAll(this.doc);
    // A parameter can take a port away (fewer manifold loops); its pipe goes too.
    dropDanglingPipes(this.doc, this.defs);
  }

  // ---- selection ---------------------------------------------------------------

  select(nodes = [], pipe = null) {
    this.selection = { nodes: new Set(nodes), pipe };
    this._emit("selection");
  }

  toggleNode(id) {
    const nodes = new Set(this.selection.nodes);
    if (nodes.has(id)) nodes.delete(id);
    else nodes.add(id);
    this.selection = { nodes, pipe: null };
    this._emit("selection");
  }

  clearSelection(emit = true) {
    this.selection = { nodes: new Set(), pipe: null };
    if (emit) this._emit("selection");
  }

  _pruneSelection() {
    const ids = new Set(this.doc.nodes.map((n) => n.id));
    const nodes = [...this.selection.nodes].filter((id) => ids.has(id));
    const pipe = this.doc.pipes.some((p) => p.id === this.selection.pipe) ? this.selection.pipe : null;
    this.selection = { nodes: new Set(nodes), pipe };
  }

  selectedNodes() {
    return this.doc ? this.doc.nodes.filter((n) => this.selection.nodes.has(n.id)) : [];
  }

  selectedPipe() {
    return this.doc && this.selection.pipe ? this.doc.pipes.find((p) => p.id === this.selection.pipe) || null : null;
  }

  /** A copy of the selection and the pipes inside it, for the clipboard. */
  copySelection() {
    const nodes = this.selectedNodes().map(clone);
    const ids = new Set(nodes.map((n) => n.id));
    const pipes = this.doc.pipes.filter((p) => ids.has(p.from.node) && ids.has(p.to.node)).map(clone);
    return nodes.length ? { nodes, pipes } : null;
  }
}
