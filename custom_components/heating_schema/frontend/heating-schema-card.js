// The Heating Schema card: one schema on a dashboard, live.
//
//   type: custom:heating-schema-card
//   schema_id: 1a2b3c4d5e6f
//   height: 400        optional; without it the card keeps the drawing's ratio
//
// The schema is drawn in the panel; the card only shows it, and follows its
// saves, so a change in the panel reaches every dashboard without a reload.

import { setLanguage, t } from "./core/i18n.js";
import { SchemaApi } from "./core/api.js";
import { normalize, resolveAll, bounds } from "./core/model.js";
import { evaluate } from "./core/live.js";
import { SchemaRenderer } from "./core/render.js";
import { SCHEMA_CSS } from "./core/styles.js";

const MARGIN = 40;

/**
 * A card on a dashboard that is open while Home Assistant starts can ask for
 * its schema before the integration is ready; it asks again this much later.
 */
const RETRY_MS = 5000;

const CARD_CSS = `
  ${SCHEMA_CSS}
  ha-card { overflow: hidden; }
  .hs-card-svg { display: block; width: 100%; }
  .hs-card-svg .hs-node { cursor: pointer; }
  .hs-message { padding: 16px; color: var(--secondary-text-color); }
`;

class HeatingSchemaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._doc = null;
    this._defs = new Map();
    this._unsubscribe = null;
    this._connection = null;
    // After a reconnect, follow the schema again (see SchemaApi.subscribe).
    this._onReady = () => {
      if (this.isConnected) this._follow();
    };
  }

  /** Listen for reconnects of the current connection, or stop listening. */
  _listen(on) {
    const connection = on && this._hass ? this._hass.connection : null;
    if (connection === this._connection) return;
    if (this._connection) this._connection.removeEventListener("ready", this._onReady);
    this._connection = connection;
    if (connection) connection.addEventListener("ready", this._onReady);
  }

  static getConfigElement() {
    return document.createElement("heating-schema-card-editor");
  }

  static async getStubConfig(hass) {
    try {
      const schemas = await new SchemaApi(hass).list();
      return { schema_id: schemas[0] ? schemas[0].id : "" };
    } catch (err) {
      return { schema_id: "" };
    }
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const changed = !this._config || this._config.schema_id !== config.schema_id;
    this._config = { ...config };
    if (changed) this._follow();
    this._layout();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (hass.language !== this._language) {
      this._language = hass.language;
      setLanguage(hass.language);
    }
    if (this.isConnected) this._listen(true);
    if (first) this._follow();
    else this._updateLive();
  }

  connectedCallback() {
    this._listen(true);
    if (this._hass && !this._unsubscribe) this._follow();
  }

  disconnectedCallback() {
    this._listen(false);
    this._stop();
  }

  getCardSize() {
    return this._config && this._config.height ? Math.ceil(this._config.height / 50) : 6;
  }

  /** In a sections dashboard a schema takes the section's whole width. */
  getGridOptions() {
    return { columns: "full", min_columns: 6 };
  }

  _stop() {
    clearTimeout(this._retry);
    this._retry = null;
    if (this._unsubscribe) {
      this._unsubscribe.then((stop) => stop()).catch(() => {});
      this._unsubscribe = null;
    }
  }

  /** Subscribe to the configured schema. */
  _follow() {
    this._stop();
    if (!this._hass || !this._config) return;
    if (!this._config.schema_id) {
      this._message(t("card.none"));
      return;
    }
    const attempt = (this._unsubscribe = new SchemaApi(this._hass)
      .subscribe(this._config.schema_id, (schema) => {
        if (!schema) {
          this._doc = null;
          this._message(t("ui.not_found"));
          return;
        }
        this._doc = normalize(schema);
        this._defs = resolveAll(this._doc);
        this._draw();
      })
      .catch((err) => {
        if (this._unsubscribe !== attempt) return () => {};
        this._unsubscribe = null;
        // A drawing already shown stays while the integration comes back.
        if (!this._doc) {
          this._message(err && err.code === "unknown_command" ? t("ui.loading") : String(err.message || err));
        }
        if (this.isConnected) this._retry = setTimeout(() => this._follow(), RETRY_MS);
        return () => {};
      }));
  }

  _message(text) {
    this.shadowRoot.innerHTML = `<style>${CARD_CSS}</style><ha-card><div class="hs-message">${text}</div></ha-card>`;
    this._renderer = null;
  }

  _draw() {
    const box = bounds(this._doc, this._defs);
    // Labels sit above elements and values under them, outside their boxes.
    const view = [box.x - MARGIN, box.y - MARGIN, box.w + MARGIN * 2, box.h + MARGIN * 2];
    this.shadowRoot.innerHTML = `
      <style>${CARD_CSS}</style>
      <ha-card>
        <svg class="hs-card-svg hs-sheet" viewBox="${view.join(" ")}" preserveAspectRatio="xMidYMid meet"><g></g></svg>
      </ha-card>`;
    const svg = this.shadowRoot.querySelector("svg");
    const settings = this._doc.settings || {};
    this._renderer = new SchemaRenderer(svg.querySelector("g"), {
      editing: false,
      showPorts: Boolean(settings.show_ports),
      animate: settings.animate_flow !== false,
      showValues: settings.show_values !== false,
    });
    this._renderer.setDocument(this._doc, this._defs);
    svg.addEventListener("click", (e) => this._click(e));
    this._layout();
    this._updateLive();
  }

  _layout() {
    const svg = this.shadowRoot.querySelector("svg");
    if (svg) svg.style.height = this._config && this._config.height ? `${this._config.height}px` : "";
  }

  _updateLive() {
    if (!this._renderer || !this._hass) return;
    this._renderer.setLive(evaluate(this._doc, this._defs, this._hass.states));
  }

  _click(e) {
    const el = e.target.closest("[data-node]");
    if (!el) return;
    const node = this._doc.nodes.find((n) => n.id === el.dataset.node);
    const entityId = node && Object.values(node.bindings || {}).find(Boolean);
    if (entityId) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
    }
  }
}

