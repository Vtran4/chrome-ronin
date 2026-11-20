# Chrome Ronin — *working title*

A first-person arena shooter in the style of DOOM (1993): fast, forward-moving,
weapon-forward combat in enclosed neon arenas — no reloads, no cover, no regen.
The setting is cyberpunk Osaka-adjacent: rain-slick megatower corridors, shrine
torii wired with neon, vending-machine altars, katakana signage over black
chrome. Everything is rendered to read like a manga page in motion: hard cel
outlines, flat ink-shadow shapes, screentone halftones on dark surfaces, and
impact expressed the way manga does it — inverted black-and-white impact frames,
speed lines on dashes, onomatopoeia (ドドド / GOGOGA) popping at the kill point,
and a 2–3 panel split freeze on finishers. Statics are lit by a Blender Cycles
bake (albedo + light atlases, three.js unlit); everything that moves — the
player viewmodel, projectiles, enemies, and props — is lit live with an
environment map that matches the bake, then passes through the ink/cel shader
pass so both layers read as one drawing.

## Play

- **Main screen**: title card styled as a manga cover, best-of-the-day score,
  *Start run*.
- **Movement**: run, strafe, jump, and a short air-dash with i-frames. Movement
  speed is DOOM-fast (~1.6× realistic sprint); the golden rule is *speed is
  defense* — standing still should always be the wrong answer. Verticality
  (jump pads, vent shortcuts) in every arena.
- **Combat loop**: wave-based arena runs of ~4–6 minutes. Clear the wave, the
  arena doors unlock, loot the dead (health / armor / ammo drops). Three
  difficulty tiers ramping enemy count, mix, and speed.
- **Weapons** (no reload; alternate fire = manga expressive mode):
  | weapon | feel | manga payoff |
  |---|---|---|
  | Kagerou pistol | fast, weak, always there | thin speed lines |
  | Oni scattergun | heavy knockback, close | DOMYO! burst, 1-frame invert |
  | Tsukumō rail | charge-pierce, hitscan | full-screen speed-line frame |
  | Yamibukuro grenade launcher | arcing splash | halftone smoke bloom |
  | Dangan kataana (melee) | dash-attack finisher | panel-split kill freeze |
- **Enemies**: drone grunt (swarm, weak; fires **slow visible plasma orbs —
  dodge by strafing/dash i-frames, never an undodgeable hitscan**), chrome oni
  (melee charger, telegraphs with a rear-up pose + speed lines before lunging), torii turret (static, shielded, must flank),
  and a per-tier boss at the end of tier 3. All enemies are cel-shaded with
  visible attack telegraphs — read like manga poses, not noise.
- **Health / armor / ammo**: pickup economy exactly like DOOM 1/2 — kills drop
  it, exploration hides it, nothing regenerates on its own. Armor soaks damage
  in exchange for speed at the heaviest tier.
- **Combo & score**: consecutive kills without taking damage build a multiplier
  up to ×8; the counter is drawn as a hand-lettered manga tally in the corner.
  Score persists as best-of-the-day across runs.
- **ESC** pauses: resume, restart, or quit to the main screen. **R** restarts
  instantly during play. Click the end panel to play again.
- **Enable sound** (top right) turns on the WebAudio set: punchy synth-fire,
  shotgun thud, rail charge whine, and page-swoosh on the dash. The build is
  complete with the sound off.

## Art style requirements

- Cel/ink rendering: a single full-frame post-process pass — quantized toon
  ramp (3 steps) + edge-detect black outline over the whole frame. No
  per-material cel shaders, no inverted hulls. This is the locked technique.
  Pixel luminance SNAPS to the band's ink level (flat fields, no gradients
  within a band; G0 gate, verified 8/10). Colored point-light washes are the
  intentional color-tint layer over flat inks and exempt from quantization.
- Halftone dots and ink-shadow shapes replace soft gradients anywhere a
  surface falls into shadow.
- Expressive frames: impact invert (1–2 frames), dash speed lines, kill
  onomatopoeia sprites — these are the game's identity and ship with the
  vertical slice, not later.
- HUD, menus, and the score tally are all in the same hand-lettered style;
  no default-font UI anywhere.

## Milestones

**M1 — Vertical slice (this doc's committed scope):** one arena, two weapons
(Kagerou pistol + Oni scattergun), two enemies (drone grunt + chrome oni), the
full manga FX set (impact invert, speed lines, onomatopoeia, panel-split
finisher), combo ×8 + best-of-the-day, WebAudio SFX, all four pw_run.py gates
green. The cel/ink post pass is built **first**, on a greybox arena, before any
content — it is the hardest thing to retrofit.

**M2 — Full game (stretch, specified above but not committed):** remaining
weapons (rail, grenades, kataana), turret + tier-3 boss, three arena tiers with
verticality variants, difficulty ramps.

## URL parameters

| param | effect |
|---|---|
| `?auto=1` | the bot plays (also the attract mode) |
| `?seed=<n>` | repeatable run (bot error, wave RNG, drops) |
| `?t=<seconds>` | simulate to that time and freeze the frame |
| `?view=<name>` | `spawn` (default), `boss`, `vent`, `top`, `arena` |
| `?state=wave3` / `?state=boss` / `?state=endscreen` | jump to a hard-to-reach state |
| `?manga=0` | disable the cel/ink post pass (isolate lighting bugs) |
| `?lockres` | pin the dynamic-resolution scaler (for verification shots) |

## Files

```
index.html              entry; error collector, HUD, main screen, pause menu
vendor/three.bundle.js  three.js core + addons, bundled as a classic script
js/                     config, util, audio (WebAudio), paint (canvas textures
                        + hand-lettered HUD), cel (ink/cel post pass), world
                        (arena geometry), enemies (AI state machines), weapons,
                        physics, game, bot, main
assets/                 statics.glb, dynamics.glb (viewmodel, weapons, props),
                        baked albedo/light atlases (arena layers + signage /
                        torii / boss boards), env_neon.jpg (Cycles panorama),
                        manifest.json + manifest.js + assets_embed.js (file://)
blender/                build_arena.py (procedural arenas), bake.py (Cycles
                        bakes), models/ (weapons, enemies, props)
tools/pw_run.py         headless verification (Playwright + system Chrome)
tools/embed_assets.py   rebuilds the file:// asset bundle after any bake
```

Rebuild the set: `blender -b -P blender/build_arena.py`, then
`blender -b assets/set.blend -P blender/bake.py -- --export-only` (re-exports
the glb with atlas UVs), then `... -- --full` (production bakes + env pano),
then `python tools/embed_assets.py`.

## Verified

`tools/pw_run.py smoke|shots|bot|fps` drives the game headlessly on the real
GPU. Acceptance gates for the vertical slice:

- **smoke** — boots with zero console errors on `file://` and on localhost.
- **shots** — key-moment screenshots: menu, wave combat, boss, finisher
  panel-split, end screen.
- **bot** — a full bot run: menu → wave 1 → loot → wave clear → boss → end
  panel → restart, with the score tally matching the kill log.
- **fps** — frame-rate gate: 60 fps sustained at 1080p on the desktop GTX
  1080 Ti target, with the dynamic scaler engaged.

See the repository history for the verification log of each shipped build.
