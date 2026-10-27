import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OWNER_EMAIL,adminAction,administrator,activeRole,normalizePhone,recordProof,telegramVerification,whatsappVerification,adminRequest} from './administrators.mjs';
class Store {
  rows=new Map(); revision=0;
  async get(path){return structuredClone(this.rows.get(path)||null);}
  async list(path){return [...this.rows].filter(([k])=>k.startsWith(path+'/')).map(([,v])=>structuredClone(v.data));}
  put(path,data,previous){return {path,data,version:previous?.updateTime||null};}
  async commit(writes){
    if(writes.some(w=>(this.rows.get(w.path)?.updateTime||null)!==w.version))return false;
    for(const w of writes)this.rows.set(w.path,{data:structuredClone(w.data),updateTime:String(++this.revision)});
    return true;
  }
}
const user=email=>({localId:email.split('@')[0],email,emailVerified:true,providerUserInfo:[{providerId:'google.com'}]});
const owner=user(OWNER_EMAIL),alice=user('alice@example.com'),bob=user('bob@example.com');
const env={APP_URL:'https://example.com/',WHATSAPP_APP_SECRET:'test-only-secret',WHATSAPP_VERIFY_TOKEN:'test-verify',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_BUSINESS_PHONE:'+9647701234567',TELEGRAM_BOT_USERNAME:'QiratTestBot',TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_WEBHOOK_SECRET:'test-only-secret-with-24-characters'};
async function invite(store,target=alice){await adminAction({action:'add',email:target.email,phone:'+9647701111111'},owner,env,store);}
async function challenge(store,target=alice){const result=await adminAction({action:'start-verification'},target,env,store);return new URL(result.telegramUrl).searchParams.get('start').slice(3);}
async function bind(store,nonce,id=42){const sent=[];await telegramVerification({message:{chat:{id,type:'private'},from:{id},text:'/start qv_'+nonce}},env,store,async(m,b)=>sent.push(b));assert.equal(JSON.parse(sent[0].reply_markup).keyboard[0][0].request_contact,true);}
test('owner protected, email verified, normalized phones, no client verification or self promotion',async()=>{
  const s=new Store();assert.equal(normalizePhone('+٩٦٤ ٧٧٠١١١١١١١'),' +9647701111111'.trim());assert.equal(normalizePhone('07701111111'),null);
  await assert.rejects(adminAction({action:'add',email:OWNER_EMAIL,phone:'+9647701111111'},owner,env,s),/owner_protected/);
  await assert.rejects(adminAction({action:'revoke',email:OWNER_EMAIL},owner,env,s),/owner_protected/);
  await assert.rejects(adminAction({action:'add',email:bob.email,phone:'+9647701111111'},alice,env,s),/administrator_required/);
  await assert.rejects(adminAction({action:'status'},{...owner,emailVerified:false},env,s),/google_sign_in_required/);
  await adminAction({action:'add',email:' ALICE@EXAMPLE.COM ',phone:'+9647701111111',active:true,telegramVerified:true,whatsappVerified:true},owner,env,s);
  assert.equal(await administrator(alice,s),false);assert.equal((await s.get('_qiratAdmins/'+alice.email)).data.active,false);
  assert.equal(await administrator(owner,s),true);
});
test('two official proofs for same invited phone activate; other admins can add/revoke; owner cannot be revoked',async()=>{
  const s=new Store();await invite(s);const nonce=await challenge(s);await bind(s,nonce);
  assert.equal(await recordProof(nonce,'telegram',{phone:'+9647702222222',userId:42},s),false);
  assert.equal(await recordProof(nonce,'telegram',{phone:'+9647701111111',userId:43},s),false);
  assert.equal(await recordProof(nonce,'telegram',{phone:'+9647701111111',userId:42},s),true);
  assert.equal(await administrator(alice,s),false);
  assert.equal(await recordProof(nonce,'whatsapp',{phone:'+9647701111111'},s),true);
  assert.equal(await administrator(alice,s),true);
  assert.equal(activeRole({...alice,localId:'impostor'},(await s.get('_qiratAdmins/'+alice.email)).data),false);
  await adminAction({action:'add',email:bob.email,phone:'+9647703333333'},alice,env,s);
  await assert.rejects(adminAction({action:'revoke',email:OWNER_EMAIL},alice,env,s),/owner_protected/);
  await adminAction({action:'revoke',email:bob.email},alice,env,s);
  await adminAction({action:'revoke',email:alice.email},owner,env,s);
  assert.equal(await administrator(alice,s),false);
  await assert.rejects(adminAction({action:'add',email:bob.email,phone:'+9647703333333'},alice,env,s),/administrator_required/);
});
test('missing setup, restarted, revoked, expired and replayed challenges fail closed',async()=>{
  const s=new Store();await invite(s);
  await assert.rejects(adminAction({action:'start-verification'},alice,{},s),/verification_not_configured/);
  const old=await challenge(s),fresh=await challenge(s);
  assert.equal(await recordProof(old,'whatsapp',{phone:'+9647701111111'},s),false);
  const c=await s.get('_qiratAdminChallenges/'+fresh);c.data.expiresAt=Date.now()-1;await s.commit([s.put('_qiratAdminChallenges/'+fresh,c.data,c)]);
  assert.equal(await recordProof(fresh,'whatsapp',{phone:'+9647701111111'},s),false);
  const nonce=await challenge(s);await adminAction({action:'revoke',email:alice.email},owner,env,s);
  assert.equal(await recordProof(nonce,'whatsapp',{phone:'+9647701111111'},s),false);
});
test('Telegram rejects other contact identities and forwarded contacts',async()=>{
  const s=new Store();await invite(s);const nonce=await challenge(s);await bind(s,nonce);
  const base={chat:{id:42,type:'private'},from:{id:42},contact:{phone_number:'9647701111111',user_id:43}};
  await telegramVerification({message:base},env,s,async()=>{});
  assert.equal((await s.get('_qiratAdminChallenges/'+nonce)).data.telegramVerified,false);
  await telegramVerification({message:{...base,contact:{...base.contact,user_id:42},forward_origin:{type:'user'}}},env,s,async()=>{});
  assert.equal((await s.get('_qiratAdminChallenges/'+nonce)).data.telegramVerified,false);
});
test('WhatsApp authenticates webhook signature, configured receiver and phone before proof',async()=>{
  const s=new Store();await invite(s);const nonce=await challenge(s);
  const payload=id=>JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:id},messages:[{type:'text',from:'9647701111111',text:{body:'QIRAT '+nonce}}]}}]}]});
  const sign=async raw=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.WHATSAPP_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'sha256='+Buffer.from(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(raw))).toString('hex');};
  const req=(raw,sig)=>new Request('https://example.com/whatsapp-verification',{method:'POST',headers:{'X-Hub-Signature-256':sig},body:raw});
  const raw=payload('123');assert.equal((await whatsappVerification(req(raw,'sha256='+'0'.repeat(64)),env,async()=>s)).status,403);
  const other=payload('456');await whatsappVerification(req(other,await sign(other)),env,async()=>s);
  assert.equal((await s.get('_qiratAdminChallenges/'+nonce)).data.whatsappVerified,false);
  await whatsappVerification(req(raw,await sign(raw)),env,async()=>s);
  assert.equal((await s.get('_qiratAdminChallenges/'+nonce)).data.whatsappVerified,true);
  assert.equal(await administrator(alice,s),false);
});
test('HTTP administration blocks missing credentials and foreign origins',async()=>{
  const deps={lookupUser:async()=>owner,makeStore:async()=>new Store()};
  const req=origin=>new Request('https://worker.example/administrators',{method:'POST',headers:{Origin:origin},body:'{}'});
  assert.equal((await adminRequest(req('https://evil.example'),env,deps)).status,403);
  assert.equal((await adminRequest(req('https://example.com'),env,deps)).status,401);
});

