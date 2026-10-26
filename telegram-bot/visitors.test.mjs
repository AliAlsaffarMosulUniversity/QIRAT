import assert from 'node:assert/strict';
import {registerVisitor,visitorRequest} from './worker.mjs';
class Memory{
 constructor(){this.docs=new Map();this.conflicts=0;}
 async get(p){const d=this.docs.get(p);return d?structuredClone(d):null;}
 put(p,data,previous){return {p,data,version:previous?.updateTime};}
 async commit(writes){if(this.conflicts-->0)return false;for(const w of writes)if(this.docs.get(w.p)?.updateTime!==w.version)return false;for(const w of writes)this.docs.set(w.p,{data:structuredClone(w.data),updateTime:(w.version||0)+1});return true;}
}
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const store=new Memory();
assert.equal(await registerVisitor(a,store),1);assert.equal(await registerVisitor(a,store),1);
assert.equal(await registerVisitor(b,store),2);
const concurrent=new Memory();await Promise.all([registerVisitor(a,concurrent),registerVisitor(b,concurrent)]);
assert.equal((await concurrent.get('stats/visitors')).data.count,2);
const retry=new Memory();retry.conflicts=2;assert.equal(await registerVisitor(a,retry),1);
const blocked=new Memory();blocked.conflicts=9;await assert.rejects(registerVisitor(a,blocked),/counter_conflict/);
const env={FIREBASE_SERVICE_ACCOUNT_JSON:'configured'},origin='https://alialsaffarmosuluniversity.github.io';
const req=(method,body,from=origin)=>new Request('https://example.com/visitors',{method,headers:{Origin:from,'Content-Type':'application/json'},...(body===undefined?{}:{body})});
const send=r=>visitorRequest(r,env,async()=>store);
assert.equal((await send(req('POST',JSON.stringify({visitorId:a})))).status,200);
assert.equal((await (await send(req('GET'))).json()).count,2);
assert.equal((await send(req('POST','{}'))).status,400);
assert.equal((await send(req('POST','null'))).status,400);
assert.equal((await send(req('POST','{'))).status,400);
assert.equal((await send(req('POST','x'.repeat(257)))).status,413);
assert.equal((await send(req('POST','{}','https://other.example'))).status,403);
assert.equal((await send(req('OPTIONS'))).status,204);
assert.equal((await send(req('DELETE'))).status,405);
assert.equal((await visitorRequest(req('GET'),{},async()=>store)).status,503);
assert.equal((await visitorRequest(req('GET'),env,async()=>{throw Error('offline')})).status,503);
console.log('PASS: visitor deduplication, atomic concurrent increments, retries, validation, origin restrictions, failure responses');
