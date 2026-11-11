// The editor's own look: the sheet, selection, handles, problem marks.
// The drawing's look is core/styles.js.

import { SCHEMA_CSS } from "../core/styles.js";

export const CANVAS_CSS = `
  ${SCHEMA_CSS}
  .hs-canvas { width: 100%; height: 100%; display: block; touch-action: none; outline: none; user-select: none; -webkit-user-select: none; cursor: default; }
  .hs-canvas.hs-panning { cursor: grabbing; }
  .hs-grid-dot { fill: color-mix(in srgb, var(--primary-text-color, #fff) 18%, transparent); }
  .hs-node { cursor: pointer; }
  .hs-editing .hs-node { cursor: move; }
  .hs-port { cursor: crosshair; }
  .hs-port:hover { stroke-width: 4; r: 8; }
  .hs-pipe-group { cursor: pointer; }
  .hs-selection { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 1.5; stroke-dasharray: 5 4; pointer-events: none; }
  .hs-pipe-selected { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 11; stroke-opacity: 0.35; stroke-linejoin: round; pointer-events: none; }
  .hs-leg { fill: var(--primary-color, #03a9f4); stroke: var(--card-background-color, #fff); stroke-width: 1.5; }
  .hs-leg-h { cursor: ns-resize; }
  .hs-leg-v { cursor: ew-resize; }
  .hs-band { fill: color-mix(in srgb, var(--primary-color, #03a9f4) 12%, transparent); stroke: var(--primary-color, #03a9f4); stroke-width: 1; pointer-events: none; }
  .hs-temp-pipe { fill: none; stroke: var(--hs-medium, #9e9e9e); stroke-width: 5; stroke-dasharray: 8 6; stroke-linejoin: round; opacity: 0.8; pointer-events: none; }
  .hs-temp-ok { stroke-dasharray: none; }
  .hs-temp-warn { stroke: var(--warning-color, #ffa000); }
  .hs-temp-bad { stroke: var(--error-color, #e53935); }
  .hs-branch-target { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 12; stroke-opacity: 0.45; stroke-linecap: round; pointer-events: none; }
  .hs-problem { pointer-events: none; }
  .hs-problem circle { stroke: var(--card-background-color, #fff); stroke-width: 1.5; }
  .hs-problem-error circle { fill: var(--error-color, #e53935); }
  .hs-problem-warning circle { fill: var(--warning-color, #ffa000); }
  .hs-problem text { fill: #fff; font-size: 11px; font-weight: 700; }
`;

