const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2] || '.';
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.scope,'./');
assert.equal(manifest.start_url,'./');
assert.equal(manifest.display,'standalone');
for (const icon of manifest.icons) {
  const bytes = fs.readFileSync(path.join(root,icon.src));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
  const size = Number(icon.sizes.split('x')[0]);
  assert.equal(bytes.readUInt32BE(16),size);
  assert.equal(bytes.readUInt32BE(20),size);
}
const listeners = {};
const button = {hidden:false,disabled:false,addEventListener(name,callback){this[name]=callback}};
const notices = [];
const context = vm.createContext({
  document:{getElementById:()=>button},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(name,callback)=>listeners[name]=callback},
  navigator:{userAgent:'Chrome',platform:'Win32'},
  modal:html=>notices.push(html),notify:message=>notices.push(message),console
});
vm.runInContext(read('install.js'),context);
(async()=>{
  await button.click();
  assert.match(notices[0],/تثبيت قيراط/);
  let prompted = 0;
  listeners.beforeinstallprompt({preventDefault(){},prompt:async()=>prompted++,userChoice:Promise.resolve({outcome:'dismissed'})});
  await button.click();
  assert.equal(prompted,1);
  assert.equal(button.hidden,false);
  assert(!notices.some(x=>x==='تم تثبيت قيراط'));
  listeners.appinstalled();
  assert.equal(button.hidden,true);
  const workerEvents = {};
  const removed = [];
  const cached = {offline:true};
  const worker = vm.createContext({
    self:{location:{origin:'https://example.com',href:'https://example.com/QIRAT/sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,fn)=>workerEvents[type]=fn},
    caches:{open:async()=>({match:async()=>cached,put:async()=>{}}),keys:async()=>['qirat-shell-v0','unrelated-site'],delete:async key=>removed.push(key)},
    URL,fetch:async()=>{throw Error('offline')},Promise
  });
  vm.runInContext(read('sw.js'),worker);
  let result;
  workerEvents.fetch({request:{method:'GET',url:'https://firestore.googleapis.com/v1/projects/test',mode:'cors'},respondWith(){throw Error('Firebase traffic must not be intercepted')}});
  workerEvents.fetch({request:{method:'GET',url:'https://example.com/Other/',mode:'navigate'},respondWith(){throw Error('Other apps must not be intercepted')}});
  workerEvents.fetch({request:{method:'GET',url:'https://example.com/QIRAT/#announcement=test',mode:'navigate'},respondWith(promise){result=promise}});
  assert.equal(await result,cached);
  let activation;
  workerEvents.activate({waitUntil:promise=>activation=promise});
  await activation;
  assert.deepEqual(removed,['qirat-shell-v0']);
  const firebase = read('firebase.js');
  const roleLines = firebase.split('\n').filter(line=>line.startsWith('export const isAdministrator = ')||line.startsWith('export const isOriginalAdministrator = '));
  const role = vm.runInNewContext(roleLines.map(line=>line.replace('export const ','const ')).join('\n')+'\nisAdministrator', {administratorUid:'',auth:{currentUser:null}});
  assert.equal(role({email:'ali_alsaffar@uomosul.edu.iq',emailVerified:true,providerData:[{providerId:'google.com'}]}),true);
  assert.equal(role({email:'ali_alsaffar@uomosul.edu.iq',emailVerified:false,providerData:[{providerId:'google.com'}]}),false);
  assert.equal(role({email:'other@example.com',emailVerified:true,providerData:[{providerId:'google.com'}]}),false);
  console.log('PASS: install flow, icon sizes, offline navigation, cache scope, verified administrator identity');
})().catch(error=>{console.error(error);process.exitCode=1});


