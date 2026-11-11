// Commands on the selection, shared by the toolbar, the inspector and the
// keyboard. Each is one undoable step.

import { GRID } from "../core/geometry.js";
import { createNode } from "../core/model.js";
import { rotateNodes, flipNodes, removeSelection, moveNodes, pasteClip } from "../core/edits.js";

export class Commands {
  constructor(state) {
    this.state = state;
    this.clipboard = null;
  }

  get hasSelection() {
    return this.state.selection.nodes.size > 0 || Boolean(this.state.selection.pipe);
  }

  add(type, at) {
    const node = createNode(type, at.x, at.y);
    this.state.commit((doc) => doc.nodes.push(node));
    this.state.select([node.id]);
    return node;
  }

  rotate(step = 90) {
    const ids = this.state.selection.nodes;
    if (ids.size) this.state.commit((doc) => rotateNodes(doc, ids, step));
  }

  flip() {
    const ids = this.state.selection.nodes;
    if (ids.size) this.state.commit((doc) => flipNodes(doc, ids));
  }

  remove() {
    const { nodes, pipe } = this.state.selection;
    if (!nodes.size && !pipe) return;
    this.state.commit((doc) => removeSelection(doc, nodes, pipe));
    this.state.clearSelection();
  }

  nudge(dx, dy) {
    const ids = this.state.selection.nodes;
    if (ids.size) this.state.commit((doc) => moveNodes(doc, ids, dx, dy));
  }

  copy() {
    this.clipboard = this.state.copySelection();
    return Boolean(this.clipboard);
  }

  paste() {
    if (!this.clipboard) return;
    let ids = [];
    this.state.commit((doc) => {
      ids = pasteClip(doc, this.clipboard, 2 * GRID);
    });
    this.state.select(ids);
    // The next paste lands further on, not on top of this one.
    this.clipboard = {
      nodes: this.clipboard.nodes.map((n) => ({ ...n, x: n.x + 2 * GRID, y: n.y + 2 * GRID })),
      pipes: this.clipboard.pipes.map((p) => ({ ...p, points: p.points.map(([x, y]) => [x + 2 * GRID, y + 2 * GRID]) })),
    };
  }

  duplicate() {
    if (this.copy()) this.paste();
  }

  resetRoute(pipeId) {
    this.state.commit((doc) => {
      const pipe = doc.pipes.find((p) => p.id === pipeId);
      if (pipe) pipe.points = [];
    });
  }
}
