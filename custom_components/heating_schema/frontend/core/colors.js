// Colours that carry meaning on the drawing.

/** From cold blue at 15 °C to hot red at 65 °C, for water temperatures. */
export function temperatureColor(celsius) {
  const t = Math.max(0, Math.min(1, (celsius - 15) / 50));
  const hue = 210 - 210 * t;
  return `hsl(${hue.toFixed(0)} 70% 45%)`;
}
