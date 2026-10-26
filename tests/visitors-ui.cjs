const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),source=html.match(/async function loadVisitorCount\(\)\{[\s\S]*?\n\}\n/)[0];
(async()=>{
const values=new Map(),badge={},requests=[];let fail=false,blocked=false;
const context=vm.createContext({visitorCount:null,localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)},setItem:(k,v)=>values.set(k,v)},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},AbortSignal,fetch:async(u,o)=>{requests.push(o);return {ok:!fail,json:async()=>({count:12})}},$:()=>badge});
vm.runInContext(source,context);
await vm.runInContext('loadVisitorCount()',context);await vm.runInContext('loadVisitorCount()',context);
assert.equal(requests[0].body,requests[1].body);assert.equal(context.visitorCount,12);
fail=true;await vm.runInContext('loadVisitorCount()',context);assert.equal(badge.textContent,'—');
fail=false;blocked=true;await vm.runInContext('loadVisitorCount()',context);assert.equal(requests.at(-1).method,undefined);
console.log('PASS: persistent visitor identity, unavailable state, blocked storage read-only fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
