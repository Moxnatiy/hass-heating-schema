// The element palette: every element by category, with a search.
//
// An element is dragged onto the sheet, or clicked to drop it in the middle
// of the view. The pictures are the elements' own drawings, so the palette
// always matches what lands on the sheet.

import { CATEGORIES, ELEMENT_TYPES, ELEMENTS, resolve, defaultParams } from "../elements/index.js";
import { t, elementName } from "../core/i18n.js";
import { ELEMENT_MIME } from "./canvas.js";

const EMPTY_LIVE = { values: {}, on: null, alarm: false, flowing: false };
const ICON = 44;

/** A small picture of an element, drawn by the element itself. */
function icon(type) {
  const def = resolve({ id: `icon-${type}`, type, x: 0, y: 0, params: defaultParams(type), bindings: {} });
  const ctx = { uid: `icon-${type}`, connected: new Set(def.ports.map((p) => p.id)), text: () => {} };
  const body = def.draw(def.node, EMPTY_LIVE, ctx, def);
  const pad = 4;
  return `<svg class="hs-sheet hs-icon-svg" viewBox="${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}" width="${ICON}" height="${ICON}">${body}</svg>`;
}

const icons = new Map();
const iconOf = (type) => {
  if (!icons.has(type)) icons.set(type, icon(type));
  return icons.get(type);
};

export class Palette {
  /**
   * @param {HTMLElement} container
   * @param {(type: string) => void} onAdd  an element clicked rather than dragged
   */
  constructor(container, onAdd) {
    this.container = container;
    this.onAdd = onAdd;
    this.query = "";
    container.addEventListener("input", (e) => {
      if (!e.target.matches(".hs-search")) return;
      this.query = e.target.value;
      this._renderList();
    });
    container.addEventListener("click", (e) => {
      const item = e.target.closest("[data-type]");
      if (item) this.onAdd(item.dataset.type);
    });
    container.addEventListener("dragstart", (e) => {
      const item = e.target.closest("[data-type]");
      if (!item) return;
      e.dataTransfer.setData(ELEMENT_MIME, item.dataset.type);
      e.dataTransfer.effectAllowed = "copy";
    });
  }

  render() {
    this.container.innerHTML = `
      <input class="hs-search" type="search" placeholder="${t("ui.search")}" value="${this.query.replace(/"/g, "&quot;")}">
      <div class="hs-palette-list"></div>`;
    this._renderList();
  }

  _renderList() {
    const list = this.container.querySelector(".hs-palette-list");
    const query = this.query.trim().toLowerCase();
    const groups = CATEGORIES.map((category) => {
      const types = ELEMENT_TYPES.filter(
        (type) =>
          ELEMENTS[type].category === category &&
          (!query || elementName(type).toLowerCase().includes(query) || type.includes(query))
      );
      if (!types.length) return "";
      const items = types
        .map(
          (type) => `
          <button class="hs-palette-item" data-type="${type}" draggable="true" title="${elementName(type)}">
            ${iconOf(type)}<span>${elementName(type)}</span>
          </button>`
        )
        .join("");
      return `<section><h3>${t(`category.${category}`)}</h3><div class="hs-palette-grid">${items}</div></section>`;
    });
    list.innerHTML = groups.join("");
  }
}
