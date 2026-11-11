// The inspector: what the selection is, and its settings.
//
//   nothing selected   the schema's settings and the list of checks
//   one element        label, parameters, live values, connections
//   several elements   how many, and what can be done to all of them
//   a pipe             medium, size, label, its temperature sensor
//
// Fields write back on "change", so typing does not redraw the sheet on
// every key. The inspector is redrawn after each change; the field that had
// the focus gets it back.

import { candidates, checkEntity, readBinding } from "../core/bindings.js";
import { MEDIUM_IDS } from "../core/media.js";
import { problems } from "../core/model.js";
import { t, has, elementName, portName, bindingName } from "../core/i18n.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Settings of the whole schema, kept in doc.settings. */
const SETTINGS = [
  ["show_values", true],
  ["animate_flow", true],
  ["show_ports", false],
  ["allow_mixing", false],
];

export class Inspector {
  /**
   * @param {HTMLElement} container
   * @param {EditorState} state
   * @param {Commands} commands
   * @param {object} host  { hass(): hass, editable(): bool, focusNode(id) }
   */
  constructor(container, state, commands, host) {
    this.container = container;
    this.state = state;
    this.commands = commands;
    this.host = host;
    container.addEventListener("change", (e) => this._change(e));
    container.addEventListener("click", (e) => this._click(e));
  }

  render() {
    const focus = this._focusedKey();
    const { doc } = this.state;
    if (!doc) {
      this.container.innerHTML = "";
      return;
    }
    this._lists = new Map();
    let body;
    const nodes = this.state.selectedNodes();
    const pipe = this.state.selectedPipe();
    if (pipe) body = this._pipe(pipe);
    else if (nodes.length === 1) body = this._node(nodes[0]);
    else if (nodes.length > 1) body = this._many(nodes);
    else body = this._schema();
    const lists = [...this._lists.entries()]
      .map(([id, options]) => `<datalist id="${id}">${options}</datalist>`)
      .join("");
    this.container.innerHTML = body + lists;
    this.container.toggleAttribute("inert", !this.host.editable());
    if (focus) {
      const field = this.container.querySelector(`[data-key="${CSS.escape(focus)}"]`);
      if (field) field.focus({ preventScroll: true });
    }
  }

  /** Refresh the "now" readings without rebuilding the form. */
  updateLive() {
    const hass = this.host.hass();
    if (!hass) return;
    for (const el of this.container.querySelectorAll("[data-now]")) {
      const [entityId, kind] = el.dataset.now.split("|");
      el.textContent = t("inspector.current", { value: readBinding(kind, hass.states[entityId]).text });
    }
  }

  _focusedKey() {
    const active = this.container.getRootNode().activeElement;
    return active && this.container.contains(active) ? active.dataset.key : null;
  }

  // ---- views ----------------------------------------------------------------------

  _schema() {
    const { doc, defs } = this.state;
    const settings = SETTINGS.map(
      ([key, initial]) => `
      <label class="hs-check">
        <input type="checkbox" data-setting="${key}" data-key="setting.${key}" ${(doc.settings[key] ?? initial) ? "checked" : ""}>
        ${t(`inspector.${key}`)}
      </label>`
    ).join("");
    return `
      <h2>${t("inspector.schema")}</h2>
      <label class="hs-field"><span>${t("inspector.name")}</span>
        <input data-doc="name" data-key="doc.name" value="${esc(doc.name)}"></label>
      ${settings}
      ${this._problemList(problems(doc, defs, this._states()))}
      <p class="hs-help">${t("ui.help")}</p>`;
  }

