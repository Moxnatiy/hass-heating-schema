// SVG building blocks for element drawings.
//
// Every helper returns a string of markup in the element's own coordinates.
// Classes, not inline colours, carry the look (see core/styles.js), so the
// drawings follow Home Assistant's light and dark themes.

const attrs = (cls, extra = "") => `class="${cls}"${extra ? ` ${extra}` : ""}`;

export const line = (x1, y1, x2, y2, cls = "hs-line") =>
  `<line ${attrs(cls)} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

export const rect = (x, y, w, h, r = 0, cls = "hs-body", extra = "") =>
  `<rect ${attrs(cls, extra)} x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;

export const circle = (cx, cy, r, cls = "hs-body", extra = "") =>
  `<circle ${attrs(cls, extra)} cx="${cx}" cy="${cy}" r="${r}"/>`;

export const path = (d, cls = "hs-line", extra = "") => `<path ${attrs(cls, extra)} d="${d}"/>`;

export const poly = (points, cls = "hs-body", extra = "") => `<polygon ${attrs(cls, extra)} points="${points}"/>`;

/** The short pipe from a port to the body. */
export const stub = (x1, y1, x2, y2) => line(x1, y1, x2, y2, "hs-stub");

/** The body class: green outline while running, blinking red on alarm. */
export function bodyClass(live, base = "hs-body") {
  if (live.alarm) return `${base} hs-alarm`;
  if (live.on === true) return `${base} hs-running`;
  return base;
}

/** Two triangles tip to tip: a valve body, centred at cx, cy. */
export function valveBody(cx, cy, half, spread, cls = "hs-valve") {
  return (
    poly(`${cx - half},${cy - spread} ${cx},${cy} ${cx - half},${cy + spread}`, cls) +
    poly(`${cx + half},${cy - spread} ${cx},${cy} ${cx + half},${cy + spread}`, cls)
  );
}

/** An actuator on a stem above a valve: a motor box, or a round thermal head. */
export function actuator(cx, top, stemTo, kind) {
  const head =
    kind === "thermostatic" || kind === "thermal"
      ? rect(cx - 7, top, 14, 12, 6, "hs-body")
      : rect(cx - 10, top, 20, 12, 3, "hs-body");
  return line(cx, top + 12, cx, stemTo, "hs-line") + head;
}

/** A heating coil drawn as a zigzag between two heights. */
export function coil(x1, x2, y1, y2, cls = "hs-coil") {
  const turns = Math.max(2, Math.round((y2 - y1) / 9));
  const step = (y2 - y1) / turns;
  let d = `M${x1} ${y1} H${x1 + 4}`;
  for (let i = 0; i < turns; i += 1) d += ` L${i % 2 ? x1 + 4 : x2} ${y1 + step * (i + 0.5)}`;
  d += ` L${x1 + 4} ${y2} H${x1}`;
  return path(d, cls);
}

const FLAME =
  "M0 20 C-12 13 -9 0 -2 -7 C-2 2 5 2 5 -5 C5 -12 0 -16 2 -22 C12 -13 13 0 9 9 C7 15 4 18 0 20 Z";

/** A burner flame; it flickers while lit and is grey while out. */
export function flame(cx, cy, on) {
  return `<path class="${on ? "hs-flame" : "hs-flame hs-idle"}" transform="translate(${cx} ${cy})" d="${FLAME}"/>`;
}

/** An electric heating element. */
export function heatingRod(x, y, w, on) {
  const seg = w / 6;
  let d = `M${x} ${y}`;
  for (let i = 0; i < 6; i += 1) d += ` l${seg} ${i % 2 ? 7 : -7}`;
  return path(d, on ? "hs-rod hs-hot" : "hs-rod");
}

/** A fan with three blades; it spins while running, faster with speed. */
export function fan(cx, cy, r, on, speed = 1) {
  const b = r * 0.82;
  const blade = `M0 0 C${b * 0.35} ${-b * 0.25} ${b * 0.45} ${-b * 0.9} 0 ${-b} C${-b * 0.45} ${-b * 0.9} ${-b * 0.35} ${-b * 0.25} 0 0 Z`;
  const blades = [0, 120, 240].map((a) => `<path class="hs-blade" transform="rotate(${a})" d="${blade}"/>`).join("");
  const spin = on ? ` class="hs-spin" style="--hs-speed:${(1.2 / Math.max(speed, 0.2)).toFixed(2)}s"` : "";
  return (
    circle(cx, cy, r, "hs-fan-ring") +
    `<g transform="translate(${cx} ${cy})"><g${spin}>${blades}<circle class="hs-hub" r="${r * 0.12}"/></g></g>`
  );
}

/** A water drop. */
export const drop = (cx, cy, scale = 1, cls = "hs-drop") =>
  `<path class="${cls}" transform="translate(${cx} ${cy}) scale(${scale})" d="M0 -8 C4 -2 6 1 6 4 A6 6 0 0 1 -6 4 C-6 1 -4 -2 0 -8 Z"/>`;
