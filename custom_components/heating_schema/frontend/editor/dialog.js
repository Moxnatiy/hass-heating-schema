// Small dialogs inside the panel: a question with a text field, or a
// confirmation.
//
// window.prompt and window.confirm are not available everywhere Home
// Assistant runs: the companion apps' web views and embedded browsers refuse
// them. These live in the panel's own shadow root instead.

import { t } from "../core/i18n.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function open(root, body, focusSelector) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "hs-dialog";
    dialog.innerHTML = `<form method="dialog">${body}
      <div class="hs-dialog-buttons">
        <button value="cancel" type="submit" formnovalidate>${t("ui.cancel")}</button>
        <button value="ok" type="submit" class="hs-dialog-ok">${t("ui.ok")}</button>
      </div></form>`;
    root.append(dialog);
    dialog.addEventListener("close", () => {
      const input = dialog.querySelector("input");
      const ok = dialog.returnValue === "ok";
      dialog.remove();
      resolve(ok ? (input ? input.value : true) : null);
    });
    dialog.showModal();
    const focus = dialog.querySelector(focusSelector);
    if (focus) {
      focus.focus();
      if (focus.select) focus.select();
    }
  });
}

/** Ask for a text; resolves to the text, or null when cancelled. */
export async function askText(root, question, value = "") {
  const answer = await open(
    root,
    `<label class="hs-dialog-label">${esc(question)}<input name="value" value="${esc(value)}" required autocomplete="off"></label>`,
    "input"
  );
  return typeof answer === "string" && answer.trim() ? answer.trim() : null;
}

/** Ask to confirm; resolves to true or false. */
export async function confirmDialog(root, question) {
  return (await open(root, `<p class="hs-dialog-text">${esc(question)}</p>`, ".hs-dialog-ok")) === true;
}

const SHOWN = 200;

/** The words an entity is found by, and what is shown of it. */
function describe(hass, stateObj) {
  const id = stateObj.entity_id;
  const entry = (hass.entities && hass.entities[id]) || {};
  const device = entry.device_id && hass.devices ? hass.devices[entry.device_id] : null;
  const areaId = entry.area_id || (device && device.area_id);
  const area = areaId && hass.areas ? hass.areas[areaId] : null;
  const name = stateObj.attributes.friendly_name || id;
  const deviceName = device ? device.name_by_user || device.name || "" : "";
  const where = [deviceName, area ? area.name : ""].filter(Boolean).join(" · ");
  return { id, name, where, haystack: `${name} ${id} ${where}`.toLowerCase() };
}

/**
 * Pick an entity in a large dialog in the middle of the screen, like Home
 * Assistant's quick search: names are not cut short as in a field's list.
 *
 * options: { title, hass, value, list(all) → [stateObj] best first,
 *            fit(stateObj) → "ok" | "warning" | "error", now(stateObj) → text }
 * Resolves to an entity id, "" to unbind, or null when cancelled.
 */
export function pickEntity(root, options) {
  const { hass, value = "" } = options;
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "hs-dialog hs-pick";
    dialog.innerHTML = `
      <div class="hs-pick-head">
        <h2>${esc(options.title)}</h2>
        <input class="hs-pick-search" type="search" placeholder="${esc(t("picker.search"))}" autocomplete="off" spellcheck="false">
        <label class="hs-check"><input type="checkbox" class="hs-pick-fitting" checked> ${esc(t("picker.fitting_only"))}</label>
      </div>
      <ul class="hs-pick-list" role="listbox"></ul>
      <div class="hs-dialog-buttons">
        ${value ? `<button type="button" data-pick-clear class="hs-pick-clear">${esc(t("picker.clear"))}</button>` : ""}
        <span class="hs-pick-gap"></span>
        <button type="button" data-pick-cancel>${esc(t("ui.cancel"))}</button>
      </div>`;
    root.append(dialog);
    const search = dialog.querySelector(".hs-pick-search");
    const fitting = dialog.querySelector(".hs-pick-fitting");
    const list = dialog.querySelector(".hs-pick-list");
    let rows = [];
    let active = 0;
    let result = null;
    let seek = value;

    const done = (answer) => {
      result = answer;
      dialog.close();
    };
    const all = (options.list(false) || []).map((s) => ({ s, d: describe(hass, s) }));
    const icons = Boolean(customElements.get("ha-state-icon"));

    function draw() {
      const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const source = fitting.checked ? all.filter((r) => options.fit(r.s) === "ok" || r.d.id === value) : everything();
      rows = source.filter((r) => words.every((w) => r.d.haystack.includes(w)));
      if (seek) {
        // Open on the bound entity, so it is seen at once.
        active = Math.max(0, rows.findIndex((r) => r.d.id === seek));
        seek = null;
      }
      const typed = search.value.trim();
      const custom = /^[a-z_]+\.[a-z0-9_]+$/.test(typed) && !rows.some((r) => r.d.id === typed);
      active = Math.min(active, Math.max(0, rows.length - 1 + (custom ? 1 : 0)));
      let html = rows
        .slice(0, SHOWN)
        .map((r, i) => {
          const fit = options.fit(r.s);
          const mark = fit === "ok" ? "" : `<span class="hs-fit hs-fit-${fit}">!</span>`;
          return `<li role="option" data-i="${i}" class="${i === active ? "hs-active" : ""}${r.d.id === value ? " hs-current" : ""}">
            ${icons ? `<ha-state-icon data-i="${i}"></ha-state-icon>` : ""}
            <span class="hs-pick-main"><b>${esc(r.d.name)}${mark}</b><small>${esc([r.d.name !== r.d.id ? r.d.id : "", r.d.where].filter(Boolean).join(" · "))}</small></span>
            <span class="hs-pick-now">${esc(options.now(r.s))}</span></li>`;
        })
        .join("");
      if (rows.length > SHOWN) html += `<li class="hs-pick-note">${esc(t("picker.more", { n: rows.length - SHOWN }))}</li>`;
      if (custom) {
        html += `<li role="option" data-custom="${esc(typed)}" class="${active === rows.length ? "hs-active" : ""}">
          <span class="hs-pick-main"><b>${esc(t("picker.use", { id: typed }))}</b></span></li>`;
      }
      if (!rows.length && !custom) html = `<li class="hs-pick-note">${esc(t("picker.nothing"))}</li>`;
      list.innerHTML = html;
      if (icons) {
        for (const el of list.querySelectorAll("ha-state-icon")) {
          el.hass = hass;
          el.stateObj = rows[Number(el.dataset.i)].s;
        }
      }
      const current = list.querySelector(".hs-active");
      if (current) current.scrollIntoView({ block: "nearest" });
    }

    let wide = null;
    function everything() {
      if (!wide) wide = (options.list(true) || []).map((s) => ({ s, d: describe(hass, s) }));
      return wide;
    }

    function choose(li) {
      if (!li) return;
      if (li.dataset.custom) done(li.dataset.custom);
      else if (li.dataset.i !== undefined) done(rows[Number(li.dataset.i)].d.id);
    }

    search.addEventListener("input", () => {
      active = 0;
      draw();
    });
    fitting.addEventListener("change", () => {
      active = 0;
      draw();
      search.focus();
    });
    search.addEventListener("keydown", (e) => {
      const count = list.querySelectorAll("[role=option]").length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + count) % Math.max(count, 1);
        draw();
      } else if (e.key === "Enter") {
        e.preventDefault();
        choose(list.querySelector(".hs-active"));
      }
    });
    list.addEventListener("click", (e) => choose(e.target.closest("[role=option]")));
    dialog.addEventListener("click", (e) => {
      if (e.target.closest("[data-pick-clear]")) return done("");
      if (e.target.closest("[data-pick-cancel]")) return done(null);
      // A click on the dimmed backdrop around the dialog closes it.
      const box = dialog.getBoundingClientRect();
      const outside = e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
      if (e.target === dialog && outside) done(null);
      return undefined;
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    });

    draw();
    dialog.showModal();
    const bound = list.querySelector(".hs-active");
    if (bound) bound.scrollIntoView({ block: "center" });
    search.focus();
  });
}

