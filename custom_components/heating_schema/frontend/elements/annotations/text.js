// A free text on the sheet: a room name, a note.

import { defineElement } from "../registry.js";
import { select, text } from "../kit/fields.js";
import { rect } from "../kit/svg.js";

export default defineElement({
  type: "text",
  category: "annotations",
  w: 120,
  h: 20,
  hideLabel: true,
  ports: () => [],
  params: [text("text", ""), select("size", "medium", ["small", "medium", "large"])],
  draw(node, live, ctx) {
    ctx.text(60, 10, node.params.text || node.label || "…", `hs-note hs-note-${node.params.size || "medium"}`);
    return rect(0, 0, 120, 20, 0, "hs-hit");
  },
});
