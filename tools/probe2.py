import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--use-gl=angle","--enable-gpu","--disable-gpu-sandbox"])
    pg = b.new_context(viewport={"width":1280,"height":720}).new_page()
    pg.on("pageerror", lambda e: print("PAGEERR:", e))
    pg.goto("http://127.0.0.1:8138/index.html?auto=1&seed=11&lockres")
    pg.wait_for_function("window.__ready === true", timeout=30000)
    for i in range(14):
        pg.wait_for_timeout(1000)
        d = pg.evaluate("""(() => {
          const g = window.__game, pl = g.player, gm = window.Game, inp = window.__inp;
          return {
            hp: Math.round(pl.hp), pos: [pl.pos.x|0, pl.pos.y|0, pl.pos.z|0],
            vel: [pl.vel.x|0, pl.vel.y|0, pl.vel.z|0],
            inp: [inp.fwd?1:0, inp.back?1:0, inp.left?1:0, inp.right?1:0, inp.fire?1:0],
            en: gm.enemies.map(e => [e.kind, Math.round(e.group.position.distanceTo(pl.pos))]),
            shots: gm.enemies.reduce((a,e)=>a+(e.shots?e.shots.length:0),0),
            kills: gm.kills, mode: gm.mode,
          };
        })()""")
        print(json.dumps(d))
        if d["mode"] == "end": break
    b.close()
