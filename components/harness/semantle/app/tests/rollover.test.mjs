import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountGame} from '../game.js';

test('mounted game switches at midnight, preserves settings/history and rejects an in-flight old score', async t => {
  let now=Date.parse('2026-11-19T14:59:59Z');
  t.mock.method(Date,'now',()=>now);
  t.mock.method(globalThis,'setTimeout',()=>({unref(){}}));
  const stored=new Map();
  const original=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
  t.after(()=>{if(original===undefined) delete globalThis.localStorage; else globalThis.localStorage=original;});
  const element=()=>({value:'',disabled:false,checked:false,hidden:false,textContent:'',children:[],style:{},
    classList:{toggle(){},add(){}},setAttribute(){},focus(){},close(){},showModal(){},
    append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
    addEventListener(name,fn){this[name]=fn;},querySelector(){return this.button??=element();}});
  const nodes=new Map();
  const doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},
    createElement:element,documentElement:element(),addEventListener(){}};
  const answer=id=>id===1694?'의외로':'새정답';
  let id=1694;
  let resolveGuess;
  const fake=async url=>{
    if(url==='/api/today') return Response.json({answer_id:id,'1st_score':.5,'10th_score':.4,'1000th_score':.2,previous:{answer_id:id-1,key:'어제'}});
    if(url.startsWith('/api/puzzle/')) {
      const number=Number(url.split('/').at(-1));
      return Response.json({answer_id:number,key:answer(number),top_scores:Array.from({length:1000},(_,i)=>[i+1,`단어${i}`,.5-i*.0003])});
    }
    return new Promise(resolve=>{resolveGuess=resolve;});
  };
  await mountGame({document:doc,location:{pathname:'/'},fetch:fake});
  const $=doc.getElementById;
  assert.equal($('puzzle-id').textContent,1694);
  $('dark-mode').checked=true;
  $('dark-mode').onchange();
  $('guess_input').value=answer(id);
  await $('guess-form').submit({preventDefault(){}});
  assert.equal($('guess-rows').children.length,1);
  $('guess_input').value='아침';
  const pending=$('guess-form').submit({preventDefault(){}});
  await Promise.resolve(); await Promise.resolve();
  assert.ok(resolveGuess);
  now+=2000; id++;
  resolveGuess(Response.json({guess:'아침',sim:.3,rank:300}));
  await pending;
  assert.equal($('puzzle-id').textContent,1695);
  assert.equal($('guess-rows').children.length,0);
  assert.equal($('finished').hidden,true);
  assert.equal($('dark-mode').checked,true);
  assert.equal(JSON.parse(stored.get('kkomantle-puzzle-1694-v2')).guesses.length,1);
  assert.equal(JSON.parse(stored.get('kkomantle-puzzle-1695-v2')).guesses.length,0);
  $('guess_input').value=answer(id);
  await $('guess-form').submit({preventDefault(){}});
  assert.equal($('guess-rows').children.length,1);
});
