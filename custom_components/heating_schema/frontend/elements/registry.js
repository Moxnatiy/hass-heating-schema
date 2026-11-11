// The contract every element follows, and its defaults.
//
// An element module exports defineElement({ … }) with:
//
//   type        id saved in schemas; never change it once released
//   category    palette group: sources, storage, hydraulics, valves,
//               consumers, water, sensors, annotations
//   w, h        the box, multiples of 20 so it rotates on the grid;
//               or size(node) → { w, h } when parameters change it
//   ports(node)            → [port(…)]                 kit/ports.js
//   params                 [num(…), select(…), …]      kit/fields.js
//   bindings(node)         → [bind(…)]                 kit/fields.js
//   passages(node, live, ports) → [[from, to], …]       kit/ports.js
//   draw(node, live, ctx, def)  → SVG markup in the element's own box
//
// Optional:
//   drives(node, live)  → speed > 0 when the element pushes water (a pump)
//   source(node)        → port id where an open circuit begins (the mains)
//   sink(node, live)    → true when water leaves here (an open tap)
//   panel               { x, y, align } where listed values go inside the body
//   spots / spotsFor(def)  { bindingKey: [x, y] } values shown at a place
//   hideLabel           no name above the element
//
// draw() receives ctx = { uid, connected: Set(port ids), text(x, y, value,
// cls, anchor) }. Text is drawn upright whatever the element's rotation, so
// letters and numbers go through ctx.text rather than into the markup.
// live = { values, on, alarm, flowing } (core/live.js).
//
// Texts: element.<type>, and param./option./binding./port. keys for its
// fields, in translations/en.js and translations/uk.js.

const REQUIRED = ["type", "category", "ports", "draw"];

export function defineElement(spec) {
  for (const key of REQUIRED) {
    if (!spec[key]) throw new Error(`element ${spec.type || "?"}: ${key} is required`);
  }
  if (!spec.size && !(spec.w && spec.h)) throw new Error(`element ${spec.type}: w and h, or size(), are required`);
  return Object.freeze({
    params: [],
    bindings: () => [],
    passages: () => [],
    ...spec,
  });
}
