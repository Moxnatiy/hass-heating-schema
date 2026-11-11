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
`;
