# pw_run.py — headless verification harness for Chrome Ronin.
# Usage: python pw_run.py <mode> [outdir]
#   smoke   : load, wait ready, screenshot greybox/game, report errors
#   shots   : key-moment screenshots (game-state driven)
#   bot     : ?auto=1 full run, screenshots start/middle/end/restart
#   fps     : 1920x1080 frame-rate measurement over 10s of gameplay
import json, os, sys, time
from playwright.sync_api import sync_playwright

MODE = sys.argv[1] if len(sys.argv) > 1 else "smoke"
OUT = sys.argv[2] if len(sys.argv) > 2 else "shots"
OUT_DIR = os.path.abspath(OUT)
os.makedirs(OUT_DIR, exist_ok=True)
BASE = "http://127.0.0.1:8138/index.html?lockres"

def new_page(ctx, w=1920, h=1080):
    pg = ctx.new_page()
    pg.set_viewport_size({"width": w, "height": h})
    errors = []
    pg.on("console", lambda m: errors.append(f"console-{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.route("**/*.js", lambda route: route.continue_(headers={
        **route.request.headers, "cache-control": "no-cache"}))
    return pg, errors

def wait_ready(pg, timeout=30000):
    pg.wait_for_function("window.__ready === true", timeout=timeout)

def shot(pg, name):
    path = os.path.join(OUT_DIR, f"{name}.png")
    pg.screenshot(path=path)
    return path

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True,
                          args=["--use-gl=angle", "--enable-gpu", "--disable-gpu-sandbox"])
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)

    if MODE == "smoke":
        pg, errors = new_page(ctx)
        pg.goto(BASE)
        try:
            wait_ready(pg, 30000)
            print("READY")
        except Exception as e:
            print("NOT_READY:", e)
        time.sleep(2)
        print("STATE:", pg.evaluate("window.__state ? window.__state() : 'none'"))
        print("ERRORS:", json.dumps(errors[:20], indent=1))
        print("COLLECTED:", pg.evaluate("JSON.stringify(window.__errors || [])")[:2000])
        print("SHOT:", shot(pg, "smoke_cel"))
        # manga pass off — must also boot clean
        pg2, errors2 = new_page(ctx)
        pg2.goto("http://127.0.0.1:8138/index.html?lockres&manga=0")
        wait_ready(pg2)
        time.sleep(1)
        print("NOCEL_ERRORS:", json.dumps(errors2[:10]))
        print("SHOT:", shot(pg2, "smoke_nocel"))
        pg.close(); pg2.close()

    elif MODE == "shots":
        pg, errors = new_page(ctx)
        pg.goto(BASE)
        wait_ready(pg)
        time.sleep(1.5)
        print("SHOT:", shot(pg, "attract"))
        # state-driven moments: ?state=<name> jumps supported by game.js
        for st in ["combat", "fx", "finisher", "endscreen"]:
            pg.goto(BASE + f"&state={st}")
            wait_ready(pg)
            time.sleep(1.0)
            if st in ("combat", "fx"):
                pg.mouse.click(960, 540)   # fire: muzzle flash, sparks, hit FX
                time.sleep(0.08)
            else:
                time.sleep(0.65)
            print(f"SHOT_{st}:", shot(pg, st))
        print("STATE:", pg.evaluate("window.__state()"))
        print("ERRORS:", json.dumps(errors[:20], indent=1))
        pg.close()

    elif MODE == "bot":
        pg, errors = new_page(ctx)
        pg.goto(BASE + "&auto=1&seed=7")
        wait_ready(pg)
        time.sleep(1.5)
        print("SHOT:", shot(pg, "bot_start"))
        pg.wait_for_timeout(20000)
        print("STATE_MID1:", pg.evaluate("window.__state()"))
        print("SHOT:", shot(pg, "bot_mid1"))
        pg.wait_for_timeout(40000)
        print("STATE_MID2:", pg.evaluate("window.__state()"))
        print("SHOT:", shot(pg, "bot_mid2"))
        deadline = time.time() + 240
        while time.time() < deadline:
            s = json.loads(pg.evaluate("window.__state()"))
            if s["mode"] == "end":
                break
            pg.wait_for_timeout(3000)
        time.sleep(1.5)
        print("STATE_END:", pg.evaluate("window.__state()"))
        print("SHOT:", shot(pg, "bot_end"))
        pg.mouse.click(960, 540)
        pg.wait_for_timeout(1500)
        print("STATE_RESTART:", pg.evaluate("window.__state()"))
        print("SHOT:", shot(pg, "bot_restart"))
        print("ERRORS:", json.dumps(errors[:20], indent=1))
        pg.close()

    elif MODE == "fps":
        pg, errors = new_page(ctx)
        pg.goto("http://127.0.0.1:8138/index.html?seed=7&auto=1&lockres")
        wait_ready(pg)
        # warm up 3s, then measure 10s
        pg.wait_for_timeout(3000)
        samples = pg.evaluate("""(async () => {
          await new Promise(r => setTimeout(r, 10000));
          return {fps: window.__fps, ms: window.__frameMs};
        })()""")
        print("FPS:", json.dumps(samples))
        print("ERRORS:", json.dumps(errors[:10], indent=1))
        pg.close()

    b.close()
print("DONE", MODE)
