// Dragging the selected elements, on the grid. Bends of pipes whose both
// ends move go along, so a moved group keeps its piping.

import { snap } from "../../core/geometry.js";

export function moveSelection(canvas, at) {
  const { state } = canvas;
  const moving = state.selectedNodes().map((n) => ({ id: n.id, x: n.x, y: n.y }));
  const ids = new Set(moving.map((m) => m.id));
  const pipes = state.doc.pipes
    .filter((p) => ids.has(p.from.node) && ids.has(p.to.node))
    .map((p) => ({ id: p.id, points: p.points.map((pt) => [...pt]) }));
  let moved = false;

  return {
    move(e, now) {
      const dx = snap(now.x - at.x);
      const dy = snap(now.y - at.y);
      if (!dx && !dy && !moved) return;
      moved = true;
      state.preview((doc) => {
        for (const m of moving) {
          const node = doc.nodes.find((n) => n.id === m.id);
          if (node) {
            node.x = m.x + dx;
            node.y = m.y + dy;
          }
        }
        for (const p of pipes) {
          const pipe = doc.pipes.find((q) => q.id === p.id);
          if (pipe) pipe.points = p.points.map(([x, y]) => [x + dx, y + dy]);
        }
      });
    },
    end() {
      if (moved) state.endPreview();
    },
    cancel() {
      state.cancelPreview();
    },
  };
}
