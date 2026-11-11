// Laying a pipe: drag from a port. While dragging, the preview shows whether
// the port under the pointer may be joined (solid), joined with a warning
// (amber) or refused (red). Dropping on a pipe branches off it.

import { snap, distanceToSegment } from "../../core/geometry.js";
import { MEDIA, mediumFor } from "../../core/media.js";
import { canConnect, portSpec } from "../../core/model.js";
import { route, pathData } from "../../core/router.js";
import { layPipe, branchPipe, portAt } from "../../core/edits.js";
import { t } from "../../core/i18n.js";

export function layPipeFrom(canvas, from) {
  const { state } = canvas;
  let target = null;
  let at = null;

  const findTarget = (e) => {
    const element = canvas.elementAt(e.clientX, e.clientY);
    const portEl = element && element.closest && element.closest("[data-port]");
    if (portEl) {
      const [node, port] = portEl.dataset.port.split(":");
      return { kind: "port", end: { node, port }, verdict: canConnect(state.doc, state.defs, from, { node, port }) };
    }
    const leg = pipeLegNear(canvas, at);
    return leg ? { kind: "pipe", ...leg } : null;
  };

  return {
    move(e, now) {
      at = now;
      target = findTarget(e);
      const start = portAt(state.doc, state.defs, from);
      let end = { x: snap(now.x), y: snap(now.y) };
      let cls = "hs-temp-pipe";
      if (target && target.kind === "port") {
        end = portAt(state.doc, state.defs, target.end);
        const { ok, level } = target.verdict;
        cls += ok ? (level === "warning" ? " hs-temp-warn" : " hs-temp-ok") : " hs-temp-bad";
      }
      const landing = target && target.kind === "pipe" ? `<path class="hs-branch-target" d="M${target.a.x} ${target.a.y} L${target.b.x} ${target.b.y}"/>` : "";
      if (target && target.kind === "pipe") cls += " hs-temp-ok";
      const points = route(start, { ...end, side: end.side || facing(start, end) });
      const medium = mediumFor(portSpec(state.doc, state.defs, from), null, canvas.lastMedium);
      const color = (MEDIA[medium] || MEDIA.other).color;
      canvas.setPreview(`${landing}<path class="${cls}" style="--hs-medium:${color}" d="${pathData(points)}"/>`);
    },
    end(e) {
      canvas.setPreview("");
      if (!target) return;
      if (target.kind === "port") {
        let made = null;
        state.commit((doc) => {
          made = layPipe(doc, state.defs, from, target.end, canvas.lastMedium);
        });
        if (!made.pipe) {
          canvas.message(connectText(made.verdict), "error");
          return;
        }
        canvas.lastMedium = made.pipe.medium;
        state.select([], made.pipe.id);
        if (made.verdict.level === "warning") canvas.message(connectText(made.verdict), "warning");
        return;
      }
      const near = portAt(state.doc, state.defs, from);
      let made = null;
      state.commit((doc) => {
        made = branchPipe(doc, state.defs, from, target.pipe, target.a, target.b, near);
      });
      if (made.error) canvas.message(connectText({ reason: made.error, families: made.families }), "error");
      else state.select([], made.branch.id);
    },
    cancel() {
      canvas.setPreview("");
    },
  };
}

/** The pipe leg within a few pixels of a point, if any. */
function pipeLegNear(canvas, at) {
  if (!at) return null;
  let best = null;
  for (const [pipe, points] of canvas.renderer.routes) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const d = distanceToSegment(at, points[i], points[i + 1]);
      if (d < 8 / canvas.view.k && (!best || d < best.d)) best = { pipe, d, a: points[i], b: points[i + 1] };
    }
  }
  return best;
}

/** The side a free pipe end faces: back towards where the pipe came from. */
function facing(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "l" : "r";
  return dy >= 0 ? "t" : "b";
}

export function connectText(verdict) {
  if (verdict.reason === "mix") {
    return t("connect.mix", { a: t(`family.${verdict.families[0]}`), b: t(`family.${verdict.families[1]}`) });
  }
  return t(`connect.${verdict.reason}`);
}
