# Chrome Ronin

A first-person arena shooter in the spirit of DOOM (1993) — fast, forward-moving,
no reloads, no cover, speed is defense — rendered as a living manga page. The
whole frame passes through one post-process: pixel luminance snaps to three ink
levels (flat fields, no gradients within a band), depth + normal edge-detect
draws the black ink linework, screentone halftones fill the shadows, and the
expressive layer on top — impact-invert frames, dash speed lines, Japanese
onomatopoeia, and a panel-split freeze on oni finishers — is what sells the
"playable comic" read. The setting is a cyberpunk training dojo: rain-dark
neon, katakana banners, torii-lit cover blocks.

Everything is procedural — the arena, the weapons, the enemies, the banners,
the HUD lettering. There are no binary assets and no build step.

## Play

Double-click `start chrome ronin.bat` (serves the folder on localhost:8138 and
opens the game), **or** just double-click `index.html` — the game is fully
procedural, so `file://` works too.

- **Main screen**: title card, best-of-the-day, *Start run*.
- **Move** WASD + mouse (pointer lock); **SHIFT** air-dash with i-frames —
  dashing through plasma is the dodge; **SPACE** jump.
- **Weapons**: 1 Kagerou pistol (∞ ammo), 2 Oni scattergun (8 pellets, heavy
  knockback). No reloads.
- **Enemies**: magenta drone grunts hover in, fire **slow visible plasma orbs**
  (readable, dodgeable — nothing is undodgeable), and chrome oni chase, **rear
  up in a telegraph pose**, then lunge. Kills drop health / armor / ammo.
- **Five waves**, hardening mix. Combo builds ×2…×8 with clean kills and
  resets when you take a hit. Best of the day saved per date.
- **ESC** pauses, **R** restarts, click the end panel to run again.
- **Enable sound** (top right): WebAudio synth fire/thud/kill/dash/pickup set.
  The build is complete with the sound off.

## URL parameters

| param | effect |
|---|---|
| `?auto=1` | the bot plays (also the attract mode) |
| `?seed=<n>` | repeatable run (bot error, spawn order, drops) |
| `?t=<seconds>` | simulate to that time and freeze the frame |
| `?state=combat` / `fx` / `finisher` / `endscreen` | jump to a hard-to-reach moment |
| `?manga=0` | disable the cel/ink post pass (isolate lighting bugs) |
| `?lockres` | pin the dynamic-resolution scaler (for verification shots) |

## Files

```
index.html            entry; error collector, HUD, panels, manga FX overlays
vendor/three.bundle.js  three.js core bundled as a classic script
js/                   config, util, cel (ink/cel post pass), world (arena +
                      banners), audio (WebAudio), fx (onomatopoeia, panel
                      split, invert frames, speed lines), player, weapons,
                      enemies (drone/oni/drops), game (waves/score), bot, main
tools/pw_run.py       headless verification (Playwright + system Chrome)
tools/probe*.py       live-debug scene-graph probes
```

## Verified

`tools/pw_run.py smoke|shots|bot|fps` drives the game headlessly on the real
GPU. Latest run (M1 vertical slice):

- **smoke** — boots on localhost and `file://`, zero console errors, cel pass
  on and off (`?manga=0`).
- **shots** — combat, muzzle FX, finisher (panel gutters + ザマァ! captured
  on frame), end screen — all state jumps clean.
- **bot** — full lifecycle run: five-wave death at wave 3 (17 kills, 7,300),
  end panel, click-restart to a fresh wave 1, zero errors.
- **fps** — 60 fps at locked 1920×1080 with the scaler pinned, ~1 ms CPU busy.

See the repository history for the verification log of each shipped build.

## Roadmap (M2, from REQUIREMENTS.md)

Tsukumō rail, Yamibukuro launcher, Dangan kataana finisher melee, torii turret,
tier-3 boss, three-arena tiers, Blender baked statics with the same cel pass.
