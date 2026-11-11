// A small but complete system used by the frontend tests: a heat pump that
// heats either the hot water tank or the floor, through a diverting valve.
export function sampleDoc() {
  return {
    id: "sample",
    name: "Sample",
    nodes: [
      { id: "hp", type: "heat_pump", x: 0, y: 200, bindings: { running: "binary_sensor.compressor", flow_temp: "sensor.flow", return_temp: "sensor.ret", outdoor_temp: "sensor.out" } },
      { id: "v3", type: "valve_3way", x: 280, y: 200, bindings: { a_open: "binary_sensor.dhw_mode" } },
      { id: "tank", type: "dhw_tank", x: 560, y: 60, bindings: { temp_top: "sensor.tank_top" } },
      { id: "pump", type: "pump", x: 300, y: 420, bindings: { running: "switch.pump" } },
      { id: "j1", type: "junction", x: 400, y: 260 },
      { id: "man", type: "manifold", x: 600, y: 380, params: { outlets: 2 } },
      { id: "ufh1", type: "ufh", x: 560, y: 600 },
      { id: "ufh2", type: "ufh", x: 760, y: 600 },
    ],
    pipes: [
      { id: "p1", from: { node: "hp", port: "supply_out" }, to: { node: "v3", port: "AB" }, medium: "heating_supply" },
      { id: "p2", from: { node: "v3", port: "A" }, to: { node: "tank", port: "coil_in" }, medium: "heating_supply" },
      { id: "p3", from: { node: "tank", port: "coil_out" }, to: { node: "j1", port: "n" }, medium: "heating_return" },
      { id: "p4", from: { node: "j1", port: "w" }, to: { node: "hp", port: "return_in" }, medium: "heating_return" },
      { id: "p5", from: { node: "v3", port: "B" }, to: { node: "pump", port: "in" }, medium: "heating_supply" },
      { id: "p6", from: { node: "pump", port: "out" }, to: { node: "man", port: "supply_in" }, medium: "heating_supply" },
      { id: "p7", from: { node: "man", port: "return_out" }, to: { node: "j1", port: "s" }, medium: "heating_return" },
      { id: "p8", from: { node: "man", port: "out_1" }, to: { node: "ufh1", port: "in" }, medium: "heating_supply" },
      { id: "p9", from: { node: "ufh1", port: "out" }, to: { node: "man", port: "ret_1" }, medium: "heating_return" },
      { id: "p10", from: { node: "man", port: "out_2" }, to: { node: "ufh2", port: "in" }, medium: "heating_supply" },
      { id: "p11", from: { node: "ufh2", port: "out" }, to: { node: "man", port: "ret_2" }, medium: "heating_return" },
    ],
  };
}

export const entity = (entity_id, state, attributes = {}) => ({ entity_id, state: String(state), attributes });

export function sampleStates({ dhw = false, pump = true, compressor = true } = {}) {
  const list = [
    entity("binary_sensor.compressor", compressor ? "on" : "off"),
    entity("binary_sensor.dhw_mode", dhw ? "on" : "off"),
    entity("switch.pump", pump ? "on" : "off"),
    entity("sensor.flow", 42.5, { unit_of_measurement: "°C", device_class: "temperature" }),
    entity("sensor.ret", 36.1, { unit_of_measurement: "°C", device_class: "temperature" }),
    entity("sensor.out", 3.4, { unit_of_measurement: "°C", device_class: "temperature" }),
    entity("sensor.tank_top", 52.3, { unit_of_measurement: "°C", device_class: "temperature" }),
  ];
  return Object.fromEntries(list.map((s) => [s.entity_id, s]));
}
