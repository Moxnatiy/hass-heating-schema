// A selection frame: every element it touches is selected; with Shift they
// join the current selection. A click without dragging clears it.

import { worldBox, boxesIntersect } from "../../core/geometry.js";

export function selectionFrame(canvas, at, additive) {
  const { state } = canvas;
  let box = null;

  return {
    move(e, now) {
      box = {
        x: Math.min(at.x, now.x),
        y: Math.min(at.y, now.y),
        w: Math.abs(now.x - at.x),
        h: Math.abs(now.y - at.y),
      };
      canvas.setPreview(`<rect class="hs-band" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/>`);
    },
    end() {
      canvas.setPreview("");
      if (!box || (box.w < 3 && box.h < 3)) {
        if (!additive) state.clearSelection();
        return;
      }
      const hits = state.doc.nodes
        .filter((n) => state.defs.has(n.id) && boxesIntersect(box, worldBox(n, state.defs.get(n.id))))
        .map((n) => n.id);
      state.select(additive ? [...state.selection.nodes, ...hits] : hits);
    },
    cancel() {
      canvas.setPreview("");
    },
  };
}
