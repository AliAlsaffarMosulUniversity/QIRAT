const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),saved=new Map();let admin=true,copied='',markup='',reject=false;
const node=s=>{if(!nodes.has(s))nodes.set(s,{value:'',textContent:'',focus(){},select(){this.selected=true}});return nodes.get(s)};
const c=vm.createContext({isAdmin:()=>admin,currentUser:{uid:'owner'},sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},modal:s=>markup=s,$:node,navigator:{clipboard:{writeText:async t=>{if(reject)throw Error();copied=t}}}});
vm.runInContext(fs.readFileSync('messenger-sharing.js','utf8'),c);
(async()=>{
vm.runInContext('openMessengerGroups()',c);
assert(markup.includes('https://m.me/ch/AbYDrlPhf0crYRu4/'));assert(markup.includes('https://m.me/ch/AbZ5SY-OJ1wllO79/'));
let prevented=false;const e={preventDefault(){prevented=true}};
node('#msMessage').value='';node('#msFirst').onclick(e);assert(prevented);
node('#msMessage').value='رسالة & تجربة';node('#msMessage').oninput();
prevented=false;node('#msFirst').onclick(e);await Promise.resolve();assert(!prevented);assert.equal(copied,'رسالة & تجربة');
assert.match(node('#msStatus').textContent,/لم يؤكد/);
vm.runInContext('openMessengerGroups()',c);assert.equal(node('#msMessage').value,'رسالة & تجربة');
reject=true;node('#msSecond').onclick(e);await Promise.resolve();assert(node('#msMessage').selected);
admin=false;prevented=false;node('#msFirst').onclick(e);assert(prevented);
console.log('PASS: exact destinations, empty/admin gates, clipboard success/failure and session draft');
})().catch(e=>{console.error(e);process.exitCode=1});
