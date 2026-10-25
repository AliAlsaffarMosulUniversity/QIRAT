const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
source = source.replace('render();startCloud();', 'render();');
const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'',textContent:'',disabled:false,value:'',classList:{add(){},remove(){},toggle(){},contains(){return false}},focus(){},setSelectionRange(){},querySelector(){return node('submit')}});
  return nodes.get(selector);
}
const context = vm.createContext({console, document:{querySelector:node,querySelectorAll:()=>[],body:node('body'),addEventListener(){}},window:{scrollTo(){},addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},history:{replaceState(){}},location:{href:'https://example.com/',hash:'',pathname:'/',search:''},navigator:{},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},setTimeout(){},confirm:()=>true,FormData:class {entries(){return Object.entries({name:'إعلان اختبار',gender:'male',city:'الموصل',area:'',mosque:'جامع اختبار',datetime:'2026-10-27T12:00',map:'',notes:'',consent:'on'})}}});
vm.runInContext(source, context);
vm.runInContext("form($('#content'))",context);
assert.match(node('#content').innerHTML,/جارٍ الاتصال/);
vm.runInContext("cloud={};authPending=false;form($('#content'))",context);
assert.match(node('#content').innerHTML,/تسجيل الدخول عبر Google/);
vm.runInContext("currentUser={uid:'owner'};cloudReady=true;entries=[{id:'11111111-1111-4111-8111-111111111111',ownerUid:'other',name:'إعلان آخر',mosque:'جامع',datetime:'2026-10-27T12:00'}];manage($('#content'))",context);
assert(!node('#content').innerHTML.includes('إعلان آخر'));
vm.runInContext("editEntry('11111111-1111-4111-8111-111111111111')",context);
assert.match(node('#toast').textContent,/إعلاناتك فقط/);
vm.runInContext("cloud={saveAnnouncement:async(e)=>{globalThis.saved=e}};form($('#content'))",context);
(async()=>{
  await node('#entryForm').onsubmit({preventDefault(){},target:node('#entryForm')});
  assert.equal(context.saved.ownerUid,'owner');
  assert.equal(context.saved.status,'published');
  assert.match(node('#toast').textContent,/تم نشر الإعلان/);
  vm.runInContext("cloud={saveAnnouncement:async()=>{throw {code:'permission-denied'}}};form($('#content'))",context);
  await node('#entryForm').onsubmit({preventDefault(){},target:node('#entryForm')});
  assert.equal(node('submit').disabled,false);
  assert.match(node('#toast').textContent,/تعذر الوصول/);
  assert.equal((html.match(/href="tel:07750856155"/g)||[]).length,3);
  assert(!html.includes('حفظ الإعلان على هذا الجهاز'));
  console.log('PASS: script syntax, sign-in gate, owner controls, publish success, write failure, phone links');
})().catch(e=>{console.error(e);process.exitCode=1});

