// Every element the editor offers, in palette order.
//
// To add an element: write its module next to its kind (see registry.js for
// the contract), import it here and add it to LIBRARY, and give it texts in
// translations/en.js and translations/uk.js. Nothing else needs to know.

import heatPump from "./sources/heat-pump.js";
import boiler from "./sources/boiler.js";
import solarCollector from "./sources/solar-collector.js";
import dhwTank from "./storage/dhw-tank.js";
import bufferTank from "./storage/buffer-tank.js";
import expansionVessel from "./storage/expansion-vessel.js";
import pump from "./hydraulics/pump.js";
import hydraulicSeparator from "./hydraulics/hydraulic-separator.js";
import plateHx from "./hydraulics/plate-hx.js";
import manifold from "./hydraulics/manifold.js";
import junction from "./hydraulics/junction.js";
import valve3way from "./valves/valve-3way.js";
import valve from "./valves/valve.js";
import zoneValve from "./valves/zone-valve.js";
import checkValve from "./valves/check-valve.js";
import balancingValve from "./valves/balancing-valve.js";
import safetyValve from "./valves/safety-valve.js";
import strainer from "./valves/strainer.js";
import airVent from "./valves/air-vent.js";
import radiator from "./consumers/radiator.js";
import ufh from "./consumers/ufh.js";
import fanCoil from "./consumers/fan-coil.js";
import dhwTap from "./consumers/dhw-tap.js";
import coldWaterInlet from "./water/cold-water-inlet.js";
import drain from "./water/drain.js";
import { thermometer, manometer, flowmeter, heatMeter } from "./sensors/gauges.js";
import outdoorSensor from "./sensors/outdoor-sensor.js";
import text from "./annotations/text.js";
import value from "./annotations/value.js";

export const CATEGORIES = ["sources", "storage", "hydraulics", "valves", "consumers", "water", "sensors", "annotations"];

const LIBRARY = [
  heatPump,
  boiler,
  solarCollector,
  dhwTank,
  bufferTank,
  expansionVessel,
  pump,
  hydraulicSeparator,
  plateHx,
  manifold,
  junction,
  valve3way,
  valve,
  zoneValve,
  checkValve,
  balancingValve,
  safetyValve,
  strainer,
  airVent,
  radiator,
  ufh,
  fanCoil,
  dhwTap,
  coldWaterInlet,
  drain,
  thermometer,
  manometer,
  flowmeter,
  heatMeter,
  outdoorSensor,
  text,
  value,
];

export const ELEMENTS = Object.fromEntries(LIBRARY.map((def) => [def.type, def]));
export const ELEMENT_TYPES = LIBRARY.map((def) => def.type);

/** Default parameter values of a type, for a new element. */
export function defaultParams(type) {
  const def = ELEMENTS[type];
  return def ? Object.fromEntries(def.params.map((p) => [p.key, p.default])) : {};
}

/**
 * The element as it is for this node: size, ports and bindings after its
 * parameters. Null for an unknown type, so a schema saved by a newer version
 * still opens, with that element left out.
 */
export function resolve(node) {
  const def = ELEMENTS[node.type];
  if (!def) return null;
  const params = { ...defaultParams(node.type), ...(node.params || {}) };
  const full = { ...node, params };
  const size = def.size ? def.size(full) : { w: def.w, h: def.h };
  const resolved = { ...def, w: size.w, h: size.h, node: full, ports: def.ports(full), bindings: def.bindings(full) };
  resolved.spots = def.spotsFor ? def.spotsFor(resolved) : def.spots || null;
  return resolved;
}
