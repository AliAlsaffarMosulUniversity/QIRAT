// QIRAT Telegram bridge. No credentials belong in this file.
import { channelAction, rememberChannel, ChannelError } from './channels.mjs';
const encoder = new TextEncoder();
const tokenCache = new Map();
const numeric = text => String(text || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
const clean = text => numeric(text).replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/\r/g,'').replace(/[\u200e\u200f]/g,'').trim();
const escapeHtml = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const [y,m,d] = match.slice(1).map(Number), date = new Date(Date.UTC(y,m-1,d));
  return y >= 1900 && y <= 2199 && date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d;
}
export function parseTime(text) {
  const s = clean(text);
  const match = /^(\d{1,2})[:٫.](\d{2})\s*(ص|م|am|pm)?$/i.exec(s);
  if (!match) return null;
  let h = Number(match[1]), m = Number(match[2]);
  const suffix = (match[3] || '').toLowerCase();
  if (m > 59 || h > 23 || (suffix && (h < 1 || h > 12))) return null;
  if (suffix) h = h % 12 + (['م','pm'].includes(suffix) ? 12 : 0);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function baghdadDate(seconds, offset=0) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(seconds*1000));
  const get = key => parts.find(p=>p.type===key).value;
  return new Date(Date.UTC(+get('year'),+get('month')-1,+get('day')+offset)).toISOString().slice(0,10);
}
function lineField(text, label) { return text.match(new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*[:：]\\s*([^\\n]+)`,'i'))?.[1]?.trim(); }
function trimName(text) { return (text || '').replace(/^[\s*،:]+|[\s*،.]+$/g,'').trim(); }
export function parseAnnouncement(text, timestamp, defaultCity='الموصل') {
  const s = clean(text), d = { city:defaultCity, area:'', map:'', cemetery:'', notes:'' };
  d.name = lineField(s,'اسم المتوف[ىي]|الاسم');
  const gender = lineField(s,'الجنس');
  if (/امرأة|إمرأة|امراة|أنثى|انثى|متوفاة/.test(gender || s)) d.gender='female';
  else if (/رجل|ذكر|متوفى/.test(gender || '') || /(?:على|علي)\s*\(?(?:رجل|ذكر)\)?/.test(s)) d.gender='male';
  if (!d.name) {
    const person=s.match(/(?:صلاة\s+الجنازة\s+على)\s+(.+?)(?=\s+(?:اليوم|يوم|غدا|غداً|بتاريخ)|\n)/)?.[1];
    if (person && !/^[\s()]*[إا]مر[اأ]?ة[\s()]*$/.test(person)) d.name=trimName(person);
  }
  if (!d.name && d.gender) d.name=d.gender==='female'?'متوفاة — الاسم غير مذكور':'متوفى — الاسم غير مذكور';
  const date=s.match(/\b(20\d{2}|21\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (date) {const value=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;if(validDate(value))d.date=value;}
  else if (/غدا|غداً/.test(s)) d.date=baghdadDate(timestamp,1);
  else if (/اليوم/.test(s)) d.date=baghdadDate(timestamp);
  const time=lineField(s,'وقت الصلاة|الوقت|الساعة') || s.match(/الساعة\s+(\d{1,2}[:٫.]\d{2}\s*(?:ص|م|am|pm)?)/i)?.[1];
  if(time)d.time=parseTime(time);
  const prayer=s.match(/بعد\s+(?:صلاة\s+)?(الفجر|الظهر|العصر|المغرب|العشاء|الجمعة)/);
  if(prayer)d.relativeTime='بعد صلاة '+prayer[1];
  const prayerName=lineField(s,'وقت الصلاة|الصلاة')||prayer?.[1];
  const prayers={'الفجر':'fajr','الظهر':'dhuhr','العصر':'asr','المغرب':'maghrib','العشاء':'isha','الجمعة':'dhuhr'};
  if(prayerName)d.prayer=prayers[Object.keys(prayers).find(name=>prayerName.includes(name))];
  d.mosque=trimName(lineField(s,'اسم الجامع|الجامع|المسجد') || s.match(/في\s+\*?((?:جامع|مسجد)\s+.+?)(?=\s+\*?حي\s|\s+والدفن|\n|\s+وهذا|https?:|$)/)?.[1]);
  d.area=trimName(lineField(s,'الحي|المنطقة') || s.match(/(?:\s|^)حي\s+(.+?)(?=\s+والدفن|\n|\s+وهذا|https?:|$)/)?.[1]);
  d.cemetery=trimName(lineField(s,'اسم المقبرة|المقبرة') || s.match(/(?:والدفن|الدفن)\s+في\s+مقبرة\s+(.+?)(?=\n|\s+وهذا|\s+موقع|\s+دعوات|https?:|$)/)?.[1]);
  d.city=trimName(lineField(s,'المدينة') || defaultCity);
  d.map=s.match(/https:\/\/(?:maps\.app\.goo\.gl|maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps)\/[^\s<>]+/)?.[0]?.replace(/[)،.,]+$/,'') || '';
  return d;
}
const prayerLabels={fajr:'الفجر',dhuhr:'الظهر',asr:'العصر',maghrib:'المغرب',isha:'العشاء'};
const questions={name:'ما اسم المتوفى؟ إذا لم يُذكر الاسم أرسل «غير مذكور».',gender:'هل الجنازة لذكر أم أنثى؟ أرسل «ذكر» أو «أنثى».',mosque:'ما اسم الجامع؟',date:'ما تاريخ الصلاة؟ أرسله بصيغة 2026-10-26.',prayer:'بعد أي صلاة؟ أرسل الفجر أو الظهر أو العصر أو المغرب أو العشاء.'};
const missing = draft => Object.keys(questions).find(key=>!draft[key]);
export function answerDraft(session,text) {
  const draft={...session.draft}, field=session.expected, value=clean(text);
  if(field==='date'){const v=value.replace(/\//g,'-');if(!validDate(v))return null;draft.date=v;}
  else if(field==='time'){draft.time=parseTime(value);if(!draft.time)return null;}
  else if(field==='prayer'){draft.prayer=Object.keys(prayerLabels).find(key=>value.includes(prayerLabels[key]));if(!draft.prayer)return null;}
  else if(field==='gender'){if(/^(أنثى|انثى|امرأة|إمرأة)$/.test(value))draft.gender='female';else if(/^(ذكر|رجل)$/.test(value))draft.gender='male';else return null;if(draft.name?.endsWith('— الاسم غير مذكور'))draft.name=draft.gender==='female'?'متوفاة — الاسم غير مذكور':'متوفى — الاسم غير مذكور';}
  else if(field==='name')draft.name=value==='غير مذكور'?'متوفى — الاسم غير مذكور':value;
  else if(field==='mosque')draft.mosque=value;
  return draft;
}
export function validateDraft(d) {
  return !!d && typeof d.name==='string' && d.name.length>0 && d.name.length<=120 && ['male','female'].includes(d.gender)
    && typeof d.mosque==='string' && d.mosque.length>0 && d.mosque.length<=120 && typeof d.city==='string' && d.city.length>0 && d.city.length<=80
    && validDate(d.date) && !!prayerLabels[d.prayer] && (d.area||'').length<=100 && (d.cemetery||'').length<=120
    && (d.map||'').length<=2000 && (!d.map || /^https:\/\//.test(d.map));
}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function accessToken(env) {
  const sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if(sa.project_id!==env.FIREBASE_PROJECT_ID || !sa.client_email || !sa.private_key)throw new Error('service_account_configuration');
  const cached=tokenCache.get(sa.client_email);if(cached&&cached.expires>Date.now()+60000)return cached.token;
  const now=Math.floor(Date.now()/1000), header=b64url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=b64url(encoder.encode(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
  const keyBytes=Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',keyBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const assertion=header+'.'+payload+'.'+b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(header+'.'+payload)));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('google_auth_failed');const result=await response.json();
  if(!result.access_token)throw new Error('google_auth_failed');tokenCache.set(sa.client_email,{token:result.access_token,expires:Date.now()+result.expires_in*1000});return result.access_token;
}
function encodeValue(value) {
  if(value===null)return {nullValue:null};if(typeof value==='boolean')return {booleanValue:value};if(typeof value==='number')return {integerValue:String(value)};
  if(typeof value==='object')return {mapValue:{fields:encodeFields(value)}};return {stringValue:String(value)};
}
function encodeFields(value){return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encodeValue(v)]));}
function decodeValue(value){if('mapValue'in value)return decodeFields(value.mapValue.fields||{});if('integerValue'in value)return Number(value.integerValue);if('booleanValue'in value)return value.booleanValue;if('nullValue'in value)return null;return value.stringValue??value.timestampValue;}
function decodeFields(fields){return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,decodeValue(v)]));}
class Store {
  constructor(env,token){this.env=env;this.token=token;this.root=`projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;}
  async list(path){
    const items=[];let page='';
    do {
      const r=await fetch(`https://firestore.googleapis.com/v1/${this.root}/${path}?pageSize=100${page?'&pageToken='+encodeURIComponent(page):''}`,{headers:{Authorization:'Bearer '+this.token},signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw new Error('firestore_read_failed');const data=await r.json();
      items.push(...(data.documents||[]).map(d=>decodeFields(d.fields||{})));page=data.nextPageToken||'';
      if(items.length>=1000&&page)throw new Error('registry_limit');
    }while(page);return items;
  }
  async get(path){const r=await fetch(`https://firestore.googleapis.com/v1/${this.root}/${path}`,{headers:{Authorization:'Bearer '+this.token},signal:AbortSignal.timeout(12000)});if(r.status===404)return null;if(!r.ok)throw new Error('firestore_read_failed');const d=await r.json();return {data:decodeFields(d.fields||{}),updateTime:d.updateTime};}
  put(path,data,previous,stamps=[]){return {update:{name:this.root+'/'+path,fields:encodeFields(data)},currentDocument:previous?{updateTime:previous.updateTime}:{exists:false},...(stamps.length?{updateTransforms:stamps.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}:{})};}
  async commit(writes){const r=await fetch(`https://firestore.googleapis.com/v1/${this.root}:commit`,{method:'POST',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},body:JSON.stringify({writes}),signal:AbortSignal.timeout(12000)});if([409,412].includes(r.status))return false;if(!r.ok)throw new Error('firestore_write_failed');return true;}
}
async function telegram(env,method,body){const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('telegram_request_failed');const d=await r.json();if(!d.ok)throw new Error('telegram_request_failed');return d.result;}
const send = (env,id,text) => telegram(env,'sendMessage',{chat_id:id,text,link_preview_options:{is_disabled:true}});
const link = (env,id) => (env.APP_URL || 'https://alialsaffarmosuluniversity.github.io/QIRAT/').split('#')[0]+'#announcement='+id;
async function fingerprint(draft){const text=JSON.stringify([draft.name,draft.gender,draft.city,draft.area,draft.mosque,draft.date,draft.prayer,draft.cemetery]);return b64url(await crypto.subtle.digest('SHA-256',encoder.encode(text)));}
export async function processUpdate(update,env,store,reply=(id,text)=>send(env,id,text)) {
  const message=update.message;
  if(!message || message.chat?.type!=='private' || !Number.isSafeInteger(update.update_id) || !Number.isSafeInteger(message.from?.id))return;
  const admin=String(env.TELEGRAM_ADMIN_ID||'');
  if(String(message.from.id)!==admin){if(message.text==='/start')await reply(message.chat.id,'بوت قيراط مخصص للمدير. معرّف حسابك: '+message.from.id);return;}
  const text=message.text||message.caption||'',markerPath='_qiratTelegramUpdates/'+update.update_id,sessionPath='_qiratTelegramSessions/'+admin;
  for(let attempt=0;attempt<3;attempt++){
    if(await store.get(markerPath))return;
    const previous=await store.get(sessionPath),state=previous?.data||{},now=Date.now();
    let next={...state},response='',draft=null;
    if(/^\/(start|help)(?:@\w+)?$/.test(text))response='أرسل أو حوّل تبليغ الجنازة نصياً أو بصورة مع تعليق. أنشره في قيراط عند اكتمال البيانات، وأسألك عن الناقص.\n/cancel لإلغاء التبليغ الجاري\n/status لمعرفة آخر إعلان\n/new لبدء تبليغ جديد.\nيرجى التأكد من صحة التبليغ وموافقة ذوي المتوفى قبل الإرسال.';
    else if(/^\/(cancel|new)(?:@\w+)?$/.test(text)){next={lastPublished:state.lastPublished||'',expiresAt:now};response='تم إلغاء البيانات المعلقة. أرسل تبليغاً جديداً.';}
    else if(/^\/status(?:@\w+)?$/.test(text))response=state.expected&&state.expiresAt>now?'التبليغ ينتظر: '+questions[state.expected]:state.lastPublished?'آخر إعلان منشور:\n'+link(env,state.lastPublished):'لا توجد بيانات معلقة أو إعلانات منشورة من هذا البوت بعد.';
    else if(!text.trim())response='أرسل نص التبليغ أو صورة تحتوي على تعليق نصي؛ الصور وحدها لا تُقرأ آلياً.';
    else if(text.length>12000)response='التبليغ طويل جداً. أرسل إعلاناً واحداً في كل رسالة.';
    else if(state.expected&&state.expiresAt>now){draft=answerDraft(state,text);if(!draft)response='القيمة غير واضحة. '+questions[state.expected];}
    else draft=parseAnnouncement(text,message.date||Math.floor(now/1000),env.DEFAULT_CITY||'الموصل');
    let announcementId=null,announcement=null,fp=null,duplicate=null;
    if(draft){const field=missing(draft);if(field){next={...state,draft,expected:field,expiresAt:now+86400000};response=questions[field];}
      else if(!validateDraft(draft)){next={lastPublished:state.lastPublished||'',expiresAt:now};response='تعذر نشر التبليغ لأن إحدى القيم غير صحيحة أو طويلة. أعد إرساله مع اسم جامع واضح وتاريخ ووقت صحيحين.';}
      else {fp=await fingerprint(draft);duplicate=await store.get('_qiratTelegramDuplicates/'+fp);if(duplicate){announcementId=duplicate.data.announcementId;response='هذا التبليغ مسجل مسبقاً:\n'+link(env,announcementId);}
        else {announcementId=crypto.randomUUID();announcement={id:announcementId,name:draft.name,gender:draft.gender,city:draft.city,area:draft.area||'',mosque:draft.mosque,datetime:draft.date+'T00:00',prayer:draft.prayer,map:draft.map||'',notes:draft.relativeTime||'',status:'published',ownerUid:'telegram:'+admin,...(draft.cemetery?{cemetery:draft.cemetery}:{})};response='تم نشر الإعلان في قيراط:\n'+draft.name+'\n'+draft.mosque+'\n'+draft.date+' — صلاة '+prayerLabels[draft.prayer]+(draft.cemetery?'\nالمقبرة: '+draft.cemetery:'')+'\n'+link(env,announcementId);}
        next={lastPublished:announcementId,expiresAt:now};
      }
    }
    const writes=[store.put(markerPath,{processedAt:now},null),store.put(sessionPath,next,previous)];
    if(announcement){writes.push(store.put('announcements/'+announcementId,announcement,null,['createdAt','updatedAt']));writes.push(store.put('_qiratTelegramDuplicates/'+fp,{announcementId,createdAt:now},null));}
    if(await store.commit(writes)){if(response)await reply(message.chat.id,response);return;}
  }
  throw new Error('concurrent_update_retry');
}
function setupPage(){return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ربط بوت قيراط</title><style>body{font:18px Tahoma;background:#101010;color:#f3d58e;max-width:620px;margin:60px auto;padding:24px}input,button{font:inherit;padding:12px;margin:10px 0;width:100%;box-sizing:border-box}p{line-height:1.9}</style><h1>ربط بوت قيراط</h1><p>بعد إضافة الأسرار في إعدادات Cloudflare، أدخل قيمة TELEGRAM_WEBHOOK_SECRET لتفعيل استقبال الرسائل. لا تدخل مفتاح البوت هنا.</p><form action="/setup" method="post"><input type="password" name="secret" autocomplete="off" required placeholder="TELEGRAM_WEBHOOK_SECRET"><button>تفعيل الربط</button></form><p>المفتاح لا يظهر في عنوان الصفحة. البوت لا ينشر إلا الرسائل المحولة من حساب المدير المحدد في الإعدادات.</p></html>`;}
function output(text,status=200,type='text/plain; charset=utf-8'){return new Response(text,{status,headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'Referrer-Policy':'same-origin'}});}
export async function registerMember(uid,store){
  const memberPath='_qiratMembers/'+uid;
  for(let attempt=0;attempt<3;attempt++){
    const member=await store.get(memberPath),stats=await store.get('stats/users');
    const count=Number(stats?.data?.count||0);if(!Number.isSafeInteger(count)||count<0)throw new Error('invalid_counter');
    if(member)return count;
    if(await store.commit([store.put(memberPath,{registeredAt:Date.now()},null),store.put('stats/users',{count:count+1},stats,['updatedAt'])]))return count+1;
  }
  throw new Error('counter_conflict');
}
async function registerRequest(request,env){
  const origin=new URL(env.APP_URL||'https://alialsaffarmosuluniversity.github.io/QIRAT/').origin;
  const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'};
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
  if(request.headers.get('Origin')!==origin)return respond({error:'forbidden'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)return respond({error:'configuration_required'},503);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/)?.[1];if(!token)return respond({error:'sign_in_required'},401);
  try{
    const apiKey=env.FIREBASE_WEB_API_KEY||'AIzaSyB-opp6w-TfZCvfHNmXc_o3CMR6mjOkvdQ';
    const lookup=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(12000)});
    if(!lookup.ok)return respond({error:'invalid_sign_in'},401);
    const user=(await lookup.json()).users?.[0];if(!user?.localId||!user.emailVerified||!user.providerUserInfo?.some(p=>p.providerId==='google.com')||!/^[-A-Za-z0-9_]{1,128}$/.test(user.localId))return respond({error:'google_sign_in_required'},403);
    const count=await registerMember(user.localId,new Store(env,await accessToken(env)));return respond({count});
  }catch{return respond({error:'registration_unavailable'},503);}
}

