// Parameters and bindings of an element.
//
// A parameter is technical data entered in the editor: a boiler's output, a
// tank's volume, how a radiator is connected. Its key names the field in the
// saved schema and its text (translations: param.<key>, option.<key>.<value>).
//
// A binding is a live value read from a Home Assistant entity. Its kind
// (core/bindings.js) decides which entities fit; `show` puts the value on the
// drawing by default. Text: binding.<key>, and binding_hint.<key> if any.

export const num = (key, initial, unit, min, max, step = 1) => ({
  key,
  type: "number",
  default: initial,
  unit,
  min,
  max,
  step,
});

export const select = (key, initial, options) => ({ key, type: "select", default: initial, options });

export const bool = (key, initial = false) => ({ key, type: "bool", default: initial });

export const text = (key, initial = "") => ({ key, type: "text", default: initial });

export const bind = (key, kind, show = true) => ({ key, kind, show });