/** The panel around the sheet: bar, palette, inspector. */
export const PANEL_CSS = `
  :host { display: block; height: 100%; background: var(--primary-background-color); color: var(--primary-text-color); }
  * { box-sizing: border-box; }
  button, select, input { font: inherit; color: inherit; }
  .hs-app { display: flex; flex-direction: column; height: 100%; }
  .hs-bar {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    min-height: var(--header-height, 56px); padding: 4px 8px;
    background: var(--app-header-background-color, var(--primary-color));
    color: var(--app-header-text-color, #fff);
  }
  .hs-bar h1 { font-size: 20px; font-weight: 400; margin: 0 8px 0 0; white-space: nowrap; }
  .hs-bar select, .hs-bar button {
    background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px; padding: 6px 10px; color: inherit; cursor: pointer; min-height: 36px;
  }
  .hs-bar select option { color: var(--primary-text-color); background: var(--card-background-color); }
  .hs-bar button:disabled { opacity: 0.4; cursor: default; }
  .hs-bar .hs-primary { background: #fff; color: var(--primary-color); border-color: #fff; font-weight: 500; }
  .hs-bar .hs-dirty::after { content: " •"; }
  .hs-bar .hs-on { background: rgba(255, 255, 255, 0.35); }
  .hs-group { display: flex; gap: 4px; align-items: center; }
  .hs-spacer { flex: 1; }
  .hs-icon-btn { min-width: 36px; padding: 6px !important; display: inline-flex; align-items: center; justify-content: center; }
  .hs-icon-btn ha-icon { --mdc-icon-size: 20px; }

  .hs-main { flex: 1; display: flex; min-height: 0; position: relative; }
  .hs-palette, .hs-inspector {
    width: 260px; flex: none; overflow-y: auto; padding: 10px;
    background: var(--card-background-color, #fff); border-color: var(--divider-color);
  }
  .hs-palette { border-right: 1px solid var(--divider-color); }
  .hs-inspector { width: 300px; border-left: 1px solid var(--divider-color); }
  .hs-stage { flex: 1; position: relative; min-width: 0; background: var(--card-background-color, #fff); }
  .hs-viewing .hs-palette, .hs-viewing .hs-inspector { display: none; }

  .hs-search { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--primary-background-color); }
  .hs-palette h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--secondary-text-color); margin: 14px 0 6px; font-weight: 500; }
  .hs-palette-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .hs-palette-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px;
    border: 1px solid transparent; border-radius: 8px; background: none; cursor: grab; font-size: 11px; line-height: 1.2; text-align: center;
  }
  .hs-palette-item:hover { border-color: var(--divider-color); background: var(--secondary-background-color); }
  .hs-palette-item span { overflow-wrap: anywhere; }
  .hs-icon-svg { pointer-events: none; }

  .hs-inspector h2 { font-size: 18px; font-weight: 500; margin: 2px 0 10px; }
  .hs-inspector h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--secondary-text-color); margin: 18px 0 6px; font-weight: 500; }
  .hs-field { display: flex; flex-direction: column; gap: 3px; margin: 8px 0; font-size: 13px; }
  .hs-field > span:first-child { color: var(--secondary-text-color); }
  .hs-field input, .hs-field select {
    width: 100%; padding: 7px 9px; border-radius: 6px; border: 1px solid var(--divider-color);
    background: var(--primary-background-color);
  }
  .hs-with-unit { display: flex; align-items: center; gap: 6px; }
  .hs-with-unit em { font-style: normal; color: var(--secondary-text-color); min-width: 28px; }
  .hs-check { display: flex; align-items: center; gap: 8px; margin: 8px 0; font-size: 13px; }
  .hs-small-check { margin-top: 2px; font-size: 12px; color: var(--secondary-text-color); }
  .hs-binding { padding: 6px 0 8px; border-bottom: 1px solid var(--divider-color); }
  .hs-binding small { display: block; font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
  .hs-binding .hs-field { margin-bottom: 2px; }
  .hs-fit { display: inline-block; min-width: 16px; text-align: center; border-radius: 8px; font-size: 11px; font-weight: 700; color: #fff; margin-left: 4px; }
  .hs-fit-ok { background: var(--success-color, #43a047); }
  .hs-fit-warning, .hs-fit-missing { background: var(--warning-color, #ffa000); }
  .hs-fit-error { background: var(--error-color, #e53935); }
  .hs-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
  .hs-actions button { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--secondary-background-color); cursor: pointer; font-size: 13px; }
  .hs-danger { color: var(--error-color, #e53935) !important; }
  .hs-ports, .hs-problems { list-style: none; padding: 0; margin: 0; font-size: 13px; }
  .hs-ports li { padding: 5px 0; border-bottom: 1px solid var(--divider-color); }
  .hs-ports em { font-style: normal; font-size: 11px; color: var(--secondary-text-color); }
  .hs-ports .hs-free { color: var(--secondary-text-color); }
  .hs-problems li { padding: 6px 8px; margin: 4px 0; border-radius: 6px; border-left: 3px solid; background: var(--secondary-background-color); }
  .hs-problems li[data-action] { cursor: pointer; }
  .hs-problems .hs-problem-error { border-color: var(--error-color, #e53935); }
  .hs-problems .hs-problem-warning { border-color: var(--warning-color, #ffa000); }
  .hs-ok { color: var(--success-color, #43a047); font-size: 13px; }
  .hs-help, .hs-route { font-size: 12px; color: var(--secondary-text-color); line-height: 1.5; }

  .hs-toast {
    position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); max-width: min(90%, 520px);
    padding: 10px 16px; border-radius: 8px; background: var(--primary-text-color); color: var(--card-background-color);
    font-size: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3); opacity: 0; pointer-events: none; transition: opacity 0.2s;
  }
  .hs-toast.hs-show { opacity: 1; }
  .hs-toast.hs-error { background: var(--error-color, #e53935); color: #fff; }
  .hs-toast.hs-warning { background: var(--warning-color, #ffa000); color: #000; }
  .hs-empty { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; color: var(--secondary-text-color); }
  .hs-empty button { padding: 10px 18px; border-radius: 8px; border: none; background: var(--primary-color); color: #fff; cursor: pointer; }
  .hs-drawer-toggle { display: none !important; }

  @media (max-width: 900px) {
    .hs-drawer-toggle { display: inline-flex !important; }
    .hs-palette, .hs-inspector { position: absolute; top: 0; bottom: 0; z-index: 2; box-shadow: 0 0 24px rgba(0, 0, 0, 0.3); display: none; }
    .hs-palette { left: 0; }
    .hs-inspector { right: 0; width: min(320px, 90vw); }
    .hs-show-palette .hs-palette, .hs-show-inspector .hs-inspector { display: block; }
    .hs-viewing .hs-palette, .hs-viewing .hs-inspector { display: none !important; }
    .hs-bar h1 { display: none; }
  }
`;
