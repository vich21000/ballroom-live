import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, update, runTransaction, serverTimestamp, push } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const params=new URLSearchParams(location.search);
export const roomId=(params.get('room')||'main-ballroom').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'main-ballroom';
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
export const db=getDatabase(app);
await signInAnonymously(auth);
export{ref,onValue,get,set,update,runTransaction,serverTimestamp,push};

export const GROUP_COLORS=[['Soft pink','#f7d6df'],['Soft blue','#d8e8fb'],['Soft green','#d9efd9'],['Soft yellow','#f8edbd'],['Soft purple','#e7ddf6'],['Soft orange','#f7ddc6'],['Soft teal','#d7efec'],['Soft grey','#e4e7eb'],['Soft rose','#f4d8d2'],['Soft mint','#dcefe5'],['Soft lavender','#e4def7'],['Soft sand','#eee4cf']].map(([label,value])=>({label,value}));
export const TABLE_X={A:220,B:560,C:900,D:1240,E:2050,F:2390,G:2730,H:3070};
export const TABLE_W=90,SEAT_W=82,GAP=32,ROW_GAP=62,STAGE_CENTER=1690,AISLE_LEFT=1575,AISLE_W=230,WORLD_W=3380,WORLD_H=1400,DEFAULT_ROWS=16;

