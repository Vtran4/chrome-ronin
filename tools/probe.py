import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--use-gl=angle","--enable-gpu","--disable-gpu-sandbox"])
    pg = b.new_context(viewport={"width":1280,"height":720}).new_page()
    errs=[]
    pg.on("console", lambda m: errs.append(m.type+": "+m.text) if m.type in ("error","warning") else None)
    pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)))
    pg.goto("http://127.0.0.1:8138/index.html?lockres")
    pg.wait_for_timeout(4000)
    print("COLLECTED:", pg.evaluate("JSON.stringify(window.__errors||[])")[:3000])
    print("CONSOLE:", json.dumps(errs[:10]))
    b.close()
