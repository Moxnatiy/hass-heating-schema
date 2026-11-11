// A value badge: any entity's state with a label, e.g. "Living room: 21.4 °C".

import { defineElement } from "../registry.js";
import { bind } from "../kit/fields.js";
import { rect } from "../kit/svg.js";

export default defineElement({
  type: "value",
  category: "annotations",
  w: 160,
  h: 40,
  hideLabel: true,
  ports: () => [],
  bindings: () => [bind("value", "state", false)],
  draw(node, live, ctx) {
    const v = live.values.value;
    const label = node.label ? `${node.label}: ` : "";
    ctx.text(12, 20, `${label}${v ? v.text : "—"}`, `hs-badge-text${v && !v.ok ? " hs-stale" : ""}`, "start");
    return rect(2, 4, 156, 32, 6, "hs-badge");
  },
});