export const DIALOG_CSS = `
  .hs-dialog {
    border: none; border-radius: 12px; padding: 20px; min-width: min(360px, 90vw); max-width: 90vw;
    background: var(--card-background-color, #fff); color: var(--primary-text-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  .hs-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
  .hs-dialog-label { display: flex; flex-direction: column; gap: 8px; font-size: 15px; }
  .hs-dialog-label input {
    padding: 9px 11px; border-radius: 8px; border: 1px solid var(--divider-color);
    background: var(--primary-background-color); color: inherit; font: inherit;
  }
  .hs-dialog-text { margin: 0; font-size: 15px; line-height: 1.5; }
  .hs-dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
  .hs-dialog-buttons button {
    padding: 8px 16px; border-radius: 8px; border: 1px solid var(--divider-color);
    background: none; color: inherit; font: inherit; cursor: pointer;
  }
  .hs-dialog-buttons .hs-dialog-ok { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }

  /* The entity picker: wide and tall, in the middle of the screen. */
  .hs-pick { width: min(960px, calc(100vw - 32px)); max-width: none; height: min(780px, calc(100vh - 64px)); padding: 0; box-sizing: border-box; }
  .hs-pick[open] { display: flex; flex-direction: column; }
  .hs-pick-head { padding: 18px 20px 10px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--divider-color); }
  .hs-pick-head h2 { margin: 0; font-size: 18px; font-weight: 500; }
  .hs-pick-search {
    padding: 11px 14px; border-radius: 10px; border: 1px solid var(--divider-color); font: inherit; font-size: 16px;
    background: var(--primary-background-color); color: inherit; outline: none;
  }
  .hs-pick-search:focus { border-color: var(--primary-color); }
  .hs-pick-list { list-style: none; margin: 0; padding: 6px 8px; overflow-y: auto; flex: 1; }
  .hs-pick-list li[role="option"] {
    display: flex; align-items: center; gap: 14px; padding: 9px 12px; border-radius: 8px; cursor: pointer;
  }
  .hs-pick-list li[role="option"]:hover { background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); }
  .hs-pick-list li.hs-active { background: color-mix(in srgb, var(--primary-color) 22%, transparent); }
  .hs-pick-list li.hs-current b { color: var(--primary-color); }
  .hs-pick-list ha-state-icon { color: var(--state-icon-color, var(--secondary-text-color)); flex: none; }
  .hs-pick-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .hs-pick-main b { font-weight: 500; font-size: 15px; overflow-wrap: anywhere; }
  .hs-pick-main small { color: var(--secondary-text-color); font-size: 12.5px; overflow-wrap: anywhere; }
  .hs-pick-now { color: var(--secondary-text-color); font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .hs-pick-note { padding: 14px 12px; color: var(--secondary-text-color); }
  .hs-pick .hs-dialog-buttons { margin: 0; padding: 12px 20px; border-top: 1px solid var(--divider-color); }
  .hs-pick-gap { flex: 1; }
  .hs-pick .hs-pick-clear { color: var(--error-color, #e53935); }
  .hs-pick .hs-fit { margin-left: 6px; }
`;