export function roomPath(s=''){return `rooms/${roomId}${s?'/'+s:''}`}
export function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function short(v,m=10){v=String(v||'').trim();return v.length>m?v.slice(0,m-1)+'…':v}
export function normalize(v){return v?(Array.isArray(v)?Object.fromEntries(v.filter(Boolean).map(x=>[x.id,x])):v):{}}
export function makeGuestCode(){const a=new Uint8Array(12);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function qrPayload(s){return `BALLROOM|${roomId}|${s.id}|${s.guestCode}`}

export function defaultRoom(){
  const tables={},seats={};
  for(const [id,x] of Object.entries(TABLE_X)){
    tables[id]={id,x,y:205,rows:DEFAULT_ROWS,nextNumber:DEFAULT_ROWS*2+1};
    for(let n=1;n<=DEFAULT_ROWS*2;n++)seats[id+n]={id:id+n,tableId:id,number:n,rowIndex:Math.floor((n-1)/2),side:n%2?'left':'right',status:'available',guestName:'',groupName:'',groupId:'',groupColor:GROUP_COLORS[0].value,conditions:'',notes:'',souvenirEligible:false,confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null,updatedAt:null};
  }
  return{meta:{title:'Nantigan and Ativich',version:'gift-menu-placecards-v1',updatedAt:Date.now(),planLocked:false},tables,seats,backups:{}};
}

export async function ensureRoom(){
  const roomRef=ref(db,roomPath());
  const snap=await get(roomRef);
  const fresh=defaultRoom();
  if(!snap.exists()){
    await set(roomRef,fresh);
    return fresh;
  }
  const current=snap.val()||{};
  const tables=normalize(current.tables);
  const seats=normalize(current.seats);
  const writes=[];
  if(!current.meta)writes.push(set(ref(db,roomPath('meta')),fresh.meta));
  else if(current.meta.planLocked===undefined)writes.push(update(ref(db,roomPath('meta')),{planLocked:false}));

  for(const [id,t] of Object.entries(fresh.tables)){
    if(!tables[id]){
      writes.push(set(ref(db,roomPath(`tables/${id}`)),t));
    }else{
      const currentRows=Number(tables[id].rows)||0;
      const currentNext=Number(tables[id].nextNumber)||1;
      const tablePatch={x:t.x,y:t.y};
      if(currentRows<DEFAULT_ROWS){
        tablePatch.rows=DEFAULT_ROWS;
        tablePatch.nextNumber=Math.max(currentNext,DEFAULT_ROWS*2+1);
      }else if(currentRows===DEFAULT_ROWS){
        tablePatch.nextNumber=Math.max(currentNext,DEFAULT_ROWS*2+1);
      }
      writes.push(update(ref(db,roomPath(`tables/${id}`)),tablePatch));
    }
  }

  for(const [id,seat] of Object.entries(fresh.seats)){
    if(!seats[id])writes.push(set(ref(db,roomPath(`seats/${id}`)),seat));
  }

  // Keep existing used seats above the 32-seat standard. Only remove unused extras.
  for(const id of Object.keys(TABLE_X)){
    const extras=Object.values(seats).filter(s=>s&&s.tableId===id&&Number(s.number)>DEFAULT_ROWS*2);
    const hasUsedExtra=extras.some(s=>s.guestName||s.groupName||s.confirmed||s.checkedIn||(s.status&&s.status!=='available')||s.conditions||s.notes);
    if(extras.length&&!hasUsedExtra){
      for(const s of extras)writes.push(set(ref(db,roomPath(`seats/${s.id}`)),null));
      writes.push(update(ref(db,roomPath(`tables/${id}`)),{rows:DEFAULT_ROWS,nextNumber:DEFAULT_ROWS*2+1}));
    }
  }
  if(writes.length)await Promise.all(writes);
  return fresh;
}

export function mergeRoomDefaults(room){
  const fresh=defaultRoom();
  const current=room||{};
  return{...fresh,...current,meta:{...fresh.meta,...(current.meta||{})},tables:{...fresh.tables,...normalize(current.tables)},seats:{...fresh.seats,...normalize(current.seats)},backups:current.backups||{},activity:current.activity||{},undo:current.undo||{}};
}
export function seatPos(t,s){return{x:s.side==='left'?t.x-GAP-SEAT_W:t.x+TABLE_W+GAP,y:t.y+18+s.rowIndex*ROW_GAP}}
export function drawBase(canvas,tables){
  canvas.innerHTML='<div class="screen-bar"></div><div class="main-stage">MAIN STAGE</div><div class="center-aisle"></div><div class="gate bride">GATE BRIDE</div><div class="gate groom">GATE GROOM</div>';
  canvas.querySelector('.main-stage').style.left=(STAGE_CENTER-210)+'px';
  const aisle=canvas.querySelector('.center-aisle');aisle.style.left=AISLE_LEFT+'px';aisle.style.width=AISLE_W+'px';
  Object.values(tables).forEach(t=>{const e=document.createElement('div');e.className='long-table';e.style.left=t.x+'px';e.style.top=t.y+'px';e.style.height=Math.max(140,t.rows*ROW_GAP+28)+'px';e.innerHTML=`<strong>TABLE ${esc(t.id)}</strong><span>${t.rows} rows</span>`;canvas.appendChild(e)});
}
export function seatEl(s,t,{selected=false,publicMode=false,onClick=null}={}){
  const p=seatPos(t,s),b=document.createElement('button');
  b.className=`seat-card ${s.status||'available'} ${s.checkedIn?'checked-in':''} ${selected?'selected':''}`;
  b.style.left=p.x+'px';b.style.top=p.y+'px';
  if(s.status!=='available'&&!s.checkedIn)b.style.background=s.groupColor||GROUP_COLORS[0].value;
  b.innerHTML=`<span class="seat-no">${esc(s.id)}</span><span class="guest-line">${esc(short(s.guestName)||'—')}</span><span class="group-line">${esc(short(s.groupName)||'—')}</span>`;
  b.title=`Seat: ${s.id}\nGuest: ${s.guestName||'—'}\nGroup: ${s.groupName||'—'}\nStatus: ${s.status||'available'}\nConfirmed: ${s.confirmed?'Yes':'No'}\nCheck-in: ${s.checkedIn?'Checked in':'Not arrived'}${publicMode?'':`\nConditions: ${s.conditions||'—'}\nNotes: ${s.notes||'—'}\nGift redemption: ${s.souvenirEligible?'Yes':'No'}`}`;
  if(onClick)b.onclick=()=>onClick(s);
  return b;
}
export function sortSeats(a,b){return a.tableId.localeCompare(b.tableId)||a.number-b.number}

export async function createCloudBackup(reason='manual'){
  const snap=await get(ref(db,roomPath()));const room=snap.val();if(!room)return;
  const id=Date.now().toString();
  await set(ref(db,roomPath(`backups/${id}`)),{createdAt:Date.now(),reason,data:{meta:room.meta||{},tables:room.tables||{},seats:room.seats||{}}});
  return id;
}

export async function logActivity(action,detail=''){
  try{
    const entry={at:Date.now(),action:String(action||''),detail:String(detail||'').slice(0,240)};
    await set(push(ref(db,roomPath('activity'))),entry);
  }catch(e){console.warn('Activity log failed',e)}
}

export async function saveUndoSnapshot(label='Change'){
  const snap=await get(ref(db,roomPath()));
  const r=snap.val()||{};
  await set(ref(db,roomPath('undo/last')),{createdAt:Date.now(),label,tables:r.tables||{},seats:r.seats||{}});
}

export async function undoLastChange(){
  const snap=await get(ref(db,roomPath('undo/last')));
  const u=snap.val();
  if(!u)return false;
  await createCloudBackup('before-undo');
  await update(ref(db,roomPath()),{tables:u.tables||{},seats:u.seats||{},'meta/updatedAt':serverTimestamp()});
  await set(ref(db,roomPath('undo/last')),null);
  await logActivity('Undo',u.label||'Last change');
  return true;
}

function installViewportMetrics(){
  const apply=()=>{
    const vv=window.visualViewport;
    document.documentElement.style.setProperty('--app-height',`${Math.round(vv?.height||window.innerHeight)}px`);
    document.documentElement.style.setProperty('--app-width',`${Math.round(vv?.width||window.innerWidth)}px`);
  };
  apply();
  window.addEventListener('resize',apply,{passive:true});
  if(window.visualViewport){visualViewport.addEventListener('resize',apply,{passive:true});visualViewport.addEventListener('scroll',apply,{passive:true})}
}

function installConnectionBadge(){
  const start=()=>{
    if(document.getElementById('connectionBadge'))return;
    const badge=document.createElement('div');badge.id='connectionBadge';badge.className='connection-badge connecting';badge.textContent='CONNECTING';document.body.appendChild(badge);
    onValue(ref(db,'.info/connected'),s=>{
      const ok=s.val()===true;
      badge.className=`connection-badge ${ok?'online':'offline'}`;
      badge.textContent=ok?'● ONLINE':'● OFFLINE — KEEP PAGE OPEN';
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
installViewportMetrics();
installConnectionBadge();

export function setupViewport(which){
  const viewport=document.getElementById(which+'Viewport'),world=document.getElementById(which+'World');
  let z=1,drag=false,sx=0,sy=0,sl=0,st=0,pointerId=null;
  const center=()=>{viewport.scrollLeft=Math.max(0,(WORLD_W*z-viewport.clientWidth)/2);viewport.scrollTop=Math.max(0,(WORLD_H*z-viewport.clientHeight)/2)};
  const apply=()=>{world.style.transform=`scale(${z})`;center()};
  const fit=()=>{if(!viewport.clientWidth||!viewport.clientHeight)return;z=Math.max(.20,Math.min(2.2,Math.min((viewport.clientWidth-20)/WORLD_W,(viewport.clientHeight-20)/WORLD_H)));apply()};
  document.querySelectorAll(`[data-zoom="${which}"]`).forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='in')z=Math.min(2.4,z+.1);if(a==='out')z=Math.max(.20,z-.1);if(a==='reset')z=1;if(a==='fit')return fit();apply()});
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,textarea,select,a'))return;
    drag=true;pointerId=e.pointerId;viewport.setPointerCapture?.(e.pointerId);viewport.classList.add('panning');sx=e.clientX;sy=e.clientY;sl=viewport.scrollLeft;st=viewport.scrollTop;
  });
  viewport.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pointerId)return;e.preventDefault();viewport.scrollLeft=sl-(e.clientX-sx);viewport.scrollTop=st-(e.clientY-sy)});
  const stopDrag=e=>{if(pointerId!==null&&e.pointerId!==undefined&&e.pointerId!==pointerId)return;drag=false;pointerId=null;viewport.classList.remove('panning')};
  viewport.addEventListener('pointerup',stopDrag);viewport.addEventListener('pointercancel',stopDrag);
  window.addEventListener('resize',fit,{passive:true});
  if(window.visualViewport)visualViewport.addEventListener('resize',fit,{passive:true});
  requestAnimationFrame(()=>requestAnimationFrame(fit));
  return{fit,apply,center,getZoom:()=>z};
}
