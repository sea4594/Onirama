"""Non-blocking UI refinement audit of shipped route/board renderers.

Requires: pip install playwright; Playwright Chromium or a system Chromium binary.
Runs offline renderer fixtures (not a live Firebase/touch-device session).
Writes measurements and representative screenshots outside the repo by default.
"""
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(tempfile.mkdtemp(prefix='onirama-ui-audit-'))
VIEWPORTS = [(320, 568), (390, 844), (568, 320), (844, 390), (768, 1024), (1024, 768), (1440, 900), (1920, 1080)]
ROUTES = ['home', 'multiplayer', 'setup', 'settings', 'history', 'tutorial', 'join', 'lobby', 'rules']
STYLES = ['styles.css', 'shell.css', 'tabletop/tokens.css', 'tabletop/layout.css', 'tabletop/solo.css', 'tabletop/expansions.css', 'tabletop/coop.css', 'tabletop/interactions.css', 'tabletop/dialogs.css']
CSS = '\n'.join((ROOT / 'public' / x).read_text() for x in STYLES)

for fixture in ['ui-phase7-fixtures.js', 'ui-phase8-fixtures.js']:
    subprocess.run(['node', f'scripts/{fixture}'], cwd=ROOT, check=True)
files = [(f'route:{name}', ROOT / 'docs/ui-phase7-baselines' / f'{name}.html') for name in ROUTES]
files += [(f'game:{file.stem}', file) for file in sorted((ROOT / 'docs/ui-phase8-baselines').glob('*.html'))]
JS = """() => {
  const box=e=>{const r=e?.getBoundingClientRect();return r?{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}:null};
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  const controls=[...document.querySelectorAll('button,a,input,select,[role="button"]')].filter(visible);
  const offscreen=controls.filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1});
  const undersized=controls.filter(e=>{const r=e.getBoundingClientRect();return r.width<35||r.height<35});
  const regions=[...document.querySelectorAll('.tt2-zone,.tt5-zone,.tt6-player,.tt6-piles')];
  const belowFold=regions.filter(e=>e.getBoundingClientRect().top>=innerHeight);
  const dialogue=document.querySelector('.tt4-dialog');
  const dr=dialogue?.getBoundingClientRect();
  return {documentExtraHeight:Math.max(0,document.documentElement.scrollHeight-innerHeight),
    documentExtraWidth:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    controls:controls.length,offscreenControls:offscreen.length,undersizedControls:undersized.length,
    offscreenExamples:offscreen.slice(0,5).map(e=>e.getAttribute('aria-label')||e.textContent.trim().slice(0,32)),
    tabletopRegions:regions.length,regionsBelowFold:belowFold.length,
    dialogViewportArea:dr?Math.round(100*dr.width*dr.height/(innerWidth*innerHeight)):null,
    tabletop:box(document.querySelector('.tt2-root,.tt6-root'))};
}"""

results = []
with sync_playwright() as pw:
    chrome = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
    browser = pw.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox', '--disable-dev-shm-usage'])
    for name, path in files:
        source = re.sub(r'<link[^>]*>', '', path.read_text()).replace('</head>', f'<style>{CSS}</style></head>')
        page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        page.set_content(source, wait_until='domcontentloaded')
        for w, h in VIEWPORTS:
            page.set_viewport_size({'width': w, 'height': h})
            metrics = page.evaluate(JS)
            results.append({'fixture': name, 'viewport': f'{w}x{h}', **metrics})
            if (name, w, h) in {
                ('route:home', 1440, 900), ('route:setup', 390, 844), ('route:setup', 568, 320),
                ('route:settings', 390, 844), ('route:rules', 568, 320),
                ('game:solo-all-seat0', 390, 844), ('game:solo-all-seat0', 844, 390),
                ('game:coop-all-seat0', 390, 844), ('game:coop-all-seat0', 844, 390),
                ('game:coop-all-seat0', 1440, 900), ('game:dialog-prophecy', 390, 844),
                ('game:dialog-nightmare', 568, 320),
            }:
                page.screenshot(path=str(OUT / f'{name.replace(":", "-")}-{w}x{h}.png'), full_page=True)
        page.close()
    browser.close()
(OUT / 'measurements.json').write_text(json.dumps(results, indent=2) + '\n')
print(f'{len(files)} real-renderer fixtures × {len(VIEWPORTS)} viewports = {len(results)} checks')
print(f'Page-level vertical overflow: {sum(x["documentExtraHeight"]>0 for x in results)} cases')
print(f'Off-viewport controls: {sum(x["offscreenControls"]>0 for x in results)} cases')
print(f'Page-level horizontal overflow: {sum(x["documentExtraWidth"]>0 for x in results)} cases')
print(f'Measurements/screenshots: {OUT}')
print('KNOWN UI DEFECTS ARE MEASURED, NOT REPORTED AS A RELEASE-GATE FAILURE.')