  _problemList(list, withNames = true) {
    if (!list.length) return `<h3>${t("inspector.problems")}</h3><p class="hs-ok">${t("inspector.no_problems")}</p>`;
    const items = list
      .map((p) => {
        const node = p.node && this.state.doc.nodes.find((n) => n.id === p.node);
        const who = withNames && node ? `<b>${esc(node.label || elementName(node.type))}</b>: ` : "";
        const text = t(`problem.${p.code}`, {
          port: p.port ? portName(p.port) : "",
          binding: p.binding ? bindingName(p.binding) : "",
        });
        const target = p.node ? ` data-action="focus" data-node="${esc(p.node)}"` : p.pipe ? ` data-action="focus-pipe" data-pipe="${esc(p.pipe)}"` : "";
        return `<li class="hs-problem-${p.level}"${target}>${who}${esc(text)}</li>`;
      })
      .join("");
    return `<h3>${t("inspector.problems")}</h3><ul class="hs-problems">${items}</ul>`;
  }

  _node(node) {
    const def = this.state.defs.get(node.id);
    if (!def) return `<p>${esc(node.type)}</p>`;
    const name = elementName(node.type);
    const own = problems(this.state.doc, this.state.defs, this._states()).filter((p) => p.node === node.id);
    return `
      <h2>${esc(name)}</h2>
      ${this._actions()}
      <label class="hs-field"><span>${t("inspector.label")}</span>
        <input data-field="label" data-key="label" value="${esc(node.label)}" placeholder="${esc(name)}"></label>
      ${def.params.length ? `<h3>${t("inspector.parameters")}</h3>${def.params.map((p) => this._param(node, p)).join("")}` : ""}
      ${def.bindings.length ? `<h3>${t("inspector.live_values")}</h3>${def.bindings.map((b) => this._binding(node, b)).join("")}` : ""}
      ${def.ports.length ? this._connections(node, def) : ""}
      ${own.length ? this._problemList(own, false) : ""}`;
  }

  _param(node, param) {
    const value = node.params[param.key] ?? param.default;
    const key = `param.${param.key}`;
    const label = t(`param.${param.key}`);
    if (param.type === "bool") {
      return `<label class="hs-check"><input type="checkbox" data-param="${param.key}" data-kind="bool" data-key="${key}" ${value ? "checked" : ""}> ${label}</label>`;
    }
    if (param.type === "select") {
      const options = param.options
        .map((o) => `<option value="${esc(o)}" ${String(o) === String(value) ? "selected" : ""}>${esc(t(`option.${param.key}.${o}`))}</option>`)
        .join("");
      return `<label class="hs-field"><span>${label}</span><select data-param="${param.key}" data-kind="select" data-key="${key}">${options}</select></label>`;
    }
    if (param.type === "number") {
      const unit = param.unit ? `<em>${esc(param.unit)}</em>` : "";
      return `<label class="hs-field"><span>${label}</span><span class="hs-with-unit">
        <input type="number" data-param="${param.key}" data-kind="number" data-key="${key}" value="${esc(value)}"
          min="${param.min ?? ""}" max="${param.max ?? ""}" step="${param.step ?? 1}">${unit}</span></label>`;
    }
    return `<label class="hs-field"><span>${label}</span><input data-param="${param.key}" data-kind="text" data-key="${key}" value="${esc(value)}"></label>`;
  }

  _binding(node, binding) {
    const entityId = node.bindings[binding.key] || "";
    const states = this._states();
    const stateObj = entityId && states ? states[entityId] : null;
    const fit = entityId ? (stateObj ? checkEntity(binding.kind, stateObj) : "missing") : null;
    const mark = fit ? `<span class="hs-fit hs-fit-${fit}" title="${esc(fitText(fit, binding))}">${FIT_MARK[fit]}</span>` : "";
    const now = stateObj
      ? `<small data-now="${esc(entityId)}|${binding.kind}">${esc(t("inspector.current", { value: readBinding(binding.kind, stateObj).text }))}</small>`
      : "";
    const shown = !node.params[`hide_${binding.key}`] && (binding.show || node.params[`show_${binding.key}`]);
    const hint = has(`binding_hint.${binding.key}`) ? `<small>${esc(t(`binding_hint.${binding.key}`))}</small>` : "";
    return `
      <div class="hs-binding">
        <label class="hs-field"><span>${esc(bindingName(binding.key))} ${mark}</span>
          <input data-binding="${binding.key}" data-key="binding.${binding.key}" list="${this._list(binding.kind)}"
            value="${esc(entityId)}" placeholder="${esc(t("inspector.entity_placeholder"))}" autocomplete="off" spellcheck="false"></label>
        <small class="hs-kind">${esc(t("inspector.hint_kind", { kind: t(`kind.${binding.kind}`) }))}</small>
        ${hint}${now}
        ${entityId ? `<label class="hs-check hs-small-check"><input type="checkbox" data-show="${binding.key}" data-default="${binding.show ? 1 : 0}" data-key="show.${binding.key}" ${shown ? "checked" : ""}> ${t("inspector.on_drawing")}</label>` : ""}
      </div>`;
  }

