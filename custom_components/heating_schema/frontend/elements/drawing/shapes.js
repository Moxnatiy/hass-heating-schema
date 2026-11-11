// Drawing: plain lines and shapes for what is not plumbing. A wall, the edge
// of a boiler room, a zone, an arrow to a note, a circle around a detail.
// Solid, dashed, dotted or dash-dot, in a few weights and colours.
//
// They lie under the pipes and the elements (`under`) and are grabbed on
// their strokes only (`outlineHit`), so a frame drawn around a group of
// elements never gets in the way of clicking what is inside it. They show a
// name above only when given one, a room's name for example.

import { defineElement } from "../registry.js";
import { num, select } from "../kit/fields.js";
import { path, poly } from "../kit/svg.js";

const STROKES = ["solid", "dashed", "dotted", "dash_dot"];
const WEIGHTS = ["thin", "normal", "thick"];
const COLORS = ["ink", "grey", "red", "blue", "green", "orange"];
const HEAD = { thin: 10, normal: 12, thick: 16 };

/** A length on the 20-point grid, so the element rotates on the grid. */
const span = (value, min, max) => Math.min(max, Math.max(min, Math.round((Number(value) || min) / 20) * 20));

const look = (stroke, extra = []) => [
  select("stroke", stroke, STROKES),
  select("weight", "normal", WEIGHTS),
  select("color", "ink", COLORS),
  ...extra,
];

/** The group a shape draws in: its colour, weight and stroke. */
function styled(node, inner) {
  const p = node.params;
  const cls = [
    "hs-draw",
    `hs-draw-${COLORS.includes(p.color) ? p.color : "ink"}`,
    `hs-draw-${WEIGHTS.includes(p.weight) ? p.weight : "normal"}`,
    `hs-stroke-${STROKES.includes(p.stroke) ? p.stroke : "solid"}`,
  ].join(" ");
  return `<g class="${cls}">${inner}</g>`;
}

/** An invisible wide stroke along a shape, where it is grabbed. */
const grip = (d) => path(d, "hs-hit-stroke");

function makeLine(type, stroke, ends = "none") {
  return defineElement({
    type,
    category: "drawing",
    under: true,
    outlineHit: true,
    hideLabel: (node) => !node.label,
    size: (node) => ({ w: span(node.params.length, 40, 4000), h: 20 }),
    ports: () => [],
    params: [num("length", 160, "", 40, 4000, 20), ...look(stroke, [select("ends", ends, ["none", "end", "both"])])],
    draw(node, live, ctx, def) {
      const len = def.w;
      const head = HEAD[node.params.weight] || HEAD.normal;
      const ends = node.params.ends;
      const atEnd = ends === "end" || ends === "both";
      const atStart = ends === "both";
      // The line stops at an arrowhead's base, so the tip stays sharp.
      const x1 = atStart ? head : 0;
      const x2 = atEnd ? len - head : len;
      const half = head * 0.45;
      let heads = "";
      if (atEnd) heads += poly(`${len},10 ${len - head},${10 - half} ${len - head},${10 + half}`, "hs-draw-head");
      if (atStart) heads += poly(`0,10 ${head},${10 - half} ${head},${10 + half}`, "hs-draw-head");
      return grip(`M0 10 H${len}`) + styled(node, path(`M${x1} 10 H${x2}`, "hs-draw-line") + heads);
    },
  });
}

export const line = makeLine("line", "solid");
export const dashedLine = makeLine("dashed_line", "dashed");
export const arrow = makeLine("arrow", "solid", "end");

/**
 * A closed shape in a width × height box. outline(w, h, params) gives the
 * shape's path, drawn and grabbed along the same line.
 */
function makeShape(type, size, stroke, outline, extra = []) {
  return defineElement({
    type,
    category: "drawing",
    under: true,
    outlineHit: true,
    hideLabel: (node) => !node.label,
    size: (node) => ({ w: span(node.params.width, 40, 4000), h: span(node.params.height, 40, 4000) }),
    ports: () => [],
    params: [
      num("width", size[0], "", 40, 4000, 20),
      num("height", size[1], "", 40, 4000, 20),
      ...look(stroke, [...extra, select("fill", "none", ["none", "tint"])]),
    ],
    draw(node, live, ctx, def) {
      const d = outline(def.w, def.h, node.params);
      const fill = node.params.fill === "tint" ? " hs-draw-tint" : "";
      return grip(d) + styled(node, path(d, `hs-draw-line${fill}`));
    },
  });
}

/** A rectangle inset by a point so the stroke stays in the box; corners rounded or square. */
function box(w, h, params) {
  const r = params.corners === "rounded" ? Math.min(12, w / 4, h / 4) : 0;
  if (!r) return `M1 1 H${w - 1} V${h - 1} H1 Z`;
  return (
    `M${1 + r} 1 H${w - 1 - r} A${r} ${r} 0 0 1 ${w - 1} ${1 + r} V${h - 1 - r} A${r} ${r} 0 0 1 ${w - 1 - r} ${h - 1}` +
    ` H${1 + r} A${r} ${r} 0 0 1 1 ${h - 1 - r} V${1 + r} A${r} ${r} 0 0 1 ${1 + r} 1 Z`
  );
}

/** An ellipse touching the box's edges: a circle when the box is square. */
function ellipse(w, h) {
  const rx = w / 2 - 1;
  const ry = h / 2 - 1;
  return `M1 ${h / 2} A${rx} ${ry} 0 1 1 ${w - 1} ${h / 2} A${rx} ${ry} 0 1 1 1 ${h / 2} Z`;
}

/** A triangle standing on the box's bottom edge, its tip at the top middle. */
const triangle = (w, h) => `M${w / 2} 1 L${w - 1} ${h - 1} H1 Z`;

export const frame = makeShape("frame", [240, 160], "dashed", box, [select("corners", "square", ["square", "rounded"])]);
export const circle = makeShape("circle", [80, 80], "solid", ellipse);
export const triangleShape = makeShape("triangle", [80, 80], "solid", triangle);
