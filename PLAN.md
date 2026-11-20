# Chrome Ronin — development plan

Working agreement for building the M1 vertical slice (see REQUIREMENTS.md).
Stack: three.js (vendor bundle, no build step), classic scripts, Blender bake
pipeline deferred to M2. Arena + enemies are procedural three.js geometry,
cel-outlined by the post pass. Public repo: github.com/Vtran4/chrome-ronin —
one commit per green gate.

## Build order (each gate must stay green before moving on)

| gate | deliverable | verified by |
|---|---|---|
| **G0** | Scaffold + cel/ink post pass on a greybox arena: toon quantize (3-step), depth+normal edge-detect outlines, halftone in shadows. `?manga=0` bypasses the pass. | `pw_run.py smoke` — boots, zero errors, screenshot shows outlines |
| **G1** | FPS control: pointer lock, WASD+mouse, jump, air-dash (i-frames), AABB collision vs arena. Kagerou pistol: hitscan, no reload, viewmodel bob + fire kick. One static practice drone. | `pw_run.py smoke` + manual play |
| **G2** | Combat loop: drone grunt (swarm) + chrome oni (telegraph→lunge), Oni scattergun, health/armor/ammo drops, 5-wave ramp, death → end screen. | `pw_run.py bot` reaches wave ≥2 |
| **G3** | Manga FX: 1-frame impact invert, dash speed lines, kill onomatopoeia (ドドド / DOMYO!), panel-split finisher on oni kills, combo ×8 + best-of-day. | `pw_run.py shots` captures each FX |
| **G4** | WebAudio SFX (fire/thud/hit/death/dash/pickup) + hand-lettered canvas HUD, menu/pause/end panels — no default-font UI. | smoke + shots, sound off is complete |
| **G5** | Bot (`?auto=1` attract mode), `?seed/?t/?view/?state/?lockres` params, `pw_run.py smoke|shots|bot|fps` all green, `file://` playable (tools/embed_assets.py), neon-styled arena pass. | all four gates + file:// smoke |

## Module map (classic scripts, loaded in this order)

```
js/config.js   tunables (speeds, dps, wave table) — one CFG object
js/util.js     seeded rng, clamp, damp, dom helpers
js/cel.js      render targets + cel/ink post shader + FX overlay uniforms
js/world.js    procedural arena: rooms, cover blocks, neon trim, jump pads
js/weapons.js  weapon defs, viewmodels (primitives), hitscan spread, kick
js/enemies.js  drone grunt + chrome oni state machines, drops
js/fx.js       invert frames, speed lines, onomatopoeia, panel-split, combos
js/audio.js    WebAudio synth set
js/game.js     state machine: menu → wave intro → combat → clear → end
js/bot.js      auto player (attract mode)
js/main.js     boot, input, loop, HUD wiring, debug hooks (__ready/__state/__fps)
tools/pw_run.py  headless gates (Playwright + system Chrome, port 8138)
```

## Debug contract (used by pw_run.py)

- `window.__ready === true` when first frame rendered
- `window.__state()` → JSON `{mode, wave, score, combo, kills, hp, armor}`
- `window.__fps`, `window.__frameMs`
- URL: `?auto=1 &seed=<n> &t=<s> &view=<name> &state=<name> &manga=0 &lockres`

## Working rules

- Greybox first everywhere: geometry before styling, style before polish.
- Every gate: run smoke before commit; shots/bot before merge to main push.
- Perf budget 60 fps @1080p on GTX 1080 Ti; dynamic resolution scaler from G0.
- No new dependencies beyond the vendored three bundle + stdlib python.
