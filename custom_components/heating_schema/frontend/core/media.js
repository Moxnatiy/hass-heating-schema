// What flows in a pipe, and which ports may be joined.
//
// A pipe carries one medium. Its colour follows the usual convention of
// European heating diagrams: supply red, return blue, domestic hot water
// orange, cold water green, circulation violet; solar fluid and brine have
// colours of their own because they are not water and must never meet it.
//
// A port belongs to a circuit *family*. Families that hold different fluids
// may not be joined: potable water and heating water are separated by a heat
// exchanger by law (EN 1717), and solar fluid or brine is a glycol mixture.
// Within a family a port may also have a role, supply or return, and joining a
// supply to a return is legal but usually a drawing mistake, so it is a warning.

export const MEDIA = {
  heating_supply: { family: "heating", role: "supply", color: "#e53935" },
  heating_return: { family: "heating", role: "return", color: "#1e88e5" },
  dhw: { family: "dhw", role: "supply", color: "#fb8c00" },
  dhw_circulation: { family: "dhw", role: "return", color: "#8e24aa", dash: "6 4" },
  cold_water: { family: "cold", role: null, color: "#43a047" },
  solar_supply: { family: "solar", role: "supply", color: "#f9a825" },
  solar_return: { family: "solar", role: "return", color: "#6d4c41" },
  brine_supply: { family: "brine", role: "supply", color: "#00acc1" },
  brine_return: { family: "brine", role: "return", color: "#00796b" },
  drain: { family: "drain", role: null, color: "#757575", dash: "2 4" },
  other: { family: "any", role: null, color: "#9e9e9e" },
};

export const MEDIUM_IDS = Object.keys(MEDIA);

/**
 * Families whose fluids may share a pipe. Domestic hot and cold water are the
 * same potable water at different temperatures: a cold water pipe feeding a
 * hot water tank's inlet is the normal case.
 */
const COMPATIBLE = {
  heating: ["heating"],
  dhw: ["dhw", "cold"],
  cold: ["cold", "dhw"],
  solar: ["solar"],
  brine: ["brine"],
  drain: ["drain", "heating", "dhw", "cold", "solar", "brine"],
};

/** Whether two port families may be joined: "any" joins everything. */
export function familiesCompatible(a, b) {
  if (!a || !b || a === "any" || b === "any") return true;
  return (COMPATIBLE[a] || [a]).includes(b);
}

/**
 * The medium a new pipe between two ports should carry.
 *
 * The more specific port decides: a boiler's supply outlet says
 * heating_supply, a pump says nothing. Falls back to the medium last used, so
 * drawing a run of pipes through pumps and valves keeps its colour.
 */
export function mediumFor(a, b, fallback = "heating_supply") {
  for (const port of [a, b]) {
    if (port && port.medium) return port.medium;
  }
  const family = [a, b].map((p) => p && p.family).find((f) => f && f !== "any");
  const role = [a, b].map((p) => p && p.role).find(Boolean);
  if (family) {
    const match = MEDIUM_IDS.find(
      (id) => MEDIA[id].family === family && (!role || MEDIA[id].role === role)
    );
    if (match) return match;
  }
  return fallback;
}

/** Whether a medium may run into a port, and how bad it is if not. */
export function mediumFits(medium, port) {
  const spec = MEDIA[medium] || MEDIA.other;
  if (!familiesCompatible(spec.family, port.family)) return "error";
  if (spec.role && port.role && spec.role !== port.role) return "warning";
  return null;
}