/** The card's settings: which schema, and an optional fixed height. */
class HeatingSchemaCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    setLanguage(hass.language);
    if (first) {
      new SchemaApi(hass)
        .list()
        .then((schemas) => {
          this._schemas = schemas;
          this._render();
        })
        .catch(() => {});
    }
  }

  _render() {
    if (!this._config) return;
    const schemas = this._schemas || [];
    const options = schemas
      .map((s) => `<option value="${s.id}" ${s.id === this._config.schema_id ? "selected" : ""}>${s.name.replace(/</g, "&lt;")}</option>`)
      .join("");
    this.innerHTML = `
      <style>
        .hs-editor label { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
        .hs-editor select, .hs-editor input { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
        .hs-editor p { color: var(--secondary-text-color); font-size: 13px; }
      </style>
      <div class="hs-editor">
        <label>${t("card.schema")}
          <select data-key="schema_id"><option value="">${t("card.choose")}</option>${options}</select></label>
        <label>${t("card.height")}
          <input data-key="height" type="number" min="100" step="10" value="${this._config.height || ""}"></label>
        <p>${t("card.edit_in_panel")}</p>
      </div>`;
    this.querySelectorAll("[data-key]").forEach((el) =>
      el.addEventListener("change", () => {
        const config = { ...this._config };
        const value = el.value;
        if (el.dataset.key === "height") {
          if (value) config.height = Number(value);
          else delete config.height;
        } else {
          config[el.dataset.key] = value;
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      })
    );
  }
}

if (!customElements.get("heating-schema-card")) customElements.define("heating-schema-card", HeatingSchemaCard);
if (!customElements.get("heating-schema-card-editor")) {
  customElements.define("heating-schema-card-editor", HeatingSchemaCardEditor);
}

// The card picker reads this once, before the card ever sees hass: the page's
// language is the user's, as Home Assistant sets it on the document.
setLanguage(document.documentElement.lang || navigator.language);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "heating-schema-card")) {
  window.customCards.push({
    type: "heating-schema-card",
    name: t("card.name"),
    description: t("card.description"),
    preview: true,
    documentationURL: "https://github.com/Moxnatiy/hass-heating-schema",
  });
}
