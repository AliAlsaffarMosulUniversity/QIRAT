import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, collection, doc, query, orderBy, limit, startAfter, getDocs, onSnapshot, getDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyB-opp6w-TfZCvfHNmXc_o3CMR6mjOkvdQ',
  authDomain: 'qirat-6f86e.firebaseapp.com',
  projectId: 'qirat-6f86e',
  storageBucket: 'qirat-6f86e.firebasestorage.app',
  messagingSenderId: '231672378816',
  appId: '1:231672378816:web:fce40b688e7ad514b28425'
});
const auth = getAuth(app);
const db = getFirestore(app);
const announcements = collection(db, 'announcements');
const validId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
let administratorUid = '', roleStop = null;
export const watchAuth = callback => {
  const stop = onAuthStateChanged(auth,user=>{
    roleStop?.();roleStop=null;administratorUid='';callback(user);
    if(!user || isOriginalAdministrator(user) || !user.emailVerified)return;
    roleStop=onSnapshot(doc(db,'_qiratAdmins',user.email.trim().toLowerCase()),snapshot=>{
      if(auth.currentUser?.uid!==user.uid)return;
      const d=snapshot.exists()?snapshot.data():null;
      const next=d?.active===true&&d.uid===user.uid&&d.email===user.email.trim().toLowerCase()&&d.whatsappVerified===true&&d.telegramVerified===true?user.uid:'';
      if(next!==administratorUid){administratorUid=next;callback(user);}
    },()=>{if(auth.currentUser?.uid===user.uid&&administratorUid){administratorUid='';callback(user);}});
  });
  return ()=>{stop();roleStop?.();roleStop=null;administratorUid='';};
};
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOut = () => firebaseSignOut(auth);
export const watchAnnouncements = (callback, onError) => onSnapshot(
  query(announcements, orderBy('datetime', 'desc'), limit(500)),
  snapshot => callback(snapshot.docs.filter(d => validId(d.id)).map(d => ({ ...d.data(), id: d.id }))),
  onError
);
export async function getAnnouncement(id) {
  if (!validId(id)) return null;
  const snapshot = await getDoc(doc(announcements, id));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}
export async function saveAnnouncement(entry, existing = false) {
  if (!auth.currentUser || auth.currentUser.uid !== entry.ownerUid || !validId(entry.id)) throw new Error('Invalid announcement owner or ID');
  const ref = doc(announcements, entry.id);
  const value = { ...entry, updatedAt: serverTimestamp() };
  if (existing) return updateDoc(ref, value);
  return runTransaction(db, async transaction => {
    if ((await transaction.get(ref)).exists()) throw new Error('Announcement already exists');
    transaction.set(ref, { ...value, createdAt: serverTimestamp() });
  });
}
export async function deleteAnnouncement(id) {
  if (!auth.currentUser || !validId(id)) throw new Error('Sign in first');
  return deleteDoc(doc(announcements, id));
}

export const isOriginalAdministrator = user => !!user && user.emailVerified === true && user.email?.toLowerCase() === 'ali_alsaffar@uomosul.edu.iq' && user.providerData?.some(p => p.providerId === 'google.com');
export const isAdministrator = user => !!user && user.emailVerified === true && user.providerData?.some(p=>p.providerId==='google.com') && (isOriginalAdministrator(user) || (user.uid===administratorUid && auth.currentUser?.uid===user.uid));
export async function administratorRequest(body) {
  if(!auth.currentUser)throw new Error('sign_in_required');
  const token=await auth.currentUser.getIdToken();
  const response=await fetch('https://qirat-telegram-bot.anaqatal-rafidain.workers.dev/administrators',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data;try{data=await response.json();}catch{throw new Error('administration_unavailable');}
  if(!response.ok)throw new Error(data.error||'administration_unavailable');
  return data;
}
export async function telegramChannelRequest(body) {
  if (!isAdministrator(auth.currentUser)) throw new Error('administrator_required');
  const token = await auth.currentUser.getIdToken();
  let payload,headers={Authorization:'Bearer '+token};
  if(body.photo instanceof Blob){const {photo,...fields}=body;payload=new FormData();payload.append('payload',JSON.stringify(fields));payload.append('photo',photo,'announcement.jpg');}
  else {payload=JSON.stringify(body);headers['Content-Type']='application/json';}
  const response = await fetch('https://qirat-telegram-bot.anaqatal-rafidain.workers.dev/channels', {method:'POST',headers,body:payload});
  let data; try { data=await response.json(); } catch { throw new Error('channels_unavailable'); }
  if (!response.ok) throw new Error(data.error || 'channels_unavailable');
  return data;
}
export async function getAdminAnnouncements(cursor = null) {
  if (!isAdministrator(auth.currentUser)) throw new Error('Administrator access required');
  const constraints = [orderBy('datetime', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(51));
  const snapshot = await getDocs(query(announcements, ...constraints));
  const page = snapshot.docs.slice(0, 50);
  return {
    items: page.filter(d => validId(d.id)).map(d => ({ ...d.data(), id: d.id })),
    cursor: page.length ? page[page.length - 1] : null,
    hasMore: snapshot.docs.length > 50
  };
}


export const watchUserCount=(callback,onError)=>onSnapshot(doc(db,'stats','users'),snapshot=>callback(snapshot.exists()?Number(snapshot.data().count||0):0),onError);
export async function registerCurrentUser(){
  if(!auth.currentUser)return;
  const token=await auth.currentUser.getIdToken();
  const response=await fetch('https://qirat-telegram-bot.anaqatal-rafidain.workers.dev/register-user',{method:'POST',headers:{Authorization:'Bearer '+token}});
  if(!response.ok)throw new Error('Member registration unavailable');
  return response.json();
}



