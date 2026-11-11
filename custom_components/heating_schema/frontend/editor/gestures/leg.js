// Dragging one leg of the selected pipe sideways. The route becomes the
// pipe's own bends from then on; "Route automatically" undoes that.

import { moveLeg } from "../../core/router.js";

export function moveLegOf(canvas, pipeId, index, at) {
  const { state } = canvas;
  const points = canvas.renderer.routes.get(pipeId);
  const a = points[index];
  const b = points[index + 1];
  const vertical = a.x === b.x;
  state.beginPreview();

  return {
    move(e, now) {
      const bends = moveLeg(points, index, vertical ? now.x - at.x : now.y - at.y);
      state.preview((doc) => {
        const pipe = doc.pipes.find((p) => p.id === pipeId);
        if (pipe) pipe.points = bends;
      });
    },
    end() {
      state.endPreview();
    },
    cancel() {
      state.cancelPreview();
    },
  };
}
