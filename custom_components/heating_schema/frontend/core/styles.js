// The drawing's look, shared by the panel and the card.
//
// Colours come from Home Assistant's theme variables where a theme has them,
// so the drawing reads in light and dark themes alike.

export const SCHEMA_CSS = `
  .hs-sheet {
    --hs-ink: var(--primary-text-color, #e1e1e1);
    --hs-muted: var(--secondary-text-color, #9e9e9e);
    --hs-bg: var(--card-background-color, var(--ha-card-background, #1c1c1c));
    --hs-body: color-mix(in srgb, var(--hs-ink) 6%, var(--hs-bg));
    --hs-run: var(--success-color, #43a047);
    --hs-alarm: var(--error-color, #e53935);
    --hs-hot: #ef5350;
    --hs-cold: #42a5f5;
    font-family: var(--ha-font-family-body, Roboto, sans-serif);
  }
  .hs-sheet text { font-size: 13px; dominant-baseline: central; fill: var(--hs-ink); }
  /* A halo in the sheet's colour keeps a label readable over a pipe. */
  .hs-label { font-size: 14px; fill: var(--hs-ink); paint-order: stroke; stroke: var(--hs-bg); stroke-width: 4px; stroke-linejoin: round; }
  .hs-value { font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .hs-stale, .hs-stale text { opacity: 0.45; }
  .hs-small { font-size: 10px; fill: var(--hs-muted); }
  .hs-number { font-size: 14px; fill: var(--hs-muted); paint-order: stroke; stroke: var(--hs-bg); stroke-width: 4px; stroke-linejoin: round; }
  .hs-port-tag { font-size: 12px; font-weight: 500; }
  .hs-gauge-text { font-size: 11px; font-weight: 500; }
  .hs-icon { font-size: 18px; fill: var(--hs-cold); }
  .hs-note { font-size: 14px; }
  .hs-note-small { font-size: 11px; }
  .hs-note-large { font-size: 20px; font-weight: 500; }
  .hs-badge-text { font-size: 14px; dominant-baseline: central; }
  .hs-pipe-label { font-size: 11px; fill: var(--hs-muted); }

  .hs-body, .hs-gauge, .hs-badge {
    fill: var(--hs-body); stroke: color-mix(in srgb, var(--hs-ink) 35%, transparent); stroke-width: 2;
  }
  .hs-hit { fill: transparent; stroke: none; pointer-events: all; }
  .hs-frame { fill: none; stroke: var(--hs-run); stroke-width: 1.5; stroke-dasharray: 5 4; opacity: 0.8; }
  .hs-running { stroke: var(--hs-run); stroke-width: 2.5; }
  .hs-alarm { stroke: var(--hs-alarm) !important; stroke-width: 2.5; animation: hs-blink 1s steps(2) infinite; }
  .hs-defrost { stroke: var(--hs-cold); }
  .hs-line { fill: none; stroke: color-mix(in srgb, var(--hs-ink) 55%, transparent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .hs-dash { fill: none; stroke: color-mix(in srgb, var(--hs-ink) 40%, transparent); stroke-width: 1.5; stroke-dasharray: 4 3; }
  .hs-stub { stroke: color-mix(in srgb, var(--hs-ink) 45%, transparent); stroke-width: 4; stroke-linecap: round; }
  .hs-hit { fill: transparent; }
  .hs-dot { fill: color-mix(in srgb, var(--hs-ink) 70%, transparent); }
  .hs-idle { opacity: 0.4; }

  .hs-valve { fill: color-mix(in srgb, var(--hs-ink) 12%, var(--hs-bg)); stroke: color-mix(in srgb, var(--hs-ink) 55%, transparent); stroke-width: 2; stroke-linejoin: round; }
  .hs-valve-open { fill: var(--hs-run); stroke: var(--hs-run); }
  .hs-closed { fill: color-mix(in srgb, var(--hs-ink) 70%, transparent); }
  .hs-mark { fill: var(--hs-bg); stroke: color-mix(in srgb, var(--hs-ink) 55%, transparent); stroke-width: 1.5; }
  .hs-arrow { fill: color-mix(in srgb, var(--hs-ink) 30%, transparent); }
  /* While the pump runs its arrow fades under the spinning impeller. */
  .hs-arrow-on { fill: var(--hs-cold); fill-opacity: 0.12; stroke: var(--hs-cold); stroke-opacity: 0.35; stroke-width: 1.5; stroke-linejoin: round; }
  .hs-arrow-turning { fill: var(--hs-cold); }
  .hs-impeller { fill: color-mix(in srgb, var(--hs-ink) 12%, transparent); }
  .hs-spin .hs-impeller { fill: color-mix(in srgb, var(--hs-cold) 75%, transparent); }
  .hs-actuator { fill: color-mix(in srgb, var(--hs-ink) 12%, var(--hs-bg)); stroke: color-mix(in srgb, var(--hs-ink) 45%, transparent); stroke-width: 1.5; }
  .hs-actuator-on { fill: var(--hs-run); stroke: var(--hs-run); }
  .hs-unknown { opacity: 0.6; }
  .hs-bar { fill: none; stroke-width: 3; }
  .hs-bar-supply { stroke: #e53935; }
  .hs-bar-return { stroke: #1e88e5; }

  .hs-fan-ring { fill: none; stroke: color-mix(in srgb, var(--hs-ink) 25%, transparent); stroke-width: 2; }
  .hs-blade { fill: #3d8fd6; }
  .hs-hub { fill: #64b5f6; }
  .hs-wave { fill: none; stroke: #8d6e63; stroke-width: 3; stroke-linecap: round; }
  .hs-flame { fill: #ff7043; transform-box: fill-box; transform-origin: 50% 100%; animation: hs-flicker 0.9s ease-in-out infinite alternate; }
  .hs-flame.hs-idle { fill: color-mix(in srgb, var(--hs-ink) 25%, transparent); animation: none; opacity: 1; }
  .hs-rod { fill: none; stroke: color-mix(in srgb, var(--hs-ink) 45%, transparent); stroke-width: 2.5; stroke-linejoin: round; }
  .hs-rod.hs-hot { stroke: #ff7043; }
  .hs-coil { fill: none; stroke: #e57373; stroke-width: 2.5; stroke-linejoin: round; }
  .hs-tank { fill: var(--hs-body); }
  .hs-strata { stroke: none; }
  .hs-pill rect { fill: color-mix(in srgb, var(--hs-bg) 80%, transparent); }
  .hs-membrane { stroke: color-mix(in srgb, var(--hs-ink) 60%, transparent); stroke-width: 2; }
  .hs-water-heating { fill: color-mix(in srgb, #e53935 35%, transparent); }
  .hs-water-dhw { fill: color-mix(in srgb, #fb8c00 35%, transparent); }
  .hs-water-solar { fill: color-mix(in srgb, #f9a825 35%, transparent); }
  .hs-tube { stroke: color-mix(in srgb, var(--hs-ink) 40%, transparent); stroke-width: 2; }
  .hs-solar { fill: color-mix(in srgb, #1565c0 25%, var(--hs-bg)); }
  .hs-plate-hot { stroke: #e57373; stroke-width: 2; }
  .hs-plate-cold { stroke: #64b5f6; stroke-width: 2; }
  .hs-fin { fill: color-mix(in srgb, var(--hs-ink) 15%, var(--hs-bg)); stroke: none; }
  .hs-warm { fill: color-mix(in srgb, #ef5350 45%, var(--hs-bg)); stroke: #ef5350; }
  .hs-loop { fill: none; stroke: color-mix(in srgb, var(--hs-ink) 40%, transparent); stroke-width: 3; stroke-linejoin: round; }
  .hs-loop.hs-warm { stroke: #ef5350; fill: none; }
  .hs-tap { fill: color-mix(in srgb, var(--hs-ink) 30%, var(--hs-bg)); stroke: color-mix(in srgb, var(--hs-ink) 55%, transparent); stroke-width: 1.5; }
  .hs-drop { fill: #64b5f6; }
  .hs-drop-cold { fill: #29b6f6; }
  .hs-sun { fill: #ffca28; }
  .hs-sun-ray { fill: none; stroke: #ffca28; stroke-width: 2.5; stroke-linecap: round; }
  .hs-magnet { fill: none; stroke: #e53935; stroke-width: 2; }

  /* Drawing: lines and frames. The colour is the group's, the stroke its own. */
  .hs-draw { color: color-mix(in srgb, var(--hs-ink) 75%, transparent); pointer-events: none; }
  .hs-draw-grey { color: var(--hs-muted); }
  .hs-draw-red { color: #e53935; }
  .hs-draw-blue { color: #1e88e5; }
  .hs-draw-green { color: var(--hs-run); }
  .hs-draw-orange { color: #fb8c00; }
  .hs-draw-line { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .hs-draw-thin .hs-draw-line { stroke-width: 1.5; }
  .hs-draw-thick .hs-draw-line { stroke-width: 4; }
  .hs-stroke-dashed .hs-draw-line { stroke-dasharray: 10 7; stroke-linecap: butt; }
  .hs-stroke-dotted .hs-draw-line { stroke-dasharray: 0.1 7; }
  .hs-stroke-dash_dot .hs-draw-line { stroke-dasharray: 12 6 0.1 6; }
  .hs-draw-thick.hs-stroke-dotted .hs-draw-line { stroke-dasharray: 0.1 10; }
  .hs-draw-line.hs-draw-tint { fill: currentColor; fill-opacity: 0.08; }
  .hs-draw-head { fill: currentColor; stroke: none; }
  .hs-hit-stroke { fill: none; stroke: transparent; stroke-width: 14; pointer-events: stroke; }

  .hs-pipe-halo { fill: none; stroke: var(--hs-bg); stroke-width: 11; stroke-linejoin: round; }
  .hs-pipe { fill: none; stroke: var(--hs-medium); stroke-width: 5; stroke-linejoin: round; stroke-linecap: round; }
  .hs-flow { fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-width: 2; stroke-dasharray: 6 18; stroke-linecap: round; opacity: 0; }
  .hs-flowing .hs-flow { opacity: 1; animation: hs-flow var(--hs-flow-speed, 1.4s) linear infinite; }
  .hs-flowing .hs-flow.hs-reverse { animation-direction: reverse; }

  .hs-port { fill: var(--hs-bg); stroke-width: 2.5; }
  .hs-port-out { stroke: #ff8a65; }
  .hs-port-in { stroke: #64b5f6; }
  .hs-port-both { stroke: color-mix(in srgb, var(--hs-ink) 50%, transparent); }

  .hs-spin { animation: hs-spin var(--hs-speed, 1.2s) linear infinite; }

  @keyframes hs-spin { to { transform: rotate(360deg); } }
  @keyframes hs-flow { to { stroke-dashoffset: -24; } }
  @keyframes hs-flicker { from { transform: scale(0.92, 0.88); } to { transform: scale(1.05, 1.08); } }
  @keyframes hs-blink { 50% { stroke-opacity: 0.3; } }
  @media (prefers-reduced-motion: reduce) {
    .hs-spin, .hs-flame, .hs-flowing .hs-flow, .hs-alarm { animation: none; }
    .hs-flowing .hs-flow { stroke-dasharray: none; opacity: 0.35; }
  }
`;
