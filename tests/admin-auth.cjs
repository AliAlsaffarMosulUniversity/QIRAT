const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let authCallback,roleCallback,roleError,stopped=0;
const auth={currentUser:null};
const c=vm.createContext({auth,db:{},onAuthStateChanged:(_,cb)=>{authCallback=cb;return ()=>{}},doc:(_,collection,key)=>({collection,key}),onSnapshot:(ref,cb,error)=>{roleCallback=cb;roleError=error;return ()=>stopped++}});
const source=fs.readFileSync('firebase.js','utf8');
vm.runInContext(source.slice(source.indexOf('let administratorUid'),source.indexOf('export const signIn')).replaceAll('export ',''),c);
vm.runInContext(source.slice(source.indexOf('export const isOriginalAdministrator'),source.indexOf('export async function administratorRequest')).replaceAll('export ',''),c);
c.events=[];vm.runInContext('watchAuth(user=>events.push(user))',c);
const alice={uid:'alice',email:'alice@example.com',emailVerified:true,providerData:[{providerId:'google.com'}]};
auth.currentUser=alice;authCallback(alice);c.user=alice;
const isAdmin=()=>vm.runInContext('isAdministrator(user)',c);
assert.equal(isAdmin(),false);
const data={uid:'alice',email:alice.email,active:true,whatsappVerified:true,telegramVerified:false};
roleCallback({exists:()=>true,data:()=>data});assert.equal(isAdmin(),false);
data.telegramVerified=true;roleCallback({exists:()=>true,data:()=>data});assert.equal(isAdmin(),true);
roleError();assert.equal(isAdmin(),false);
roleCallback({exists:()=>true,data:()=>data});assert.equal(isAdmin(),true);
auth.currentUser=null;authCallback(null);assert.equal(isAdmin(),false);assert.equal(stopped,1);
roleCallback({exists:()=>true,data:()=>data});assert.equal(isAdmin(),false);
c.user={...alice,email:'ali_alsaffar@uomosul.edu.iq'};assert.equal(isAdmin(),true);
c.user.emailVerified=false;assert.equal(isAdmin(),false);
console.log('PASS: dual-proof role gating, live role errors, logout and stale subscription safety, original owner fallback');


