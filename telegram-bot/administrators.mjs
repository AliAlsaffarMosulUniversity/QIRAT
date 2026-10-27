// Roles are server-owned. No directory lookup or client-supplied verification flags.
export const OWNER_EMAIL = 'ali_alsaffar@uomosul.edu.iq';
export const emailKey = value => String(value || '').trim().toLowerCase();
export function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value) && !value.includes('..'); }
export function normalizePhone(value) {
  const phone = String(value || '').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()-]/g,'');
  return /^\+[1-9][0-9]{7,14}$/.test(phone) ? phone : null;
}
const verifiedGoogle = user => !!user?.localId && user.emailVerified === true && user.providerUserInfo?.some(p=>p.providerId==='google.com') && validEmail(emailKey(user.email));
export const isOwner = user => verifiedGoogle(user) && emailKey(user.email) === OWNER_EMAIL;
export function activeRole(user, data) {
  return verifiedGoogle(user) && data?.email === emailKey(user.email) && data?.uid === user.localId && data.active === true && data.whatsappVerified === true && data.telegramVerified === true;
}
const pathFor = email => '_qiratAdmins/' + email;
export async function administrator(user, store) {
  if (isOwner(user)) return true;
  if (!verifiedGoogle(user)) return false;
  return activeRole(user, (await store.get(pathFor(emailKey(user.email))))?.data);
}
export class AdminError extends Error { constructor(message,status=400){super(message);this.status=status;} }
function requireValue(ok, message, status=400) { if (!ok) throw new AdminError(message,status); }
export function verificationConfigured(env) {
  return !!env.WHATSAPP_APP_SECRET && !!env.WHATSAPP_VERIFY_TOKEN && /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID || '') && !!normalizePhone(env.WHATSAPP_BUSINESS_PHONE) && /^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_USERNAME || '') && !!env.TELEGRAM_BOT_TOKEN && /^[A-Za-z0-9_-]{24,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET||'');
}
const newNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
export async function adminAction(body,user,env,store) {
  requireValue(verifiedGoogle(user),'google_sign_in_required',403);
  const ownEmail=emailKey(user.email), action=body?.action;
  const own=await store.get(pathFor(ownEmail));
  const admin=isOwner(user)||activeRole(user,own?.data);
  if(action==='status') return {owner:isOwner(user),administrator:admin,invitation:own?.data || null,verificationReady:verificationConfigured(env)};
  if(action==='start-verification') {
    requireValue(own?.data && own.data.status==='pending' && !own.data.active,'invitation_required',403);
    requireValue(verificationConfigured(env),'verification_not_configured',503);
    const nonce=newNonce(), now=Date.now(), expiresAt=now+30*60*1000;
    const challenge={nonce,email:ownEmail,uid:user.localId,phone:own.data.phone,generation:own.data.generation,expiresAt,telegramVerified:false,whatsappVerified:false,telegramUserId:''};
    requireValue(await store.commit([
      store.put('_qiratAdminChallenges/'+nonce,challenge,null),
      store.put(pathFor(ownEmail),{...own.data,uid:user.localId,challengeId:nonce,telegramVerified:false,whatsappVerified:false},own)
    ]),'conflict',409);
    return {telegramUrl:'https://t.me/'+env.TELEGRAM_BOT_USERNAME+'?start=qv_'+nonce,whatsappUrl:'https://wa.me/'+normalizePhone(env.WHATSAPP_BUSINESS_PHONE).slice(1)+'?text='+encodeURIComponent('QIRAT '+nonce),expiresAt};
  }
  requireValue(admin,'administrator_required',403);
  if(action==='list') return {items:await store.list('_qiratAdmins'),ownerEmail:OWNER_EMAIL,verificationReady:verificationConfigured(env)};
  requireValue(['add','revoke'].includes(action),'invalid_action');
  const email=emailKey(body.email);
  requireValue(validEmail(email),'invalid_email');
  requireValue(email!==OWNER_EMAIL,'owner_protected',403);
  requireValue(email!==ownEmail,'cannot_revoke_self',403);
  const previous=await store.get(pathFor(email)),now=Date.now();
  let data;
  if(action==='add') {
    const phone=normalizePhone(body.phone);requireValue(phone,'invalid_phone');
    requireValue(!previous?.data?.active && previous?.data?.status!=='pending','already_invited',409);
    data={email,phone,uid:'',active:false,status:'pending',generation:crypto.randomUUID(),whatsappVerified:false,telegramVerified:false,challengeId:'',createdBy:ownEmail,createdAt:now,updatedAt:now};
  } else {
    requireValue(previous,'not_found',404);
    data={...previous.data,active:false,status:'revoked',whatsappVerified:false,telegramVerified:false,challengeId:'',updatedAt:now,revokedBy:ownEmail};
  }
  const writes=[store.put(pathFor(email),data,previous),store.put('_qiratAdminAudit/'+crypto.randomUUID(),{actor:ownEmail,action,target:email,at:now},null)];
  // Guard delegated authorization against concurrent revocation.
  if(!isOwner(user))writes.push(store.put(pathFor(ownEmail),own.data,own));
  requireValue(await store.commit(writes),'conflict',409);
  return {item:data};
}
export async function recordProof(nonce,kind,identity,store) {
  if(!/^[a-f0-9]{48}$/.test(nonce)||!['telegram','whatsapp'].includes(kind))return false;
  for(let attempt=0;attempt<3;attempt++){
    const challenge=await store.get('_qiratAdminChallenges/'+nonce),c=challenge?.data;
    if(!c || c.expiresAt<=Date.now() || c.phone!==normalizePhone(identity.phone))return false;
    if(kind==='telegram' && c.telegramUserId!==String(identity.userId))return false;
    const invitation=await store.get(pathFor(c.email)),d=invitation?.data;
    if(!d || d.status!=='pending'||d.challengeId!==nonce||d.generation!==c.generation||d.uid!==c.uid||d.phone!==c.phone)return false;
    const next={...c,[kind+'Verified']:true};
    const complete=next.telegramVerified===true&&next.whatsappVerified===true;
    const role={...d,telegramVerified:next.telegramVerified,whatsappVerified:next.whatsappVerified,active:complete,status:complete?'active':'pending',updatedAt:Date.now()};
    if(await store.commit([store.put('_qiratAdminChallenges/'+nonce,next,challenge),store.put(pathFor(c.email),role,invitation)]))return true;
  }
  return false;
}
// Only called after the existing Telegram webhook secret has been checked.
export async function telegramVerification(update,env,store,api) {
  const m=update.message;
  if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.from?.id)||m.chat.id!==m.from.id)return false;
  const nonce=m.text?.match(/^\/start(?:@\w+)? qv_([a-f0-9]{48})$/)?.[1];
  if(nonce){
    const path='_qiratAdminChallenges/'+nonce,challenge=await store.get(path),c=challenge?.data;
    if(!c||c.expiresAt<=Date.now())return true;
    const invitation=await store.get(pathFor(c.email));
    if(invitation?.data?.status!=='pending'||invitation.data.challengeId!==nonce||invitation.data.generation!==c.generation)return true;
    if(c.telegramUserId && c.telegramUserId!==String(m.from.id))return true;
    const previous=await store.get('_qiratAdminTelegramLinks/'+m.from.id);
    if(!await store.commit([store.put(path,{...c,telegramUserId:String(m.from.id)},challenge),store.put('_qiratAdminTelegramLinks/'+m.from.id,{nonce,expiresAt:c.expiresAt},previous)]))return true;
    await api('sendMessage',{chat_id:m.chat.id,text:'لإثبات ارتباط رقمك بتليكرام، اضغط مشاركة رقمي. يجب أن يطابق رقم الدعوة في قيراط.',reply_markup:JSON.stringify({keyboard:[[{text:'مشاركة رقمي',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true})});
    return true;
  }
  if(m.contact){
    const link=await store.get('_qiratAdminTelegramLinks/'+m.from.id);
    if(!link || link.data.expiresAt<=Date.now())return false;
    const ok=m.contact.user_id===m.from.id&&!m.forward_origin && await recordProof(link.data.nonce,'telegram',{phone:'+'+String(m.contact.phone_number).replace(/^\+/,''),userId:m.from.id},store);
    await api('sendMessage',{chat_id:m.chat.id,text:ok?'تم التحقق من رقم تليكرام. أكمل تحقق واتساب ثم حدّث الحالة في قيراط.':'لم يتطابق رقمك أو انتهت صلاحية الطلب. أعد بدء التحقق من قيراط.',reply_markup:JSON.stringify({remove_keyboard:true})});
    return true;
  }
  return false;
}
async function boundedText(request,max){
  const reader=request.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
  if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new AdminError('too_large',413);}text+=decoder.decode(value,{stream:true});}
  return text+decoder.decode();
}
export async function adminRequest(request,env,{lookupUser,makeStore}) {
  const origin=new URL(env.APP_URL).origin;
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin'};
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(request.headers.get('Origin')!==origin)return respond({error:'forbidden'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/)?.[1];if(!token)return respond({error:'sign_in_required'},401);
  try {
    const user=await lookupUser(token);if(!verifiedGoogle(user))return respond({error:'google_sign_in_required'},403);
    let body;try{body=JSON.parse(await boundedText(request,4096));}catch(e){if(e instanceof AdminError)throw e;throw new AdminError('invalid_request');}
    return respond(await adminAction(body,user,env,await makeStore()));
  }catch(e){return respond({error:e instanceof AdminError?e.message:'administration_unavailable'},e instanceof AdminError?e.status:503);}
}
export async function whatsappVerification(request,env,makeStore){
  if(!verificationConfigured(env))return new Response('Not configured',{status:503});
  const url=new URL(request.url);
  if(request.method==='GET')return url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===env.WHATSAPP_VERIFY_TOKEN?new Response(url.searchParams.get('hub.challenge')||''):new Response('Forbidden',{status:403});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  try{
    const raw=await boundedText(request,131072),signature=request.headers.get('X-Hub-Signature-256')||'';
    if(!/^sha256=[a-f0-9]{64}$/.test(signature))return new Response('Forbidden',{status:403});
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.WHATSAPP_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const bytes=Uint8Array.from(signature.slice(7).match(/../g),v=>parseInt(v,16));
    if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(raw)))return new Response('Forbidden',{status:403});
    const body=JSON.parse(raw);if(body.object!=='whatsapp_business_account')return new Response('OK');
    const store=await makeStore();
    for(const entry of body.entry||[])for(const change of entry.changes||[]){
      const v=change.value;if(change.field!=='messages'||v?.metadata?.phone_number_id!==env.WHATSAPP_PHONE_NUMBER_ID)continue;
      for(const message of v.messages||[]){
        const nonce=message.type==='text'&&message.text?.body?.trim().match(/^QIRAT ([a-f0-9]{48})$/)?.[1];
        if(nonce)await recordProof(nonce,'whatsapp',{phone:'+'+String(message.from).replace(/^\+/,'')},store);
      }
    }
    return new Response('OK');
  }catch(e){return new Response('Unavailable',{status:e instanceof AdminError?e.status:503});}
}

