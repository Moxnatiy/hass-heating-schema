// The Heating Schema panel: the list of schemas, the sheet, and — for an
// administrator — the editor around it.
//
// The panel wires the parts together and owns what belongs to no part:
// which schema is open, saving it, and the bar at the top. Drawing is
// editor/canvas.js, the element list editor/palette.js, the settings of the
// selection editor/inspector.js.

import { setLanguage, t } from "./core/i18n.js";
import { SchemaApi } from "./core/api.js";
import { newDocument, normalize } from "./core/model.js";
import { EditorState } from "./editor/state.js";
import { Commands } from "./editor/commands.js";
import { SchemaCanvas } from "./editor/canvas.js";
import { Palette } from "./editor/palette.js";
import { Inspector } from "./editor/inspector.js";
import { handleKey } from "./editor/keyboard.js";
import { CANVAS_CSS, PANEL_CSS } from "./editor/styles.js";
import { askText, confirmDialog, DIALOG_CSS } from "./editor/dialog.js";
import { icon } from "./editor/icon.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);


class HeatingSchemaPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = new EditorState();
    this.commands = new Commands(this.state);
    this.schemas = [];
    this.mode = "view";
    this._built = false;
    this._liveFrame = 0;
    this._toastTimer = 0;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (hass && hass.language !== this._language) {
      this._language = hass.language;
      setLanguage(hass.language);
      if (this._built) this._renderAll();
    }
    if (first) this._start();
    else this._scheduleLive();
    if (this._menu) this._menu.hass = hass;
  }

  get hass() {
    return this._hass;
  }

  set narrow(value) {
    this._narrow = value;
    if (this._menu) this._menu.narrow = value;
  }

  get isAdmin() {
    return Boolean(this._hass && this._hass.user && this._hass.user.is_admin);
  }

  editable() {
    return this.isAdmin && this.mode === "edit";
  }

  connectedCallback() {
    this._onKey = (e) => {
      if (handleKey(e, this)) e.preventDefault();
    };
    this._onUnload = (e) => {
      if (this.state.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    this.addEventListener("keydown", this._onKey);
    window.addEventListener("beforeunload", this._onUnload);
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this._onKey);
    window.removeEventListener("beforeunload", this._onUnload);
  }

  // ---- start ---------------------------------------------------------------------

  async _start() {
    this.api = new SchemaApi(this._hass);
    this._build();
    // Right after Home Assistant starts, the integration may not have
    // registered its commands yet: wait a little rather than show an error.
    for (let attempt = 0; ; attempt += 1) {
      try {
        this.schemas = await this.api.list();
        break;
      } catch (err) {
        if (err && err.code === "unknown_command" && attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        this._toast(String((err && err.message) || err), "error");
        break;
      }
    }
    const remembered = localStorage.getItem("heating-schema-open");
    const pick = this.schemas.find((s) => s.id === remembered) || this.schemas[0];
    if (pick) await this._open(pick.id);
    else this._renderAll();
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>${PANEL_CSS}${CANVAS_CSS}${DIALOG_CSS}${
        // ha-icon is Home Assistant's; outside of it the text fallback shows.
        customElements.get("ha-icon") ? ".hs-fallback{display:none}" : "ha-icon{display:none}"
      }</style>
      <div class="hs-app">
        <header class="hs-bar"></header>
        <div class="hs-main">
          <aside class="hs-palette"></aside>
          <section class="hs-stage"><div class="hs-toast"></div></section>
          <aside class="hs-inspector"></aside>
        </div>
      </div>`;
    const root = this.shadowRoot;
    this.$bar = root.querySelector(".hs-bar");
    this.$main = root.querySelector(".hs-main");
    this.$stage = root.querySelector(".hs-stage");
    this.$toast = root.querySelector(".hs-toast");

    this.canvas = new SchemaCanvas(this.$stage, this.state, {
      editable: () => this.editable(),
      hass: () => this._hass,
      onPick: (node) => this._moreInfo(node),
      onDropElement: (type, at) => this.commands.add(type, at),
      onMessage: (text, level) => this._toast(text, level),
    });
    this.palette = new Palette(root.querySelector(".hs-palette"), (type) => {
      this.commands.add(type, this.canvas.centre());
      this.$main.classList.remove("hs-show-palette");
    });
    this.inspector = new Inspector(root.querySelector(".hs-inspector"), this.state, this.commands, {
      hass: () => this._hass,
      editable: () => this.editable(),
      focusNode: (id) => this.state.select([id]),
    });
    this.$bar.addEventListener("click", (e) => this._barClick(e));
    this.$bar.addEventListener("change", (e) => {
      if (e.target.matches(".hs-schema-select")) this._switchTo(e.target.value);
    });
    this.state.listen((reason) => {
      if (reason === "preview") return;
      this.inspector.render();
      this._renderBar();
    });
    this._built = true;
  }

  _renderAll() {
    if (!this._built) return;
    this._renderBar();
    this.$main.classList.toggle("hs-viewing", !this.editable());
    this.palette.render();
    this.inspector.render();
    this.canvas.render();
    this._renderEmpty();
  }

  _renderEmpty() {
    let empty = this.$stage.querySelector(".hs-empty");
    if (this.state.doc) {
      if (empty) empty.remove();
      return;
    }
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "hs-empty";
      this.$stage.append(empty);
    }
    empty.innerHTML = `<p>${t("ui.no_schemas")}</p>${
      this.isAdmin ? `<button data-action="new">${t("ui.create_first")}</button>` : ""
    }`;
    empty.querySelector("button")?.addEventListener("click", () => this._create());
  }

  // ---- the bar ----------------------------------------------------------------------

  _renderBar() {
    const doc = this.state.doc;
    const admin = this.isAdmin;
    const editing = this.editable();
    const options = this.schemas
      .map((s) => `<option value="${esc(s.id)}" ${doc && s.id === doc.id ? "selected" : ""}>${esc(s.name)}</option>`)
      .join("");
    const unsavedOption = doc && !doc.id ? `<option selected>${esc(doc.name)}</option>` : "";
    const button = (action, title, content, extra = "") =>
      `<button class="hs-icon-btn ${extra}" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}">${content}</button>`;

    this.$bar.innerHTML = `
      <span class="hs-menu"></span>
      <h1>${t("ui.title")}</h1>
      ${this.schemas.length || doc ? `<select class="hs-schema-select" aria-label="${t("inspector.schema")}">${unsavedOption}${options}</select>` : ""}
      ${
        admin
          ? `<div class="hs-group">
              ${button("new", t("ui.new_schema"), icon("plus", "+"))}
              ${doc ? button("rename", t("ui.rename"), icon("pencil", "✎")) : ""}
              ${doc ? button("copy-schema", t("ui.duplicate"), icon("content-copy", "⧉")) : ""}
              ${doc ? button("export", t("ui.export"), icon("download", "⇩")) : ""}
              ${button("import", t("ui.import"), icon("upload", "⇧"))}
              ${doc && doc.id ? button("delete-schema", t("ui.delete"), icon("delete", "🗑")) : ""}
            </div>`
          : ""
      }
      <span class="hs-spacer"></span>
      ${
        editing
          ? `<div class="hs-group">
              ${button("palette", t("category.sources"), icon("shape-plus", "▦"), "hs-drawer-toggle")}
              ${button("undo", t("ui.undo"), icon("undo", "↶"))}
              ${button("redo", t("ui.redo"), icon("redo", "↷"))}
              ${button("inspector", t("inspector.schema"), icon("tune", "☰"), "hs-drawer-toggle")}
            </div>`
          : ""
      }
      ${
        doc
          ? `<div class="hs-group">
              ${button("zoom-out", t("ui.zoom_out"), icon("minus", "−"))}
              ${button("fit", t("ui.zoom_fit"), icon("fit-to-screen-outline", "⤢"))}
              ${button("zoom-in", t("ui.zoom_in"), icon("plus", "+"))}
            </div>`
          : ""
      }
      ${
        admin && doc
          ? `<div class="hs-group">
              <button data-action="mode" class="${editing ? "hs-on" : ""}">${editing ? t("ui.view") : t("ui.edit")}</button>
              <button data-action="save" class="hs-primary ${this.state.dirty ? "hs-dirty" : ""}" ${this.state.dirty || !doc.id ? "" : "disabled"}>${
                this._saving ? t("ui.saving") : t("ui.save")
              }</button>
            </div>`
          : ""
      }
      <input type="file" accept="application/json,.json" class="hs-import" hidden>`;

    const undo = this.$bar.querySelector('[data-action="undo"]');
    if (undo) undo.disabled = !this.state.canUndo;
    const redo = this.$bar.querySelector('[data-action="redo"]');
    if (redo) redo.disabled = !this.state.canRedo;
    this.$bar.querySelector(".hs-import").addEventListener("change", (e) => this._import(e.target.files[0]));
    this._mountMenu();
  }

  /** Home Assistant's own menu button, so a phone can reach the sidebar. */
  _mountMenu() {
    const slot = this.$bar.querySelector(".hs-menu");
    if (!slot || !customElements.get("ha-menu-button")) return;
    if (!this._menu) this._menu = document.createElement("ha-menu-button");
    this._menu.hass = this._hass;
    this._menu.narrow = this._narrow;
    slot.append(this._menu);
  }

  _barClick(e) {
    const button = e.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const actions = {
      new: () => this._create(),
      rename: () => this._rename(),
      "copy-schema": () => this._duplicateSchema(),
      export: () => this._export(),
      import: () => this.$bar.querySelector(".hs-import").click(),
      "delete-schema": () => this._deleteSchema(),
      undo: () => this.state.undo(),
      redo: () => this.state.redo(),
      "zoom-in": () => this.canvas.zoomAt(1.25),
      "zoom-out": () => this.canvas.zoomAt(0.8),
      fit: () => this.canvas.fit(),
      mode: () => this._setMode(this.mode === "edit" ? "view" : "edit"),
      save: () => this.save(),
      palette: () => this._toggleDrawer("hs-show-palette"),
      inspector: () => this._toggleDrawer("hs-show-inspector"),
    };
    if (actions[button.dataset.action]) actions[button.dataset.action]();
  }

  _toggleDrawer(cls) {
    const open = !this.$main.classList.contains(cls);
    this.$main.classList.remove("hs-show-palette", "hs-show-inspector");
    this.$main.classList.toggle(cls, open);
  }

  _setMode(mode) {
    this.mode = mode;
    this.state.clearSelection(false);
    this._renderAll();
  }

  // ---- schemas ----------------------------------------------------------------------

  async _open(schemaId) {
    try {
      const schema = await this.api.get(schemaId);
      this.state.load(schema);
      localStorage.setItem("heating-schema-open", schemaId);
      // An empty schema opens ready to draw; one with a drawing opens to look at.
      this.mode = this.isAdmin && !schema.nodes.length ? "edit" : "view";
      this._renderAll();
      requestAnimationFrame(() => this.canvas.fit());
    } catch (err) {
      this._toast(t("ui.not_found"), "error");
    }
  }

  async _mayLeave() {
    return !this.state.dirty || confirmDialog(this.shadowRoot, t("ui.leave_unsaved"));
  }

  async _switchTo(schemaId) {
    if (!(await this._mayLeave())) {
      this._renderBar();
      return;
    }
    await this._open(schemaId);
  }

  async _create() {
    if (!(await this._mayLeave())) return;
    const name = await askText(this.shadowRoot, t("ui.new_name"), t("ui.untitled"));
    if (!name) return;
    await this._storeAndOpen(newDocument(name));
  }

  async _duplicateSchema() {
    const doc = this.state.doc;
    if (!doc || !(await this._mayLeave())) return;
    const copy = { ...structuredClone(doc), id: null, name: t("ui.copy_of", { name: doc.name }) };
    await this._storeAndOpen(copy);
  }

  async _storeAndOpen(doc) {
    try {
      const stored = await this.api.save(doc);
      this.schemas = await this.api.list();
      await this._open(stored.id);
      if (this.isAdmin) this._setMode("edit");
    } catch (err) {
      this._toast(t("ui.save_failed", { error: err.message || err }), "error");
    }
  }

  async _rename() {
    const doc = this.state.doc;
    const name = doc && (await askText(this.shadowRoot, t("ui.rename_prompt"), doc.name));
    if (!name || name === doc.name) return;
    this.state.commit((d) => (d.name = name));
    if (doc.id) await this.save();
  }

  async _deleteSchema() {
    const doc = this.state.doc;
    if (!doc || !doc.id) return;
    if (!(await confirmDialog(this.shadowRoot, t("ui.delete_schema_confirm", { name: doc.name })))) return;
    try {
      await this.api.remove(doc.id);
      this.schemas = await this.api.list();
      this.state.doc = null;
      if (this.schemas[0]) await this._open(this.schemas[0].id);
      else this._renderAll();
    } catch (err) {
      this._toast(String(err.message || err), "error");
    }
  }

  async save() {
    if (!this.isAdmin || !this.state.doc || this._saving) return;
    this._saving = true;
    this._renderBar();
    try {
      const stored = await this.api.save(this.state.doc);
      this.state.markSaved(stored);
      this.schemas = await this.api.list();
      localStorage.setItem("heating-schema-open", stored.id);
      this._toast(t("ui.saved"));
    } catch (err) {
      this._toast(t("ui.save_failed", { error: err.message || err }), "error");
    } finally {
      this._saving = false;
      this._renderBar();
    }
  }

  _export() {
    const doc = this.state.doc;
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(doc.name || "schema").replace(/[^\w\-а-яіїєґ ]+/gi, "_")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async _import(file) {
    if (!file || !(await this._mayLeave())) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.nodes) || !Array.isArray(data.pipes)) throw new Error("shape");
      const doc = normalize({ ...data, id: null, name: data.name || file.name.replace(/\.json$/i, "") });
      await this._storeAndOpen(doc);
    } catch (err) {
      this._toast(t("ui.import_failed"), "error");
    }
  }

  // ---- live ---------------------------------------------------------------------------

  _scheduleLive() {
    if (this._liveFrame || !this._built) return;
    this._liveFrame = requestAnimationFrame(() => {
      this._liveFrame = 0;
      this.canvas.updateLive();
      this.inspector.updateLive();
    });
  }

  /** A tap on an element while viewing: show its main entity. */
  _moreInfo(node) {
    const entityId = Object.values(node.bindings || {}).find(Boolean);
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _toast(text, level = "info") {
    this.$toast.textContent = text;
    this.$toast.className = `hs-toast hs-show${level !== "info" ? ` hs-${level}` : ""}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.$toast.classList.remove("hs-show"), level === "error" ? 6000 : 3000);
  }
}

if (!customElements.get("heating-schema-panel")) customElements.define("heating-schema-panel", HeatingSchemaPanel);
