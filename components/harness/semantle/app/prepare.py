"""Create content from visitor-visible capture evidence, without original source."""
import html
import json
import pathlib
import re

app = pathlib.Path(__file__).resolve().parent
capture = app.parent / 'capture'
cap = json.loads((capture / 'capture.json').read_text(encoding='utf-8'))
links = {x['text']: x['href'] for x in cap['links'] if x['text']}
links['상위 1,000개의 단어'] = '/nearest1k/1693'
links['유사도 기준 상위 1,000개의 단어'] = '/nearest1k/1692'
links.pop('뉴스젤리', None)
links.pop('상위 1,000개의 단어', None)

def markup(text):
    pattern = '|'.join(re.escape(k) for k in sorted(links, key=len, reverse=True))
    parts = []
    last = 0
    for match in re.finditer(pattern, text):
        parts.append(html.escape(text[last:match.start()]))
        parts.append(f'<a href="{html.escape(links[match[0]])}">{html.escape(match[0])}</a>')
        last = match.end()
    parts.append(html.escape(text[last:]))
    return ''.join(parts)

questions = []
for item in cap['outline']:
    if item['tag'] == 'p' and item.get('depth') == 7 and item.get('text'):
        questions.append({'q': item['text'], 'a': []})
    elif item['tag'] == 'p' and item.get('depth') == 9 and item.get('text') and questions:
        if item.get('color') == '#999999':
            questions[-1]['a'][-1] += '<br><span class="example">' + markup(item['text']) + '</span>'
        else:
            text = markup(item['text'])
            if len(questions) == 5:
                text = html.escape(item['text'])
            questions[-1]['a'].append(text)
faq = ''.join('<li><p class="question">' + html.escape(q['q']) + '</p><div class="answer"><ul>' + ''.join('<li>' + a + '</li>' for a in q['a']) + '</ul></div></li>' for q in questions)
page = '''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>꼬맨틀 - 단어 유사도 추측 게임</title><link rel="stylesheet" href="/style.css"><script type="module" src="/game.js"></script></head>
<body><header class="brand"><a href="https://newsjel.ly/"><img src="/assets/jelly.png" alt="뉴스젤리"><span>데이터 활용에 가치를 더하는 데이터 시각화, <b>NEWSJELLY</b></span></a></header>
<main><div class="title-row"><h1>꼬맨틀 - 단어 유사도 추측 게임</h1><button id="settings-open" class="gear" aria-label="설정" title="설정">⚙</button></div>
<section aria-label="단어 추측"><div class="intro"><p>1693번째 꼬맨틀의 정답 단어를 맞혀보세요.</p><p>정답 단어와 가장 유사한 단어의 유사도는 <b>49.36</b> 입니다.</p><p>10번째로 유사한 단어의 유사도는 43.81이고, 1,000번째로 유사한 단어의 유사도는 28.78 입니다.</p></div>
<form id="guess-form"><input id="guess_input" aria-label="추측할 단어" placeholder="추측할 단어를 입력하세요" autocomplete="off" maxlength="40" required><button>추측하기</button></form><div id="message" role="status" aria-live="polite"></div>
<div id="results" hidden><table><thead><tr><th>#</th><th>추측한 단어</th><th>유사도</th><th>유사도 순위</th><th aria-label="유사도 순위 막대"></th></tr></thead><tbody id="guess-rows"></tbody></table></div>
<div class="actions"><button type="button" id="give-up">포기하기</button><a class="guide" href="https://newsjel.ly/archives/newsjelly-report/data-storytelling/14842" aria-label="꼬맨틀 공략집"><img src="/assets/guide.png" alt="꼬맨틀 공략집"></a></div><section id="finished" hidden aria-label="게임 결과"></section></section>
<section class="faq"><h2>질문과 답변</h2><ul class="questions">{{FAQ}}</ul></section>
<footer>꼬맨틀은 David Turner의 <a href="https://semantle.novalis.org/">Semantle</a>을 바탕으로 데이터 시각화 전문기업 <a href="https://newsjel.ly/">뉴스젤리</a>가 만들었습니다.</footer></main>
<dialog id="settings"><div class="dialog-title"><h2>설정</h2><button type="button" id="settings-close" aria-label="닫기">×</button></div><label><input id="dark-mode" type="checkbox"> 다크 모드</label><label><input id="sort-score" type="checkbox" checked> 유사도순으로 정렬</label><p id="storage-note" role="status"></p><button id="reset" type="button">추측 기록 초기화</button></dialog>
<dialog id="confirm-giveup"><h2>포기하시겠습니까?</h2><p>추측을 종료합니다. 사진에 없는 정답은 공개되지 않습니다.</p><div class="dialog-actions"><button id="cancel-giveup">계속 추측하기</button><button id="confirm-end">포기하기</button></div></dialog>
</body></html>'''
(app / 'index.html').write_text(page.replace('{{FAQ}}', faq), encoding='utf-8')
past = json.loads((capture / 'routes/nearest1k-1692/capture.json').read_text(encoding='utf-8'))
rows = [{'rank': int(r), 'word': w, 'score': float(s)} for r, w, s in re.findall(r'(\d+) (\S+) (\d+\.\d+)', past['text'])]
assert len(rows) == 1000
(app / 'words.json').write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')
print(f'Prepared {len(questions)} FAQ entries and {len(rows)} public word scores.')
