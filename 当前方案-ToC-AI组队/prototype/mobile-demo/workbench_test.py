"""Desktop workbench interactions and mobile isolation, through browser UI."""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    errors = []
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:4173/?workspace=1&live=0&splash=0")
    page.wait_for_load_state("networkidle")
    logo = page.locator(".desktop-nav-brand img")
    assert logo.get_attribute("src") == "./assets/cospan-icon.svg"
    assert logo.evaluate("img => img.complete && img.naturalWidth > 0")
    assert page.locator(".wb-task-open").count() == 3
    assert page.locator(".wb-detail").count() == 0
    page.locator('.wb-task-open[data-task-id="data-link"]').click()
    detail = page.get_by_label("任务详情", exact=True)
    assert detail.get_by_text("接口字段与失败回退通过联调", exact=True).is_visible()
    assert detail.get_by_text("建议负责人", exact=True).is_visible()
    detail.get_by_role("button", name="接受建议").click()
    assert detail.get_by_text("负责人", exact=True).is_visible()
    assert detail.get_by_text("待开始", exact=True).is_visible()
    page.locator(".toast").wait_for(state="detached")
    page.screenshot(path=str(HERE / "artifacts/desktop-workbench-detail.png"))
    detail.focus()
    page.keyboard.press("Escape")
    assert page.locator(".wb-detail").count() == 0
    assert page.locator('.wb-task-open[data-task-id="data-link"]').evaluate("node => node === document.activeElement")
    page.get_by_role("button", name="看板", exact=True).click()
    assert page.locator(".wb-column").count() == 4
    assert page.locator(".wb-task-card").count() == 3
    page.screenshot(path=str(HERE / "artifacts/desktop-workbench-board.png"))
    page.get_by_role("button", name="列表", exact=True).click()
    page.get_by_role("navigation", name="桌面主导航").get_by_role("button", name="我的工作", exact=True).click()
    assert page.locator(".wb-task-open").count() == 1
    page.get_by_role("button", name="已阻塞", exact=True).click()
    assert page.locator(".wb-task-open").count() == 0
    assert page.get_by_text("当前筛选下没有阻塞事项。", exact=True).is_visible()
    page.get_by_role("button", name="Agent 与产物", exact=True).click()
    assert page.get_by_text("还没有 Agent 运行记录", exact=True).is_visible()
    page.get_by_role("button", name="项目动态", exact=True).click()
    assert page.locator(".workspace-timeline").is_visible()
    page.get_by_role("button", name="项目任务", exact=True).click()
    nav = page.get_by_role("navigation", name="桌面主导航")
    assert nav.locator(".desktop-nav-items button").all_text_contents() == ["我的工作", "项目空间", "队友与连接"]
    assert page.locator(".wb-sidebar").count() == 0
    nav.get_by_role("button", name="队友与连接", exact=True).click()
    assert nav.get_by_role("button", name="发现队友", exact=True).is_visible()
    nav.get_by_role("button", name="发现队友", exact=True).click()
    assert page.locator("body").get_attribute("data-tab") == "discover"
    nav.get_by_role("button", name="账号与设置", exact=True).click()
    assert page.get_by_label("我的设置", exact=True).is_visible()
    page.get_by_role("button", name="返回我的页面", exact=True).click()
    nav.get_by_role("button", name="项目空间", exact=True).click()
    page.screenshot(path=str(HERE / "artifacts/desktop-workbench-list.png"))
    for width in [1280, 1024, 800, 551]:
        page.set_viewport_size({"width": width, "height": 900})
        assert page.locator(".wb-workspace").is_visible()
        assert page.evaluate("document.body.scrollWidth <= innerWidth")
        page.locator(".wb-task-open").first.click()
        bounds = page.locator(".wb-detail").bounding_box()
        assert bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= width + 1
        page.get_by_role("button", name="关闭任务详情").click()
    mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mobile.goto("http://127.0.0.1:4173/?workspace=1&live=0&splash=0")
    mobile.wait_for_load_state("networkidle")
    assert mobile.locator(".workspace-mobile-content").is_visible()
    assert mobile.locator(".wb-workspace").count() == 0
    assert mobile.locator(".app-nav").is_visible()
    assert mobile.locator(".app-nav button").all_text_contents() == ["发现", "连接", "协作", "我的"]
    browser.close()
    assert not errors, errors
    print("PASS: task detail, claim, keyboard close, board, filters, records, desktop widths, mobile isolation")
