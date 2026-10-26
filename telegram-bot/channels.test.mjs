import assert from 'node:assert/strict';
import { channelAction, channelId, rememberChannel, TEST_TEXT } from './channels.mjs';
import { channelsRequest } from './worker.mjs';
function memoryStore() {
  const docs=new Map();let version=0;
  return {docs,async get(path){return docs.get(path)||null},
    async list(path){return [...docs].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([,d])=>d.data)},
    put(path,data,previous){return {path,data,previous}},async commit(writes){
      for(const w of writes){const old=docs.get(w.path);if(w.previous?old?.updateTime!==w.previous.updateTime:!!old)return false;}
      for(const w of writes)docs.set(w.path,{data:structuredClone(w.data),updateTime:String(++version)});return true;
    }};
}
const env={TELEGRAM_ADMIN_ID:'123',TELEGRAM_BOT_TOKEN:'fake',FIREBASE_SERVICE_ACCOUNT_JSON:'fake',APP_URL:'https://qirat.example/'};
const id='-1001234567890', second='-1001234567891', store=memoryStore(), calls=[];
let rights=true, owner=true, timeout=false, nextMessage=30;
const api=async(method,body)=>{
  calls.push({method,body});
  if(method==='getMe')return {id:555,username:'QiratMosulAlertsBot'};
  if(method==='getChat')return {id:Number(body.chat_id),type:'channel',title:'قناة خاصة للاختبار'};
  if(method==='getChatMember')return body.user_id===123?{status:owner?'creator':'member'}:{status:'administrator',can_post_messages:rights,can_edit_messages:rights,can_delete_messages:rights};
  if(timeout)throw new Error('secret-token-must-not-escape');
  if(method==='sendMessage')return {message_id:++nextMessage,chat:{id:Number(body.chat_id)}};
  return true;
};
const call=(action,extra={})=>channelAction({action,chat_id:id,...extra},env,store,api);
for(const bad of ['https://t.me/+invite','@channel',id.slice(1),'-100../x',123,null])assert.equal(channelId(bad),false);
await assert.rejects(()=>call('connect',{chat_id:'https://t.me/+invite'}),/numeric_channel_id_required/);
await rememberChannel({my_chat_member:{chat:{id:Number(id),type:'channel',title:'candidate'}}},env,store);
assert.equal((await call('list')).channels.length,0);
assert.equal((await call('list')).candidates.length,1);
await call('connect');await call('connect',{chat_id:second});
const testId=crypto.randomUUID();
rights=false;await assert.rejects(()=>call('test-publish',{delivery_id:testId}),/bot_permissions_required/);
assert(!calls.some(c=>c.method==='sendMessage'));
rights=true;owner=false;await assert.rejects(()=>call('verify'),/channel_admin_required/);owner=true;
const [a,b]=await Promise.allSettled([call('test-publish',{delivery_id:testId}),call('test-publish',{delivery_id:testId})]);
assert.equal([a,b].filter(r=>r.status==='fulfilled').length,1);
assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
const posted=(await call('test-publish',{delivery_id:testId})).delivery;
assert.equal(posted.chat_id,id);assert.equal(posted.message_id,31);assert.equal(posted.text,TEST_TEXT);
assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
await call('test-edit',{delivery_id:testId});
assert.equal(calls.find(c=>c.method==='editMessageText').body.message_id,31);
assert(calls.find(c=>c.method==='editMessageText').body.text.includes(TEST_TEXT));
await call('test-edit',{delivery_id:testId});
assert.equal(calls.filter(c=>c.method==='editMessageText').length,1);
await assert.rejects(()=>call('delete',{delivery_id:testId}),/delivery_type_mismatch/);
await assert.rejects(()=>call('test-delete',{chat_id:second,delivery_id:testId}),/saved_message_required/);
await call('toggle',{enabled:false});
await assert.rejects(()=>call('test-publish',{delivery_id:crypto.randomUUID()}),/channel_disabled/);
await call('test-delete',{delivery_id:testId});
assert.equal(calls.find(c=>c.method==='deleteMessage').body.message_id,31);
assert.equal((await call('deliveries')).deliveries[0].state,'deleted');
await call('toggle',{enabled:true});
const failedId=crypto.randomUUID();timeout=true;
await assert.rejects(()=>call('test-publish',{delivery_id:failedId}),/delivery_pending_review/);
timeout=false;const before=calls.filter(c=>c.method==='sendMessage').length;
await assert.rejects(()=>call('test-publish',{delivery_id:failedId}),/delivery_pending_review/);
assert.equal(calls.filter(c=>c.method==='sendMessage').length,before);
const announcementId=crypto.randomUUID();
await store.commit([store.put('announcements/'+announcementId,{id:announcementId,status:'published',name:'بيانات اختبار محلية',mosque:'جامع اختبار',datetime:'2026-10-26T00:00',prayer:'fajr',city:'الموصل'},null)]);
await call('publish',{delivery_id:announcementId});
const doc=await store.get('announcements/'+announcementId);
await store.commit([store.put('announcements/'+announcementId,{...doc.data,mosque:'جامع معدل'},doc)]);
await call('edit',{delivery_id:announcementId});
assert(calls.filter(c=>c.method==='editMessageText').at(-1).body.text.includes('جامع معدل'));
await call('delete',{delivery_id:announcementId});
// A process crash after Telegram accepts a message must leave a non-retryable claim.
const crashId=crypto.randomUUID(), originalCommit=store.commit;
store.commit=async writes=>writes.some(w=>w.data.state==='sent')?false:originalCommit(writes);
await assert.rejects(()=>call('test-publish',{delivery_id:crashId}),/delivery_pending_review/);
store.commit=originalCommit;
await assert.rejects(()=>call('test-publish',{delivery_id:crashId}),/delivery_pending_review/);
const admin={localId:'admin',email:'ali_alsaffar@uomosul.edu.iq',emailVerified:true,providerUserInfo:[{providerId:'google.com'}]};
let user=admin;
const deps={lookupUser:async()=>user,makeStore:async()=>store,api};
const req=(body,origin='https://qirat.example',auth='Bearer fake')=>new Request('https://bridge.example/channels',{method:'POST',headers:{Origin:origin,Authorization:auth},body:JSON.stringify(body)});
assert.equal((await channelsRequest(req({action:'list'}),env,deps)).status,200);
assert.equal((await channelsRequest(req({action:'list'},'https://evil.example'),env,deps)).status,403);
assert.equal((await channelsRequest(req({action:'list'},undefined,''),env,deps)).status,401);
user={...admin,email:'someone@example.com'};assert.equal((await channelsRequest(req({action:'list'}),env,deps)).status,403);
user={...admin,emailVerified:false};assert.equal((await channelsRequest(req({action:'list'}),env,deps)).status,403);
user=admin;
const failure=await channelsRequest(req({action:'verify',chat_id:id}),env,{...deps,api:async()=>{throw new Error('secret-token-must-not-escape')}});
assert.equal(failure.status,503);assert(!(await failure.text()).includes('secret-token'));
assert.equal((await channelsRequest(req({action:'list',padding:'x'.repeat(2100)}),env,deps)).status,413);
console.log('PASS: channel discovery, numeric IDs, admin authentication, permissions, multiple channels, stored message IDs, test and real post/edit/delete, concurrency, duplicate prevention, crash ambiguity and secret-safe errors (all mocked; no live messages)');
