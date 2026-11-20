# Chrome Ronin

A first-person arena shooter in the spirit of DOOM (1993) — fast, forward-moving,
no reloads, no cover, speed is defense — rendered as a living manga page. The
whole frame passes through one post-process: pixel luminance snaps to three ink
levels (flat fields, no gradients within a band), depth + normal edge-detect
draws the black ink linework, screentone halftones fill the shadows, and the
expressive layer on top — impact-invert frames, dash speed lines, Japanese
onomatopoeia, and a panel-split freeze on oni finishers — is what sells the
"playable comic" read. The arena is an open rooftop above a three-layer
procedural neon cityscape: instanced towers with lit window grids, painted
gradient sky and moon, katakana banners, torii-lit cover blocks.

Everything is procedural — the city, the arena, the weapons, the enemies, the
banners, the HUD lettering. There are no binary assets and no build step.

## Play

Double-click `start chrome ronin.bat` (serves the folder on localhost:8138 and
opens the game), **or** just double-click `index.html` — the game is fully
procedural, so `file://` works too.

- **Main screen**: title card, best-of-the-day, *Start run*.
- **Move** WASD + mouse (pointer lock); **SHIFT** air-dash with i-frames —
  dashing through plasma is the dodge; **SPACE** jump, **hold SPACE** in the
  air for the **rocketpack** (fuel bar drains while thrusting up, refills on
  the ground, floating down is free).
- **Weapons**: 1 Kagerou pistol (∞ ammo), 2 Oni scattergun (8 pellets, heavy
  knockback), 3 **Otsushimi rocket launcher** (ballistic arc, splash damage,
  screen-shaking detonation). No reloads.
- **Every hit shows its number** — white for hits, big yellow `!!` for crits
  (15% ×2).
- **Enemies**: magenta drone grunts hover in and fire **slow visible plasma
  orbs** (readable, dodgeable); chrome oni chase, **rear up in a telegraph
  pose**, then lunge — now with feints; and the new **wisp** blink-skirmisher
  keeps its distance, flickers out, and reappears behind you with a 3-shot
  burst. All enemies jink sideways when shot and keep spacing like melee
  players do. Kills drop health / armor / ammo / rockets.
- **Five waves**, hardening mix (drones → oni → wisps). Combo builds ×2…×8
  with clean kills and resets when you take a hit. Best of the day saved per
  date.
- **ESC** pauses, **R** restarts, click the end panel to run again.
- **Enable sound** (top right): WebAudio synth fire/thud/kill/dash/pickup set
  plus rocket boom, blink, and a rocketpack thrust wash. The build is complete
  with the sound off.

## URL parameters

| param | effect |
|---|---|
| `?auto=1` | the bot plays (also the attract mode) |
| `?seed=<n>` | repeatable run (bot error, spawn order, drops) |
| `?t=<seconds>` | simulate to that time and freeze the frame |
| `?state=combat` / `fx` / `rocket` / `hover` / `wisp` / `finisher` / `endscreen` | jump to a hard-to-reach moment |
| `?manga=0` | disable the cel/ink post pass (isolate lighting bugs) |
| `?lockres` | pin the dynamic-resolution scaler (for verification shots) |

## Files

```
index.html            entry; error collector, HUD (HP/armor/fuel/ammo), panels,
                      manga FX overlays, damage-number pool
vendor/three.bundle.js  three.js core bundled as a classic script
js/                   config, util, cel (ink/cel post pass), world (rooftop +
                      neon cityscape + banners), audio (WebAudio), fx
                      (damage numbers, onomatopoeia, panel split, invert
                      frames, speed lines, explosions), player (movement +
                      rocketpack), weapons (3 guns + rocket projectiles),
                      enemies (drone/oni/wisp/drops), game (waves/score),
                      bot, main
tools/pw_run.py       headless verification (Playwright + system Chrome)
```

## Verified

`tools/pw_run.py smoke|shots|bot|fps` drives the game headlessly on the real
GPU. Latest run (content update batch):

- **smoke** — boots on localhost and `file://`, zero console errors, cel pass
  on and off (`?manga=0`).
- **shots** — 8 states captured clean: cityscape at attract, combat with
  damage numbers on frame (white 8 + yellow 12!!), rocket detonation with
  DOMYO!! and splash numbers, rocketpack hover with thruster flames and
  drained pack, wisp enemy, finisher panel gutters + ザマァ!, end screen.
- **bot** — full lifecycle: death at wave 5 (32 kills, 7,150) with the bot
  actually using rockets on clusters (picked 6, fired to 0), end panel,
  click-restart to a fresh wave 1, zero errors.
- **fps** — 60 fps at locked 1920×1080 with the scaler pinned, ~1.1 ms CPU
  busy — the cityscape costs nothing measurable.

See the repository history for the verification log of each shipped build.

## Roadmap (M2, from REQUIREMENTS.md)

Tsukumō rail, Dangan kataana finisher melee, torii turret,
tier-3 boss, three-arena tiers, Blender baked statics with the same cel pass.
