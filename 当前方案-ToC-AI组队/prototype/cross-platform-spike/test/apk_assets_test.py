"""Validate packaged bytes and simulate the Android HTTPS asset origin in Chromium.

This is NOT Android WebView / phone acceptance. No server or live API requests.
"""
import mimetypes
from pathlib import Path
from urllib.parse import urlsplit, unquote
from zipfile import ZipFile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
APK = ROOT / 'artifacts/cospan-unispike.apk'
H5 = ROOT / 'dist/build/h5'
with ZipFile(APK) as archive:
    packed = {n[len('assets/www/'):]: archive.read(n) for n in archive.namelist()
              if n.startswith('assets/www/') and not n.endswith('/')}
files = {str(p.relative_to(H5)): p.read_bytes() for p in H5.rglob('*') if p.is_file()}
assert packed == files, 'APK web assets must equal the current H5 build byte-for-byte'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    failures = []
    page.on('pageerror', lambda e: failures.append(str(e)))
    def serve(route):
        url = urlsplit(route.request.url)
        key = unquote(url.path).lstrip('/') or 'index.html'
        if url.scheme != 'https' or url.netloc != 'rally.local' or key not in packed:
            failures.append(route.request.url)
            route.abort()
        else:
            route.fulfill(body=packed[key], content_type=mimetypes.guess_type(key)[0] or 'application/octet-stream')
    page.route('**/*', serve)
    page.goto('https://rally.local/index.html?variant=A&source=android-app&live=0&workspace=1')
    page.wait_for_load_state('networkidle')
    expect(page.locator('.name')).to_have_text('林澈')
    assert page.locator('.active-card .avatar-image img').evaluate('(e)=>e.complete && e.naturalWidth > 0')
    page.locator('[aria-label="看详情"]').click()
    expect(page.get_by_role('dialog', name='人物详情')).to_be_visible()
    assert page.evaluate('window.RallyApp.handleBack()') is True
    assert page.evaluate('window.RallyApp.handleBack()') is False
    browser.close()
    assert not failures, failures
print(f'APK parity: {len(files)} assets; simulated asset origin and back bridge passed (not a real phone test).')