  _connections(node, def) {
    const rows = def.ports
      .map((port) => {
        const pipe = this.state.doc.pipes.find(
          (p) => (p.from.node === node.id && p.from.port === port.id) || (p.to.node === node.id && p.to.port === port.id)
        );
        let other = t("inspector.port_free");
        if (pipe) {
          const end = pipe.from.node === node.id && pipe.from.port === port.id ? pipe.to : pipe.from;
          const peer = this.state.doc.nodes.find((n) => n.id === end.node);
          other = peer ? `${peer.label || elementName(peer.type)} · ${portName(end.port)}` : "?";
        }
        const family = port.family !== "any" ? ` <em>${esc(t(`family.${port.family}`))}</em>` : "";
        return `<li class="${pipe ? "" : "hs-free"}"><b>${esc(portName(port.id))}</b>${family}<br>${esc(other)}</li>`;
      })
      .join("");
    return `<h3>${t("inspector.ports")}</h3><ul class="hs-ports">${rows}</ul>`;
  }

  _many(nodes) {
    return `<h2>${t("inspector.selected_n", { n: nodes.length })}</h2>${this._actions()}`;
  }

  _pipe(pipe) {
    const { doc, defs } = this.state;
    const name = (end) => {
      const node = doc.nodes.find((n) => n.id === end.node);
      return node ? `${node.label || elementName(node.type)} · ${portName(end.port)}` : "?";
    };
    const media = MEDIUM_IDS.map(
      (id) => `<option value="${id}" ${id === pipe.medium ? "selected" : ""}>${esc(t(`medium.${id}`))}</option>`
    ).join("");
    const own = problems(doc, defs, this._states()).filter((p) => p.pipe === pipe.id);
    return `
      <h2>${t("inspector.pipe")}</h2>
      <p class="hs-route">${esc(t("inspector.from_to", { from: name(pipe.from), to: name(pipe.to) }))}</p>
      <div class="hs-actions">
        <button data-action="reset-route">${t("inspector.reset_route")}</button>
        <button data-action="delete" class="hs-danger">${t("ui.delete_selection")}</button>
      </div>
      <label class="hs-field"><span>${t("inspector.medium")}</span><select data-pipe-field="medium" data-key="pipe.medium">${media}</select></label>
      <label class="hs-field"><span>${t("inspector.dn")}</span>
        <input data-pipe-field="dn" data-key="pipe.dn" value="${esc(pipe.dn)}" placeholder="${esc(t("inspector.dn_placeholder"))}"></label>
      <label class="hs-field"><span>${t("inspector.pipe_label")}</span>
        <input data-pipe-field="label" data-key="pipe.label" value="${esc(pipe.label)}"></label>
      <label class="hs-field"><span>${t("inspector.pipe_temperature")}</span>
        <input data-pipe-binding="temperature" data-key="pipe.temperature" list="${this._list("temperature")}"
          value="${esc((pipe.bindings || {}).temperature || "")}" placeholder="${esc(t("inspector.entity_placeholder"))}" autocomplete="off"></label>
      ${own.length ? this._problemList(own, false) : ""}`;
  }

