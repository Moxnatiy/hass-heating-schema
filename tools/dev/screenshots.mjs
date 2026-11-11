// Takes the README's screenshots from the dev bench, in headless Chrome.
//
//   node tools/dev/screenshots.mjs            # writes docs/images/*.png
//
// It serves the project itself, on a port of its own. CHROME may point to
// another Chrome or Chromium binary. The bench's fake Home Assistant toggles
// hot water mode every few seconds; each scene sets the states it needs
// itself, so the pictures do not depend on timing.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "docs", "images");
const HTTP_PORT = 8766;
const BENCH = `http://127.0.0.1:${HTTP_PORT}/tools/dev/index.html`;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };

/** The project's files over HTTP, for the bench's modules. */
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    try {
      const body = readFileSync(join(ROOT, path));
      res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(HTTP_PORT, "127.0.0.1", () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The dev demo in English, bound to the bench's own entities. */
function showcase() {
  const doc = JSON.parse(readFileSync(join(ROOT, "tools/dev/demo-schema.json"), "utf8"));
  const labels = { hp: "Heat pump", pump: "Floor pump", ufh1: "Kitchen", ufh2: "Living room", outdoor: "Outside" };
  const entities = {
    "input_boolean.demo_compressor": "binary_sensor.compressor",
    "input_boolean.demo_dhw_mode": "binary_sensor.dhw_mode",
    "input_boolean.demo_heating_pump": "switch.pump",
    "sensor.demo_supply_temperature": "sensor.flow",
    "sensor.demo_return_temperature": "sensor.ret",
    "sensor.demo_outdoor_temperature": "sensor.out",
    "sensor.demo_tank_top": "sensor.tank_top",
  };
  doc.id = "showcase";
  doc.name = "Boiler room";
  doc.updated = "2026-01-01T00:00:00";
  doc.nodes = doc.nodes.filter((n) => n.id !== "pressure");
  for (const node of doc.nodes) {
    if (labels[node.id]) node.label = labels[node.id];
    else delete node.label;
    node.bindings = Object.fromEntries(
      Object.entries(node.bindings || {})
        .filter(([, id]) => entities[id])
        .map(([key, id]) => [key, entities[id]])
    );
  }
  return doc;
}

// ---- a minimal DevTools protocol client -----------------------------------------------

async function connect() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = pages.find((p) => p.type === "page");
      if (page) return client(page.webSocketDebuggerUrl);
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

function client(url) {
  const ws = new WebSocket(url);
  let next = 0;
  const waiting = new Map();
  const events = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && waiting.has(data.id)) {
      const { resolve, reject } = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    } else if (data.method) {
      if (data.method === "Runtime.exceptionThrown") console.error("page:", data.params.exceptionDetails.exception?.description);
      // The panel asks before leaving unsaved changes; the scenes never save.
      if (data.method === "Page.javascriptDialogOpening") {
        next += 1;
        ws.send(JSON.stringify({ id: next, method: "Page.handleJavaScriptDialog", params: { accept: true } }));
      }
      for (const fn of events) fn(data);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      next += 1;
      waiting.set(next, { resolve, reject });
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  const opened = new Promise((resolve) => (ws.onopen = resolve));
  return opened.then(() => ({
    send,
    close: () => ws.close(),
    once: (method) => new Promise((resolve) => events.push((e) => e.method === method && resolve(e.params))),
  }));
}

// ---- scenes ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "hs-shots-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);
  const server = await serve();
  const cdp = await connect();
  try {
    await scenes(cdp);
  } finally {
    server.close();
    cdp.close();
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function scenes(cdp) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const run = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || expression);
    return result.result.value;
  };
  const size = (width, height) =>
    cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
  const open = async (query = "") => {
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: `${BENCH}?${query}` });
    await loaded;
    for (let i = 0; i < 50 && !(await run("Boolean(window.bench && bench.panel.state.doc)")); i += 1) await sleep(100);
    if (!(await run("Boolean(window.bench)"))) throw new Error(`the bench did not start: ${await run("JSON.stringify([location.href, document.readyState, Boolean(customElements.get(\"heating-schema-panel\")), document.body && document.body.innerHTML.slice(0, 200)])")}`);
    await sleep(500);
  };
  const shot = async (name, clip) => {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    });
    writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
    console.log("wrote", name);
  };
  const mouse = (type, x, y) => cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });

  // Freeze the fake states: hot water mode or heating mode, never switching midway.
  const freeze = (dhw) => `(() => {
    const p = bench.panel;
    const base = p.hass;
    const s = structuredClone(base.states);
    s["binary_sensor.dhw_mode"].state = ${dhw ? '"on"' : '"off"'};
    s["switch.pump"].state = ${dhw ? '"off"' : '"on"'};
    s["sensor.flow"].state = "${dhw ? "55.2" : "41.8"}";
    s["sensor.tank_top"].state = "${dhw ? "49.6" : "51.3"}";
    const frozen = { ...base, states: s };
    for (let i = 1; i < 10000; i += 1) clearInterval(i);
    p.hass = frozen;
  })()`;

  // The bench keeps its schemas in localStorage: put the showcase there.
  await open();
  await run(`localStorage.clear(); localStorage.setItem("heating-schema-bench", ${JSON.stringify(JSON.stringify({ showcase: showcase() }))}); localStorage.setItem("heating-schema-open", "showcase")`);

  // 1. The schema live, heating mode, dark.
  await size(1280, 760);
  await open("lang=en");
  await run(freeze(false));
  await run("bench.panel.canvas.fit()");
  await sleep(700);
  await shot("overview.png");

  // 2. Hot water mode, light theme.
  await open("lang=en&light=1");
  await run(freeze(true));
  await run("bench.panel.canvas.fit()");
  await sleep(700);
  await shot("hot-water-light.png");

  // 3. The editor: palette, the tank selected, its settings in the inspector.
  await size(1440, 860);
  await open("lang=en");
  await run(freeze(false));
  await run(`bench.panel._setMode("edit"); bench.panel.canvas.fit(); bench.panel.state.select(["tank"]);`);
  await sleep(500);
  await shot("editor.png");

  // 4. Live values: the heat pump's bindings, with matching entities offered.
  await run(`bench.panel.state.select(["hp"]);`);
  await sleep(400);
  await run(`(() => {
    const ins = bench.panel.shadowRoot.querySelector(".hs-inspector");
    const field = ins.querySelector('[data-binding="running"]');
    if (field) field.closest(".hs-binding").scrollIntoView({ block: "start" });
  })()`);
  await sleep(300);
  await shot("bindings.png");

  // 5. Drawing a pipe: a new radiator, a pipe dragged from it, caught mid-way.
  await run(`bench.panel.state.clearSelection(); bench.panel.canvas.fit();`);
  await run(`bench.panel.state.commit((d) => {
    d.nodes.push({ id: "rad", type: "radiator", x: 0, y: 480, rotation: 0, flip: false, label: "Bathroom", params: { connection: "bottom" }, bindings: {} });
  })`);
  await sleep(400);
  const centre = (id) =>
    run(`(() => {
      const r = bench.panel.shadowRoot.querySelector('[data-port="${id}"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
  const from = await centre("rad:in");
  const to = { x: from.x + 200, y: from.y + 60 };
  await mouse("mouseMoved", from.x, from.y);
  await mouse("mousePressed", from.x, from.y);
  for (let i = 1; i <= 10; i += 1) {
    await mouse("mouseMoved", from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    await sleep(30);
  }
  await sleep(300);
  await shot("draw-pipe.png");
  await mouse("mouseReleased", to.x, to.y);

  // 6. Checks: without the expansion vessel and the safety valve.
  await open("lang=en");
  await run(freeze(false));
  await run(`bench.panel._setMode("edit"); bench.panel.canvas.fit();`);
  await run(`bench.panel.state.commit((d) => {
    const gone = new Set(["ev", "sv", "drain"]);
    d.nodes = d.nodes.filter((n) => !gone.has(n.id));
    d.pipes = d.pipes.filter((p) => !gone.has(p.from.node) && !gone.has(p.to.node));
  }); bench.panel.state.clearSelection();`);
  await sleep(500);
  await shot("checks.png");

  // 7. The dashboard card, light theme, as on a phone-wide column.
  await size(560, 440);
  await open("lang=en&light=1");
  await run(freeze(false));
  await run(`(async () => {
    await import("/custom_components/heating_schema/frontend/heating-schema-card.js");
    document.body.innerHTML = '<div style="padding:16px;background:var(--primary-background-color);min-height:100vh;box-sizing:border-box"><heating-schema-card></heating-schema-card></div>';
    const style = document.createElement("style");
    style.textContent = "heating-schema-card{display:block;background:var(--card-background-color);border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.12);overflow:hidden}";
    document.head.append(style);
    const card = document.querySelector("heating-schema-card");
    card.setConfig({ type: "custom:heating-schema-card", schema_id: "showcase" });
    card.hass = bench.panel.hass;
  })()`);
  await sleep(1000);
  await shot("card.png");

  // 8. The element library.
  await size(1280, 900);
  await open("lang=en&light=1");
  const height = await run(`(async () => {
    const base = "/custom_components/heating_schema/frontend/";
    const { ELEMENTS, ELEMENT_TYPES, CATEGORIES, resolve } = await import(base + "elements/index.js");
    const LIBRARY = ELEMENT_TYPES.map((type) => ELEMENTS[type]);
    const { SCHEMA_CSS } = await import(base + "core/styles.js");
    const { t, elementName } = await import(base + "core/i18n.js");
    const live = { values: {}, on: null, alarm: false, flowing: false };
    const CELL = 150, COLS = 8, BOX = 96;
    let y = 0, body = "";
    for (const category of CATEGORIES) {
      const types = LIBRARY.filter((d) => d.category === category);
      if (!types.length) continue;
      body += '<text x="8" y="' + (y + 22) + '" text-anchor="start" class="hs-cat">' + t("category." + category).toUpperCase() + "</text>";
      y += 36;
      types.forEach((d0, i) => {
        const def = resolve({ id: "e" + y + i, type: d0.type, x: 0, y: 0, params: {} });
        const texts = [];
        const ctx = { uid: "lib" + y + i, connected: new Set(def.ports.map((p) => p.id)), text: (x, yy, s, cls) => texts.push('<text x="' + x + '" y="' + yy + '" text-anchor="middle" class="' + cls + '">' + s + "</text>") };
        const svg = def.draw(def.node, live, ctx, def) + texts.join("");
        const k = Math.min(1, BOX / Math.max(def.w, def.h));
        const cx = (i % COLS) * CELL + CELL / 2, cy = y + Math.floor(i / COLS) * (CELL + 10) + 60;
        body += '<g transform="translate(' + (cx - (def.w * k) / 2) + " " + (cy - (def.h * k) / 2) + ") scale(" + k + ')">' + svg + "</g>";
        body += '<text x="' + cx + '" y="' + (cy + 70) + '" text-anchor="middle" class="hs-name">' + elementName(d0.type) + "</text>";
      });
      y += Math.ceil(types.length / COLS) * (CELL + 10) + 10;
    }
    document.body.innerHTML = "";
    const host = document.createElement("div");
    host.style.cssText = "background:var(--card-background-color);padding:16px";
    host.attachShadow({ mode: "open" }).innerHTML =
      "<style>" + SCHEMA_CSS + ".hs-cat{font:600 13px Roboto,system-ui,sans-serif;fill:var(--secondary-text-color);letter-spacing:.06em}.hs-name{font:13px Roboto,system-ui,sans-serif;fill:var(--primary-text-color)}</style>" +
      '<svg class="hs-sheet" width="' + CELL * COLS + '" height="' + y + '" viewBox="0 0 ' + CELL * COLS + " " + y + '">' + body + "</svg>";
    document.body.append(host);
    return y + 32;
  })()`);
  await size(1232, Math.ceil(height));
  await sleep(500);
  await shot("elements.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
