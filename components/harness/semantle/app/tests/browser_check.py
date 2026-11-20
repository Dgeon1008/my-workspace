"""Run against npm start; follows the current official puzzle."""
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    daily = page.request.get(BASE + '/api/today').json()
    puzzle = page.request.get(BASE + f"/api/puzzle/{daily['answer_id']}").json()
    word = puzzle['top_scores'][0][1]
    page.goto(BASE)
    page.locator('#guess_input').fill(word)
    page.locator('#guess-form button').click()
    page.wait_for_selector('#guess-rows tr')
    assert word in page.locator('#guess-rows tr').first.inner_text()
    page.reload()
    page.wait_for_selector('#guess-rows tr')
    assert page.locator('#guess-rows tr').count() == 1
    page.locator('#settings-open').click()
    page.locator('#dark-mode').check()
    page.locator('#settings-close').click()
    page.reload()
    page.wait_for_selector('html.dark')
    page.locator('#guess_input').fill(puzzle['key'])
    page.locator('#guess-form button').click()
    page.wait_for_selector('#finished:not([hidden])')
    assert '100.00' in page.locator('#guess-rows tr').first.inner_text()
    page.goto(BASE + f"/nearest1k/{daily['answer_id']}")
    page.locator('.spoiler').click()
    assert page.locator('tbody tr').count() == 1000
    assert puzzle['key'] in page.locator('section').inner_text()
    page.goto(BASE)
    page.locator('#guess_input').wait_for(state='visible')
    for width in [390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    browser.close()
print('Browser checks passed.')