export async function registerVisitor(id,store){
  const path='_qiratVisitors/'+id;
  for(let attempt=0;attempt<5;attempt++){
    const visitor=await store.get(path),stats=await store.get('stats/visitors');
    const count=Number(stats?.data?.count||0);
    if(!Number.isSafeInteger(count)||count<0||count>=Number.MAX_SAFE_INTEGER)throw new Error('invalid_counter');
    if(visitor)return count;
    if(await store.commit([store.put(path,{registered:true},null),store.put('stats/visitors',{count:count+1},stats,['updatedAt'])]))return count+1;
  }
  throw new Error('counter_conflict');
}
export async function visitorRequest(request,env,makeStore=async()=>new Store(env,await accessToken(env))){
  const origin=new URL(env.APP_URL||'https://alialsaffarmosuluniversity.github.io/QIRAT/').origin;
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'};
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(request.headers.get('Origin')!==origin)return respond({error:'forbidden'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(request.method))return respond({error:'method_not_allowed'},405);
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)return respond({error:'configuration_required'},503);
  try{
    let id;
    if(request.method==='POST'){
      if(Number(request.headers.get('Content-Length')||0)>256)return respond({error:'too_large'},413);
      const raw=await request.text();if(raw.length>256)return respond({error:'too_large'},413);
      let body;try{body=JSON.parse(raw)}catch{return respond({error:'invalid_request'},400);}
      id=body?.visitorId;
      if(typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return respond({error:'invalid_visitor'},400);
      id=id.toLowerCase();
    }
    const store=await makeStore();
    const count=id?await registerVisitor(id,store):Number((await store.get('stats/visitors'))?.data?.count||0);
    if(!Number.isSafeInteger(count)||count<0)throw new Error('invalid_counter');
    return respond({count});
  }catch{return respond({error:'counter_unavailable'},503);}
}

export async function channelsRequest(request,env,dependencies={}){
  const origin=new URL(env.APP_URL||'https://alialsaffarmosuluniversity.github.io/QIRAT/').origin;
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(request.headers.get('Origin')!==origin)return respond({error:'forbidden'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.TELEGRAM_BOT_TOKEN)return respond({error:'configuration_required'},503);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/)?.[1];
  if(!token)return respond({error:'sign_in_required'},401);
  try{
    const lookupUser=dependencies.lookupUser|| (async token=>{
      const apiKey=env.FIREBASE_WEB_API_KEY||'AIzaSyB-opp6w-TfZCvfHNmXc_o3CMR6mjOkvdQ';
      const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(12000)});
      return r.ok?(await r.json()).users?.[0]:null;
    });
    const user=await lookupUser(token);
    if(!user?.localId||!user.emailVerified||user.email!=='ali_alsaffar@uomosul.edu.iq'||!user.providerUserInfo?.some(p=>p.providerId==='google.com'))return respond({error:'administrator_required'},403);
    if(Number(request.headers.get('Content-Length')||0)>2048)return respond({error:'too_large'},413);
    const raw=await request.text();if(raw.length>2048)return respond({error:'too_large'},413);
    let body;try{body=JSON.parse(raw)}catch{return respond({error:'invalid_request'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return respond({error:'invalid_request'},400);
    const store=await (dependencies.makeStore|| (async()=>new Store(env,await accessToken(env))))();
    return respond(await channelAction(body,env,store,dependencies.api|| ((method,body)=>telegram(env,method,body))));
  }catch(error){
    if(error instanceof ChannelError)return respond({error:error.message},error.status);
    return respond({error:'channels_unavailable'},503);
  }
}

export default {
  async fetch(request,env) {
    env={...env,FIREBASE_PROJECT_ID:env.FIREBASE_PROJECT_ID||'qirat-6f86e'};
    const url=new URL(request.url);
    if(url.pathname==='/channels')return channelsRequest(request,env);
    if(url.pathname==='/visitors')return visitorRequest(request,env);
    if(url.pathname==='/register-user')return registerRequest(request,env);
    if(url.pathname==='/'&&request.method==='GET')return output('QIRAT Telegram bridge — /setup');
    if(url.pathname==='/setup'&&request.method==='GET')return output(setupPage(),200,'text/html; charset=utf-8');
    if(!['/setup','/telegram'].includes(url.pathname)||request.method!=='POST')return output('Not found',404);
    if(Number(request.headers.get('content-length')||0)>65536)return output('Too large',413);
    if(!/^[A-Za-z0-9_-]{24,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET||'') || !env.TELEGRAM_BOT_TOKEN)return output('Configuration required',503);
    try {
      if(url.pathname==='/setup'){
        const origin=request.headers.get('origin');if(origin!==url.origin)return output('Setup origin mismatch. Open this page directly in your browser.',403);
        const setupBody=await request.text();if(setupBody.length>65536)return output('Too large',413);
        const form=new URLSearchParams(setupBody);if(!equal(form.get('secret'),env.TELEGRAM_WEBHOOK_SECRET))return output('Setup secret mismatch. Check the deployed secret value.',403);
        const configured=!!env.FIREBASE_SERVICE_ACCOUNT_JSON&&/^\d+$/.test(env.TELEGRAM_ADMIN_ID||'')&&/^[-a-z0-9]+$/.test(env.FIREBASE_PROJECT_ID||'');
        if(configured){const store=new Store(env,await accessToken(env));await store.get('_qiratTelegramHealth/check');}
        const existing=await telegram(env,'getWebhookInfo',{});if(existing.url&&existing.url!==url.origin+'/telegram')return output('للبوت ربط سابق مختلف. راجعه قبل استبداله.',409);
        await telegram(env,'setWebhook',{url:url.origin+'/telegram',secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','my_chat_member'],max_connections:1,drop_pending_updates:false});
        await telegram(env,'setMyCommands',{commands:[{command:'start',description:'بدء استقبال تبليغات قيراط'},{command:'cancel',description:'إلغاء التبليغ المعلق'},{command:'status',description:'آخر إعلان وحالة التبليغ'},{command:'new',description:'بدء تبليغ جديد'}]});
        return output(configured?'تم تفعيل الربط. افتح @QiratMosulAlertsBot وأرسل /start، ثم حوّل التبليغ.':'تم تفعيل استقبال /start لمعرفة رقم حسابك فقط. أرسل /start للبوت، ثم أضف TELEGRAM_ADMIN_ID وبيانات Firebase في الأسرار وأعد التفعيل من هذه الصفحة. النشر غير مفعّل بعد.');
      }
      if(!equal(request.headers.get('X-Telegram-Bot-Api-Secret-Token'),env.TELEGRAM_WEBHOOK_SECRET))return output('Forbidden',403);
      const raw=await request.text();if(raw.length>65536)return output('Too large',413);
      let update;try{update=JSON.parse(raw)}catch{return output('Invalid JSON',400)}
      if(update.my_chat_member?.chat?.type==='channel'){
        if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)return output('Configuration required',503);
        await rememberChannel(update,env,new Store(env,await accessToken(env)));return output('OK');
      }
      if(update.message?.chat?.type!=='private'||String(update.message?.from?.id)!==String(env.TELEGRAM_ADMIN_ID)){
        if(update.message?.chat?.type==='private'&&update.message?.text==='/start')await send(env,update.message.chat.id,'بوت قيراط مخصص للمدير. معرّف حسابك: '+update.message.from.id);
        return output('OK');
      }
      if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!/^\d+$/.test(env.TELEGRAM_ADMIN_ID||''))return output('Configuration required',503);
      const store=new Store(env,await accessToken(env));
      if(await rememberChannel(update,env,store)){
        await send(env,update.message.chat.id,'تم اكتشاف القناة. افتح لوحة المدير في قيراط ← قنوات Telegram، ثم تحقق من القناة واربطها. لم تُنشر أي رسالة في القناة.');return output('OK');
      }
      await processUpdate(update,env,store);return output('OK');
    } catch{console.error('QIRAT bridge request failed');return output('تعذر إكمال العملية. أعد المحاولة لاحقاً.',503);}
  }
};