  _actions() {
    return `
      <div class="hs-actions">
        <button data-action="rotate" title="R">${t("ui.rotate")}</button>
        <button data-action="flip" title="M">${t("ui.flip")}</button>
        <button data-action="duplicate" title="Ctrl+D">${t("ui.duplicate_selection")}</button>
        <button data-action="delete" class="hs-danger" title="Del">${t("ui.delete_selection")}</button>
      </div>`;
  }

  // ---- entity lists ------------------------------------------------------------------

  _states() {
    const hass = this.host.hass();
    return hass ? hass.states : null;
  }

  /** The id of a datalist of entities that suit a kind, made once per render. */
  _list(kind) {
    const id = `hs-entities-${kind}`;
    if (!this._lists.has(id)) {
      const options = candidates(kind, this._states() || {})
        .slice(0, 400)
        .map((s) => `<option value="${esc(s.entity_id)}">${esc(s.attributes.friendly_name || "")}</option>`)
        .join("");
      this._lists.set(id, options);
    }
    return id;
  }

  // ---- edits ---------------------------------------------------------------------------

  _change(e) {
    const el = e.target;
    const d = el.dataset;
    const node = this.state.selectedNodes()[0];
    const pipe = this.state.selectedPipe();
    const value = el.type === "checkbox" ? el.checked : el.value;

    if (d.doc) return this.state.commit((doc) => (doc[d.doc] = String(value).trim() || doc[d.doc]));
    if (d.setting) return this.state.commit((doc) => (doc.settings[d.setting] = value));
    if (pipe && d.pipeField) return this._editPipe((p) => (p[d.pipeField] = value));
    if (pipe && d.pipeBinding) {
      return this._editPipe((p) => {
        p.bindings = { ...(p.bindings || {}) };
        if (value) p.bindings[d.pipeBinding] = String(value).trim();
        else delete p.bindings[d.pipeBinding];
      });
    }
    if (!node) return undefined;
    if (d.field) return this._editNode(node, (n) => (n[d.field] = value));
    if (d.param) {
      const coerced = d.kind === "number" ? (value === "" ? null : Number(value)) : value;
      return this._editNode(node, (n) => (n.params[d.param] = coerced));
    }
    if (d.binding) {
      return this._editNode(node, (n) => {
        if (value) n.bindings[d.binding] = String(value).trim();
        else delete n.bindings[d.binding];
      });
    }
    if (d.show) {
      // Stored only where it differs from the element's default.
      return this._editNode(node, (n) => {
        delete n.params[`hide_${d.show}`];
        delete n.params[`show_${d.show}`];
        if (d.default === "1" && !value) n.params[`hide_${d.show}`] = true;
        if (d.default === "0" && value) n.params[`show_${d.show}`] = true;
      });
    }
    return undefined;
  }

  _editNode(node, mutate) {
    this.state.commit((doc) => {
      const target = doc.nodes.find((n) => n.id === node.id);
      if (target) mutate(target);
    });
  }

  _editPipe(mutate) {
    const id = this.state.selection.pipe;
    this.state.commit((doc) => {
      const target = doc.pipes.find((p) => p.id === id);
      if (target) mutate(target);
    });
  }

  _click(e) {
    const button = e.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "rotate") this.commands.rotate();
    else if (action === "flip") this.commands.flip();
    else if (action === "duplicate") this.commands.duplicate();
    else if (action === "delete") this.commands.remove();
    else if (action === "reset-route") this.commands.resetRoute(this.state.selection.pipe);
    else if (action === "focus") this.host.focusNode(button.dataset.node);
    else if (action === "focus-pipe") this.state.select([], button.dataset.pipe);
  }
}

const FIT_MARK = { ok: "✓", warning: "!", error: "✕", missing: "?" };

function fitText(fit, binding) {
  if (fit === "missing") return t("problem.entity_missing", { binding: bindingName(binding.key) });
  if (fit === "error") return t("problem.entity_wrong_kind", { binding: bindingName(binding.key) });
  if (fit === "warning") return t("problem.entity_odd_unit", { binding: bindingName(binding.key) });
  return t(`kind.${binding.kind}`);
}

