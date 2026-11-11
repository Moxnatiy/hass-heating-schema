// Reading an element's state from its bindings.
//
// live.values holds each bound value as core/bindings.js reads it:
// { ok, on, num, unit, text }. An unbound or unavailable value is treated as
// unknown, and unknown leaves an element in its design state: a drawing
// without data still shows how the system is meant to work.

/** Open unless the binding says it is closed. */
export function isOpen(live, key) {
  const v = live.values[key];
  if (!v || !v.ok) return true;
  if (v.num !== null) return v.num > 0;
  return v.on !== false;
}

/** A known on/off state of a binding, or null. */
export function onOf(live, key) {
  const v = live.values[key];
  return v && v.ok && v.on !== null ? v.on : null;
}

/** A known number of a binding, or null. */
export function numberOf(live, key) {
  const v = live.values[key];
  return v && v.ok && v.num !== null ? v.num : null;
}

/** A pump's relative speed for animation: 1 is full speed. */
export function pumpSpeed(live) {
  const speed = numberOf(live, "speed");
  return speed === null ? 1 : Math.max(0.2, Math.min(1.5, speed / 100));
}

/**
 * A boiler or heat pump with its own circulation pump moves water while it
 * runs; one without relies on the pumps drawn outside it.
 */
export function sourceDrives(node, live) {
  return node.params.internal_pump && live.on === true ? 1 : 0;
}

/** A reading short enough for a gauge face: the number alone. */
export function shortValue(v) {
  if (v.num === null) return v.text;
  return String(Math.abs(v.num) >= 100 ? Math.round(v.num) : Math.round(v.num * 10) / 10);
}
