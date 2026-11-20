import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('TradingApp 전용 런처는 로그인 자동화와 분리되고 사전 확인은 서버를 시작하지 않음', () => {
  const script = readFileSync('launchers/trading-app/run_trading_app.bat', 'utf8');
  const commands = script.split(/\r?\n/).filter(line => !/^\s*rem\b/i.test(line));
  const runnable = commands.join('\n');
  assert.ok(!/startup_login|run_login|smartstore|cafe24|cjlogistics/i.test(runnable));
  assert.match(runnable, /-m uvicorn main:app --host 127\.0\.0\.1 --port 8000/);
  assert.match(runnable, /npm\.cmd run dev -- --host 127\.0\.0\.1 --port 5173 --strictPort --open/);
  const checkIndex = runnable.indexOf('if /I "%~1"=="--check" (');
  const startIndex = runnable.indexOf('start "TradingApp API');
  assert.ok(checkIndex >= 0 && checkIndex < startIndex);
  assert.ok(runnable.slice(checkIndex, startIndex).includes('exit /b 0'));
  assert.ok(!/taskkill|Stop-Process|pip install|npm install|reg add/i.test(runnable));
});
