import json
from playwright.sync_api import sync_playwright
URL = "file:///C:/Users/vtran/OneDrive/Documents/AI projects/Chrome Ronin/index.html?lockres"
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--use-gl=angle","--enable-gpu","--disable-gpu-sandbox"])
    pg = b.new_context(viewport={"width":1280,"height":720}).new_page()
    errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    try:
        pg.wait_for_function("window.__ready === true", timeout=20000)
        print("FILE_READY")
    except Exception as e:
        print("NOT_READY")
    pg.wait_for_timeout(2000)
    print("STATE:", pg.evaluate("window.__state ? window.__state() : 'none'"))
    print("COLLECTED:", pg.evaluate("JSON.stringify(window.__errors||[])")[:1500])
    print("PAGEERR:", json.dumps(errs[:5]))
    b.close()
