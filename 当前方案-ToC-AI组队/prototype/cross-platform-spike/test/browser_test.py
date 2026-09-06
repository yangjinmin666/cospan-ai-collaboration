"""Run against the built H5 server. No production credentials or network writes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).resolve().parents[1] / 'artifacts'
OUT.mkdir(exist_ok=True)

def gesture(page, dx, dy=0):
    card = page.locator('.active-card')
    box = card.bounding_box()
    x, y = box['x'] + box['width']/2, box['y'] + 90
    # Real browser touch stream (not direct calls to Vue methods).
    cdp = page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for step in range(1, 7):
        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+dx*step/6,'y':y+dy*step/6}]})
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    cdp.detach()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    errors = []
    for width, height in [(375, 812), (390, 844), (430, 932), (375, 667)]:
        context = browser.new_context(viewport={'width':width,'height':height}, is_mobile=True, has_touch=True)
        page = context.new_page()
        page.set_default_timeout(8000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: errors.append(f'{r.status}: {r.url}') if r.status >= 400 else None)
        page.goto('http://127.0.0.1:4180')
        page.wait_for_load_state('networkidle')
        expect(page.locator('.name')).to_have_text('林澈')
        avatar = page.locator('.active-card .avatar-image img')
        assert avatar.evaluate('(e)=>e.complete && e.naturalWidth > 0')
        assert page.locator('.active-card .avatar-image').evaluate('(e)=>e.style.left') == '-19.187%'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'discover-{width}-{height}.png'))
        page.locator('[aria-label="打开筛选"]').tap()
        expect(page.get_by_role('dialog', name='筛选偏好')).to_be_visible()
        page.get_by_text('硬件／结构', exact=True).tap()
        page.get_by_text('取消', exact=True).tap()
        expect(page.locator('.counter')).to_have_text('1 / 11')
        page.locator('[aria-label="打开筛选"]').tap()
        expect(page.get_by_text('硬件／结构', exact=True)).not_to_have_class('selected')
        page.get_by_text('硬件／结构', exact=True).tap()
        page.screenshot(path=str(OUT / f'filter-{width}.png'))
        page.get_by_text('确认筛选', exact=True).tap()
        expect(page.locator('.counter')).not_to_have_text('1 / 11')
        page.locator('[aria-label="打开筛选"]').tap()
        page.get_by_text('重置', exact=True).tap()
        page.get_by_text('确认筛选', exact=True).tap()
        page.locator('[aria-label="看详情"]').tap()
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('dialog', name='人物详情')).to_be_visible()
        expect(page.locator('.bottom-nav')).to_have_count(0)
        page.screenshot(path=str(OUT / f'detail-preview-{width}.png'))
        page.locator('.expand-cue').tap()
        expect(page.get_by_text('过往项目', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT / f'detail-expanded-{width}.png'))
        assert page.evaluate('window.RallyApp.handleBack()') is True
        expect(page.locator('.full-profile')).to_have_count(0)
        assert page.evaluate('window.RallyApp.handleBack()') is True
        expect(page.get_by_role('dialog')).to_have_count(0)
        assert page.evaluate('window.RallyApp.handleBack()') is False
        # Use the action buttons for every viewport; gesture traces at 390px below.
        page.locator('[aria-label="暂不看"]').tap()
        expect(page.locator('.name')).to_have_text('苏晴')
        page.locator('.lab-link').tap()
        page.get_by_text('模拟下一次请求失败', exact=True).tap()
        page.locator('[aria-label="想认识"]').tap()
        expect(page.get_by_role('status')).to_contain_text('模拟网络失败')
        expect(page.locator('.name')).to_have_text('苏晴')
        page.locator('[aria-label="想认识"]').tap()
        expect(page.locator('.name')).to_have_text('七喜')
        if width == 390:
            gesture(page, 35)
            expect(page.locator('.name')).to_have_text('七喜')
            expect(page.locator('.active-card')).to_have_css('transform', 'matrix(1, 0, 0, 1, 0, 0)')
            gesture(page, -110)
            expect(page.locator('.name')).to_have_text('沈蓝')
            gesture(page, 110)
            expect(page.locator('.name')).to_have_text('白榆')
        context.close()
    browser.close()
    assert not errors, errors
    print(json.dumps({'viewports':4,'page_errors':errors,'result':'passed'}, ensure_ascii=False))
