// A stand-in for Home Assistant, to work on the panel without logging in.
//
// Schemas live in localStorage; a handful of sensors change every few
// seconds so the drawing has something to show. Open
//   http://localhost:8765/tools/dev/?lang=uk&light=1&admin=0
// lang, light and admin are optional.

import "../../custom_components/heating_schema/frontend/heating-schema-panel.js";
import { sampleDoc, sampleStates } from "../../tests/frontend/fixtures.mjs";

const params = new URLSearchParams(location.search);
if (params.get("light")) document.documentElement.classList.add("light");

const KEY = "heating-schema-bench";
const load = () => JSON.parse(localStorage.getItem(KEY) || "null") || { sample: { ...sampleDoc(), updated: null } };
const store = (all) => localStorage.setItem(KEY, JSON.stringify(all));
const listeners = new Map();

let tick = 0;
const states = () => {
  const dhw = Math.floor(tick / 4) % 2 === 1;
  const all = sampleStates({ dhw, pump: !dhw });
  all["sensor.flow"].state = String((42 + Math.sin(tick / 3) * 3).toFixed(1));
  all["sensor.tank_top"].state = String((48 + (tick % 8)).toFixed(1));
  return all;
};

const hass = {
  language: params.get("lang") || "uk",
  user: { is_admin: params.get("admin") !== "0" },
  states: states(),
  async callWS(msg) {
    const all = load();
    switch (msg.type) {
      case "heating_schema/list":
        return { schemas: Object.values(all).map((s) => ({ id: s.id, name: s.name, updated: s.updated, nodes: s.nodes.length })) };
      case "heating_schema/get":
        if (!all[msg.schema_id]) throw new Error("not found");
        return { schema: all[msg.schema_id] };
      case "heating_schema/save": {
        const schema = { ...msg.schema, id: msg.schema.id || Math.random().toString(16).slice(2, 14), updated: new Date().toISOString() };
        all[schema.id] = schema;
        store(all);
        for (const [id, fn] of listeners) if (id === schema.id) fn({ schema });
        return { schema };
      }
      case "heating_schema/delete":
        delete all[msg.schema_id];
        store(all);
        return null;
      default:
        throw new Error(`unknown ${msg.type}`);
    }
  },
  connection: {
    async subscribeMessage(fn, msg) {
      listeners.set(msg.schema_id, fn);
      fn({ schema: load()[msg.schema_id] || null });
      return () => listeners.delete(msg.schema_id);
    },
  },
};

const panel = document.querySelector("heating-schema-panel");
panel.hass = hass;
setInterval(() => {
  tick += 1;
  panel.hass = { ...hass, states: states() };
}, 2000);
window.bench = { panel, hass };
