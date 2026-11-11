// Icons of the editor's buttons: Home Assistant's Material Design icons, with
// a text fallback for the dev bench, where ha-icon does not exist. The panel's
// stylesheet hides whichever of the two does not apply.

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const icon = (name, fallback) => `<ha-icon icon="mdi:${name}"></ha-icon><span class="hs-fallback">${fallback}</span>`;

/** A button showing only an icon; its title is the tooltip and the name. */
export const iconButton = (action, title, iconName, fallback, extra = "") =>
  `<button class="hs-icon-btn ${extra}" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}">${icon(iconName, fallback)}</button>`;
