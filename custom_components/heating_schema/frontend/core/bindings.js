// What a binding accepts, and how its value is read.
//
// Each live value of an element is bound to one Home Assistant entity, and the
// binding has a kind: a supply temperature is a temperature, a pump's speed is
// a percentage. The kind decides which entities the editor offers, which ones
// it warns about, and how the state is read — a climate entity's temperature
// is an attribute, a pump bound to its power meter runs while it draws power.

const TEMPERATURE_UNITS = ["°C", "°F", "K"];

export const KINDS = {
  // On or off: a burner, a compressor, a pump, a heating rod.
  running: {
    domains: ["switch", "binary_sensor", "input_boolean", "fan", "climate", "water_heater", "sensor", "number", "light"],
    prefer: ["switch", "binary_sensor", "input_boolean"],
  },
  // A fault or a warning: a pressure switch, an error code.
  alarm: { domains: ["binary_sensor", "sensor", "input_boolean"] },
  // Open or closed: a zone valve's end switch, a window contact.
  open: { domains: ["binary_sensor", "switch", "valve", "cover", "input_boolean"], prefer: ["binary_sensor", "valve", "switch"] },
  temperature: {
    domains: ["sensor", "number", "input_number", "climate", "water_heater"],
    deviceClass: "temperature",
    units: TEMPERATURE_UNITS,
  },
  setpoint: {
    domains: ["climate", "water_heater", "number", "input_number", "sensor"],
    units: TEMPERATURE_UNITS,
  },
  // 0..100: a valve's opening, a pump's speed, a burner's modulation.
  percent: {
    domains: ["sensor", "number", "input_number", "valve", "cover", "fan"],
    units: ["%"],
  },
  pressure: {
    domains: ["sensor", "number", "input_number"],
    deviceClass: "pressure",
    units: ["bar", "mbar", "kPa", "Pa", "hPa", "MPa", "psi"],
  },
  power: {
    domains: ["sensor", "number", "input_number"],
    deviceClass: "power",
    units: ["W", "kW", "MW"],
  },
  energy: {
    domains: ["sensor"],
    deviceClass: "energy",
    units: ["Wh", "kWh", "MWh", "GJ", "MJ"],
  },
  flow: {
    domains: ["sensor", "number", "input_number"],
    deviceClass: "volume_flow_rate",
    units: ["L/min", "L/h", "L/s", "m³/h", "m³/s", "l/min", "l/h", "gal/min"],
  },
  speed: { domains: ["sensor", "number", "input_number", "fan"], units: ["rpm", "%", "Hz"] },
  number: { domains: ["sensor", "number", "input_number"] },
  // Anything shown as text: a temperature, an operating mode, a status. Any
  // entity fits; measured and settable values come first in the picker.
  state: {
    domains: null,
    prefer: ["sensor", "climate", "water_heater", "number", "input_number", "select", "input_select", "input_text"],
  },
};

/** Whether an entity suits a kind: "ok", "warning" (usable, odd) or "error". */
export function checkEntity(kind, stateObj) {
  const spec = KINDS[kind];
  if (!spec || !stateObj) return "ok";
  const domain = stateObj.entity_id.split(".")[0];
  if (spec.domains && !spec.domains.includes(domain)) return "error";
  const attrs = stateObj.attributes || {};
  if (domain === "climate" || domain === "water_heater") return "ok";
  if (spec.units) {
    const unit = attrs.unit_of_measurement;
    if (domain === "valve" || domain === "cover" || domain === "fan") return "ok";
    if (unit && !spec.units.includes(unit)) return "error";
    if (!unit && ["sensor", "number", "input_number"].includes(domain)) return "warning";
  }
  if (spec.deviceClass && attrs.device_class && attrs.device_class !== spec.deviceClass) {
    return "warning";
  }
  return "ok";
}

/**
 * Entities of hass ordered best first, for the editor's picker: the right
 * device class, then a preferred domain, then any other that fits, then the
 * odd ones.
 */
export function candidates(kind, states) {
  const spec = KINDS[kind] || {};
  const ranked = [];
  for (const stateObj of Object.values(states || {})) {
    const fit = checkEntity(kind, stateObj);
    if (fit === "error") continue;
    const attrs = stateObj.attributes || {};
    const domain = stateObj.entity_id.split(".")[0];
    const named = Boolean(spec.deviceClass) && spec.deviceClass === attrs.device_class;
    const preferred = Boolean(spec.prefer) && spec.prefer.includes(domain);
    ranked.push({ stateObj, rank: fit === "ok" ? (named || preferred ? 0 : 1) : 2 });
  }
  ranked.sort(
    (a, b) => a.rank - b.rank || a.stateObj.entity_id.localeCompare(b.stateObj.entity_id)
  );
  return ranked.map((item) => item.stateObj);
}

const OFF = new Set(["off", "false", "closed", "idle", "standby", "unavailable", "unknown", "none", "0", ""]);
const ON = new Set(["on", "true", "open", "opening", "heating", "heat", "running", "active", "home", "problem"]);

/**
 * Read a binding.
 *
 * Returns { ok, on, num, unit, text }: `on` for kinds that switch, `num` for
 * those that measure, `text` always. `ok` is false while the entity is
 * missing or unavailable, so the drawing can grey the value instead of showing
 * a stale or invented one.
 */
export function readBinding(kind, stateObj) {
  if (!stateObj) return { ok: false, on: null, num: null, unit: "", text: "—" };
  const state = String(stateObj.state);
  const attrs = stateObj.attributes || {};
  const domain = stateObj.entity_id.split(".")[0];
  if (state === "unavailable" || state === "unknown") {
    return { ok: false, on: null, num: null, unit: "", text: "—" };
  }

  let num = null;
  let unit = attrs.unit_of_measurement || "";
  if (domain === "climate" || domain === "water_heater") {
    const attr = kind === "setpoint" ? "temperature" : "current_temperature";
    num = toNumber(attrs[attr]);
    unit = unit || attrs.temperature_unit || "°C";
  } else if (domain === "valve" || domain === "cover") {
    num = toNumber(attrs.current_position);
    if (num === null) num = state === "open" ? 100 : state === "closed" ? 0 : null;
    unit = "%";
  } else if (domain === "fan" && (kind === "percent" || kind === "speed")) {
    num = state === "off" ? 0 : toNumber(attrs.percentage);
    unit = "%";
  } else {
    num = toNumber(state);
  }

  let on = null;
  if (domain === "climate") {
    const action = attrs.hvac_action;
    on = action ? action === "heating" || action === "preheating" : state !== "off";
  } else if (num !== null && ["running", "open", "alarm"].includes(kind)) {
    on = num > 0;
  } else if (ON.has(state.toLowerCase())) {
    on = true;
  } else if (OFF.has(state.toLowerCase())) {
    on = false;
  } else if (kind === "alarm") {
    // A text sensor reporting an error code: anything but "no error" is one.
    on = !/^(ok|no[ _-]?error|normal|none)$/i.test(state);
  }

  return { ok: true, on, num, unit, text: format(num, unit, state) };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function format(num, unit, state) {
  if (num === null) return state;
  const abs = Math.abs(num);
  const digits = abs >= 100 || Number.isInteger(num) ? 0 : abs >= 10 ? 1 : 2;
  // 3.40 reads as 3.4, 21.0 as 21: trailing zeros say nothing.
  const value = String(Number(num.toFixed(digits)));
  return unit ? `${value} ${unit}` : value;
}
