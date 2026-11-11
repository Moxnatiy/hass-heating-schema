// Keyboard shortcuts of the editor.
//
//   Delete, Backspace     delete the selection
//   R / Shift+R           rotate clockwise / anticlockwise
//   M / Shift+M           mirror left to right / top to bottom
//   + / −                 larger / smaller
//   arrows                move by one grid step; with Shift, by five
//   Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y    undo, redo
//   Ctrl+C, Ctrl+V, Ctrl+D          copy, paste, duplicate
//   Ctrl+A                select everything
//   Ctrl+S                save
//   Escape                cancel a drag, then clear the selection
// Ctrl is Cmd on a Mac. Keys typed into a field are left to the field.

import { GRID } from "../core/geometry.js";

/**
 * Handle a keydown; returns true when it was a shortcut.
 * host: { editable(), save(), state, commands, canvas }
 */
export function handleKey(e, host) {
  const target = e.composedPath ? e.composedPath()[0] : e.target;
  if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return false;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && key === "s") {
    host.save();
    return true;
  }
  if (!host.editable()) return false;
  const { state, commands, canvas } = host;

  if (mod) {
    if (key === "z" && !e.shiftKey) state.undo();
    else if ((key === "z" && e.shiftKey) || key === "y") state.redo();
    else if (key === "c") commands.copy();
    else if (key === "v") commands.paste();
    else if (key === "d") commands.duplicate();
    else if (key === "a") state.select(state.doc.nodes.map((n) => n.id));
    else return false;
    return true;
  }

  const step = e.shiftKey ? 5 * GRID : GRID;
  switch (e.key) {
    case "Delete":
    case "Backspace":
      commands.remove();
      return true;
    case "Escape":
      if (!canvas.abort()) state.clearSelection();
      return true;
    case "ArrowLeft":
      commands.nudge(-step, 0);
      return true;
    case "ArrowRight":
      commands.nudge(step, 0);
      return true;
    case "ArrowUp":
      commands.nudge(0, -step);
      return true;
    case "ArrowDown":
      commands.nudge(0, step);
      return true;
    default:
  }
  if (key === "r") {
    commands.rotate(e.shiftKey ? -90 : 90);
    return true;
  }
  if (key === "m") {
    commands.flip(e.shiftKey ? "y" : "x");
    return true;
  }
  if (e.key === "+" || e.key === "=") {
    commands.scale("up");
    return true;
  }
  if (e.key === "-" || e.key === "_") {
    commands.scale("down");
    return true;
  }
  return false;
}
