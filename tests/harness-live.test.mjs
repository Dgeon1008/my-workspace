import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startHarnessServer } from '../lib/harness-server.mjs';
import { loadHarnessProject } from '../lib/harness-config.mjs';

test('Moa and direct project startup read the same workspace environment settings', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'moa-project-config-'));
  try {
    await mkdir(join(folder, 'app'));
    await writeFile(join(folder, 'app/server.mjs'), 'export const createAppServer=()=>{};');
    await writeFile(join(folder, 'harness-projects.json'), JSON.stringify({fixture:{id:'fixture',root:'app',entry:'server.mjs',factory:'createAppServer',port:4175}}));
    await writeFile(join(folder, '.env.local'), 'MOA_FIXTURE_PORT=4567\nSIMILARITY_SERVICE_URL=https://example.test\n');
    const config = await loadHarnessProject('fixture', folder);
    assert.equal(config.port, Number(process.env.MOA_FIXTURE_PORT || 4567));
    assert.equal(config.environment.SIMILARITY_SERVICE_URL, process.env.SIMILARITY_SERVICE_URL || 'https://example.test');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('shared runtime pushes actual file edits, new files and backend imports without copying or polling', async () => {
  const root = await mkdtemp(join(tmpdir(), 'moa-shared-project-'));
  const entry = join(root, 'server.mjs');
  const serverCode = `import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {value} from './value.mjs';
export function createAppServer(){return http.createServer(async(req,res)=>{
 if(req.url==='/backend'){res.end(value);return;}
 try{const name=req.url==='/'?'index.html':req.url.slice(1);const data=await readFile(join(import.meta.dirname,name));
 res.setHeader('Content-Type',name.endsWith('.html')?'text/html':'text/plain');res.end(data);}
 catch{res.writeHead(404).end();}
});}`;
  await writeFile(entry, serverCode);
  await writeFile(join(root, 'value.mjs'), "export const value='original';");
  await writeFile(join(root, 'index.html'), '<html><body><h1>Original UI</h1></body></html>');
  let runtime;
  let reader;
  const abort = new AbortController();
  try {
    runtime = await startHarnessServer({ id: 'fixture', root, entry, factory: 'createAppServer', port: 0, sourceKey: 'fixture', settleMs: 60 });
    const stream = await fetch(runtime.url + '/_moa/events', { signal: abort.signal });
    reader = stream.body.getReader();
    let buffer = '';
    async function nextRevision() {
      const limit = setTimeout(() => abort.abort(), 10000);
      try {
        while (true) {
          const newline = buffer.indexOf('\n\n');
          if (newline >= 0) {
            const event = buffer.slice(0, newline); buffer = buffer.slice(newline + 2);
            const data = event.match(/data: (.+)/);
            if (data) return JSON.parse(data[1]).revision;
          } else { const result = await reader.read(); if (result.done) throw new Error('event stream ended'); buffer += new TextDecoder().decode(result.value); }
        }
      } finally { clearTimeout(limit); }
    }
    let revision = await nextRevision();
    const html = await (await fetch(runtime.url)).text();
    assert.match(html, /Original UI/);
    assert.match(html, /_moa\/client.js/);
    assert.equal(await (await fetch(runtime.url + '/backend')).text(), 'original');

    await writeFile(join(root, 'index.html'), '<html><body><h1>Craft edit</h1></body></html>');
    let next = await nextRevision(); assert.ok(next > revision); revision = next;
    assert.match(await (await fetch(runtime.url)).text(), /Craft edit/);
    await writeFile(join(root, 'new-component.js'), 'export const newFeature = true;');
    next = await nextRevision(); assert.ok(next > revision); revision = next;
    assert.match(await (await fetch(runtime.url + '/new-component.js')).text(), /newFeature/);
    await writeFile(join(root, 'value.mjs'), "export const value='updated dependency';");
    next = await nextRevision(); assert.ok(next > revision); revision = next;
    assert.equal(await (await fetch(runtime.url + '/backend')).text(), 'updated dependency');

    await writeFile(entry, 'intentionally invalid javascript !!!');
    await delay(500);
    assert.equal(await (await fetch(runtime.url + '/backend')).text(), 'updated dependency');
    await writeFile(entry, serverCode);
    assert.ok(await nextRevision() > revision);

    const before = (await (await fetch(runtime.url + '/_moa/health')).json()).revision;
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/index.html'), 'ignored build output');
    await delay(300);
    assert.equal((await (await fetch(runtime.url + '/_moa/health')).json()).revision, before);
  } finally {
    abort.abort(); await reader?.cancel().catch(() => {});
    await runtime?.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
