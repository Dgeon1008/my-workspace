"""Exercise real save events with a temporary copy; user source and records stay intact."""
from pathlib import Path
import json
import shutil
import subprocess
import tempfile
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='moa-craft-live-') as temporary:
    app = Path(temporary) / 'app'
    shutil.copytree(root / 'components/harness/semantle/app', app,
                    ignore=shutil.ignore_patterns('dist', 'tests', 'node_modules', '__pycache__'))
    runtime = subprocess.Popen(['node', str(root / 'tests/harness-fixture.mjs'), str(app)],
                               cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        url = json.loads(runtime.stdout.readline())['url']
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 1280, 'height': 1000})
            context.route('**/api/token-activity', lambda r: r.fulfill(status=503, json={'error': 'blocked in UI test'}))
            def menu(route):
                response = route.fetch(); data = response.json()
                for category in data['categories']: category['collapsed'] = False
                route.fulfill(response=response, json=data)
            context.route('**/api/modules', menu)
            context.route('**/api/harness/semantle', lambda r: r.fulfill(json={'url': url}))
            saved = json.loads((app / 'puzzle.js').read_text(encoding='utf-8').split('export const puzzle = ', 1)[1].strip().removesuffix(';'))
            answer = '테스트정답'
            today = {'answer_id': 1694, '1st_score': .4936, '10th_score': .4381,
                     '1000th_score': .2878, 'previous': {'answer_id': 1693, 'key': '건조'}}
            puzzle = {'answer_id': 1694, 'key': answer, 'top_scores': [[w['rank'], w['word'], w['score'] / 100] for w in saved['words'] if w['rank'] and w['rank'] > 0]}
            context.route('**/api/today', lambda r: r.fulfill(json=today))
            context.route('**/api/puzzle/*', lambda r: r.fulfill(json=puzzle))
            page = context.new_page(); errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto('http://127.0.0.1:3000/')
            page.locator('.category-project-link', has_text='꼬맨틀').click()
            page.locator('iframe[title="꼬맨틀"]').wait_for()
            game = page.frame_locator('iframe[title="꼬맨틀"]')
            expect(game.locator('#puzzle-id')).to_have_text('1694', timeout=15000)
            iframe = page.locator('iframe[title="꼬맨틀"]')
            reference = context.new_page()
            reference.set_viewport_size({'width': round(iframe.bounding_box()['width']), 'height': 1000})
            reference.goto(url)
            expect(reference.locator('#puzzle-id')).to_have_text('1694', timeout=15000)
            for selector in ['h1', '.brand', 'main', '#guess-form', '.guide', '.faq']:
                measure = "e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {width:r.width,height:r.height,font:s.font,spacing:s.letterSpacing,margin:s.margin,padding:s.padding}}"
                assert game.locator(selector).evaluate(measure) == reference.locator(selector).evaluate(measure), selector
            assert game.locator('.brand img').evaluate('e=>e.complete&&e.naturalWidth>0')
            for word in ['아침', '세탁', answer]:
                game.locator('#guess_input').fill(word)
                game.locator('#guess-form button').click()
            assert game.locator('#guess-rows tr').count() == 3
            assert '정답입니다!' in game.locator('#finished').inner_text()
            game.locator('#settings-open').click()
            game.locator('#dark-mode').check()
            game.locator('#settings-close').click()
            game.locator('#guess_input').fill('작성중단어')
            css = app / 'style.css'
            css.write_text(css.read_text(encoding='utf-8') + '\nh1{letter-spacing:1.25px!important}', encoding='utf-8')
            expect(game.locator('h1')).to_have_css('letter-spacing', '1.25px', timeout=10000)
            expect(game.locator('#guess_input')).to_have_value('작성중단어')
            expect(game.locator('#guess-rows tr')).to_have_count(3)
            assert game.locator('html').evaluate('e=>e.classList.contains("dark")')
            script = app / 'game.js'
            script.write_text(script.read_text(encoding='utf-8').replace('const $ = id => document.getElementById(id);', "const $ = id => document.getElementById(id);document.documentElement.dataset.craftRevision='updated';"), encoding='utf-8')
            expect(game.locator('html')).to_have_attribute('data-craft-revision', 'updated', timeout=10000)
            dependency = app / 'engine.js'
            dependency.write_text(dependency.read_text(encoding='utf-8') + "\ndocument.documentElement.dataset.dependencyRevision='updated';", encoding='utf-8')
            expect(game.locator('html')).to_have_attribute('data-dependency-revision', 'updated', timeout=10000)
            (app / 'new-feature.js').write_text("document.documentElement.dataset.newFeature='ready';", encoding='utf-8')
            html = app / 'index.html'
            html.write_text(html.read_text(encoding='utf-8').replace('</head>', '<script type="module" src="/new-feature.js"></script></head>'), encoding='utf-8')
            expect(game.locator('html')).to_have_attribute('data-new-feature', 'ready', timeout=10000)
            expect(game.locator('#guess-rows tr')).to_have_count(3)
            game.locator('#finished a').click()
            game.locator('.spoiler').click()
            expect(game.locator('.word-list tbody tr')).to_have_count(1000)
            assert page.locator('.sidebar').is_visible()
            game.get_by_text('메인 페이지로 돌아가기', exact=True).click()
            expect(game.locator('#guess-rows tr')).to_have_count(3)
            assert not errors, errors
            print('PASS: identical original UI; actual CSS/JS/dependency/new-file saves auto-reload inside Moa; draft/history/settings preserved; navigation remains inside project')
            browser.close()
    finally:
        if runtime.poll() is None:
            runtime.communicate(input='stop\n', timeout=10)
