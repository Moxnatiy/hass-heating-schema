# Architecture

Heating Schema has a small backend and a frontend without a build step: the
browser loads the ES modules as they are in the repository.

```
custom_components/heating_schema/
  __init__.py        sets up storage, the panel, the card, the WebSocket API
  store.py           schemas in .storage; validates their shape and size
  websocket.py       list / get / subscribe for everyone, save / delete for admins
  frontend/
    core/            the model and the logic, no DOM except render.js
    elements/        the element library, one module per element
    translations/    en.js, uk.js
    editor/          the panel's editor: sheet, gestures, palette, inspector
    heating-schema-panel.js   the sidebar panel
    heating-schema-card.js    the dashboard card
```

## core/

| Module | What it holds |
| --- | --- |
| `geometry.js` | the grid, rotation and mirroring, boxes |
| `media.js` | what a pipe carries, its colour, which circuits may be joined |
| `bindings.js` | binding kinds: which entities fit, how a state is read |
| `model.js` | the document, ports in drawing coordinates, `canConnect`, `problems` |
| `edits.js` | changes to a document as plain functions: lay a pipe, branch, rotate, paste |
| `router.js` | orthogonal pipe routes, leg dragging |
| `live.js` | readings of every element, and where water flows |
| `render.js` | SVG drawing, updated per element when live values change |
| `styles.js`, `colors.js` | the drawing's look |
| `i18n.js` | translations |
| `api.js` | the WebSocket commands |

The core does not know the editor. `model.js` and `render.js` reach the element
library only through `elements/index.js`.

## Elements

Each element is one module that exports `defineElement({...})`; the contract
is documented at the top of `elements/registry.js`. Shared helpers live in
`elements/kit/`:

| Module | |
| --- | --- |
| `svg.js` | drawing primitives: bodies, valves, fans, flames, coils |
| `ports.js` | `port()` and passage helpers |
| `fields.js` | `num()`, `select()`, `bool()`, `text()` parameters and `bind()` |
| `readings.js` | reading bound values: open, running, speed |
| `tank.js` | tank shells with temperature layers |

### Adding an element

1. Write `elements/<category>/<name>.js`. Take a similar element as a start.
2. Import it in `elements/index.js` and add it to `LIBRARY`.
3. Add `element.<type>` and the texts of its new parameters, options, bindings
   and ports to `translations/en.js` and `translations/uk.js`.
4. Run `node --test tests/frontend/*.test.mjs`: the element tests check its box,
   ports, passages, drawing and texts in both languages.

Things that keep schemas working: never rename a `type` or a port `id` once
released, since saved pipes refer to them. A new parameter needs a default.

## The flow logic

Ports carry a flow direction (`in`, `out`, `both`), a circuit family and a
role. `live.js` builds a graph with a vertex per port, an edge per pipe and an
edge per *passage* — a path through an element, which an element may close
depending on its live state (a valve, a three-way valve's position, a manifold
loop). A pipe flows when it lies on a path from a running pump's outlet back
to its inlet, or from the mains to an open tap.

## The editor

`editor/state.js` holds the document, the selection and history; every change
goes through `commit()` (undoable) or `preview()` during a drag.
`editor/canvas.js` draws and routes input to `editor/gestures/`, one module per
gesture. Commands on the selection are in `editor/commands.js`, keys in
`editor/keyboard.js`.

## Tests

```
node --test tests/frontend/*.test.mjs     the frontend, no browser needed
pytest                                    the backend, with pytest-homeassistant-custom-component
```

`tools/dev/` is a bench: the real panel against a fake Home Assistant, for
working on the editor without logging in.

```
python3 tools/dev/serve.py                then open http://127.0.0.1:8765/tools/dev/
```
