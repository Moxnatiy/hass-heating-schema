// Tanks and other vessels that show their temperature layers.

import { temperatureColor } from "../../core/colors.js";
import { rect, bodyClass } from "./svg.js";

const LAYERS = [
  ["temp_top", 0.1],
  ["temp_mid", 0.5],
  ["temp_bottom", 0.9],
];

/**
 * A vertical gradient through the known temperatures, top to bottom.
 * Returns { defs, paint }; paint is "none" while nothing is known.
 */
export function strata(live, uid, height) {
  const stops = LAYERS.map(([key, at]) => {
    const v = live.values[key];
    return v && v.ok && v.num !== null ? [at, temperatureColor(v.num)] : null;
  }).filter(Boolean);
  if (!stops.length) return { defs: "", paint: "none" };
  const id = `hs-strata-${uid}`;
  const marks = stops
    .map(([at, color]) => `<stop offset="${(at * 100).toFixed(0)}%" stop-color="${color}" stop-opacity="0.55"/>`)
    .join("");
  return {
    defs: `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="${height}" gradientUnits="userSpaceOnUse">${marks}</linearGradient></defs>`,
    paint: `url(#${id})`,
  };
}

/** A tank's rounded shell filled with its temperature layers. */
export function tankShell(live, uid, w, h) {
  const fill = strata(live, uid, h);
  return (
    fill.defs +
    rect(10, 4, w - 20, h - 8, 18, bodyClass(live, "hs-body hs-tank")) +
    rect(13, 7, w - 26, h - 14, 15, "hs-strata", `fill="${fill.paint}"`)
  );
}
