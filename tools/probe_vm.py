import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--use-gl=angle","--enable-gpu","--disable-gpu-sandbox"])
    pg = b.new_context(viewport={"width":1280,"height":720}).new_page()
    pg.on("pageerror", lambda e: print("PAGEERR:", e))
    pg.goto("http://127.0.0.1:8138/index.html?lockres&state=combat")
    pg.wait_for_function("window.__ready === true", timeout=20000)
    pg.wait_for_timeout(1500)
    d = pg.evaluate("""(() => {
      const g = window.__game, w = g.weapons, cam = g.camera;
      const m = w.models[w.cur];
      const wp = new THREE.Vector3(); m.getWorldPosition(wp);
      const proj = wp.clone().project(cam);
      return {
        cur: w.cur, visible: m.visible, camChildren: cam.children.length,
        camInScene: g.scene.children.includes(cam),
        worldPos: wp.toArray().map(v=>+v.toFixed(2)),
        ndc: proj.toArray().map(v=>+v.toFixed(2)),
        near: cam.near, fov: cam.fov,
      };
    })()""")
    print(json.dumps(d, indent=1))
    b.close()
