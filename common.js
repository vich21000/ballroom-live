import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, update, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
export const params=new URLSearchParams(location.search);export const roomId=(params.get('room')||'main-ballroom').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'main-ballroom';
const app=initializeApp(firebaseConfig);const auth=getAuth(app);export const db=getDatabase(app);await signInAnonymously(auth);export{ref,onValue,get,set,update,runTransaction,serverTimestamp};
export const GROUP_COLORS=[['Soft pink','#f7d6df'],['Soft blue','#d8e8fb'],['Soft green','#d9efd9'],['Soft yellow','#f8edbd'],['Soft purple','#e7ddf6'],['Soft orange','#f7ddc6'],['Soft teal','#d7efec'],['Soft grey','#e4e7eb'],['Soft rose','#f4d8d2'],['Soft mint','#dcefe5'],['Soft lavender','#e4def7'],['Soft sand','#eee4cf']].map(([label,value])=>({label,value}));
export const TABLE_X={A:240,B:620,C:1000,D:1560,E:1940,F:2320};export const TABLE_W=90,SEAT_W=82,GAP=32,ROW_GAP=62,STAGE_CENTER=1325,AISLE_LEFT=1210,AISLE_W=230,WORLD_W=2640,WORLD_H=1500,DEFAULT_ROWS=18;
export function roomPath(s=''){return `rooms/${roomId}${s?'/'+s:''}`};export function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};export function short(v,m=10){v=String(v||'').trim();return v.length>m?v.slice(0,m-1)+'…':v};export function normalize(v){return v?(Array.isArray(v)?Object.fromEntries(v.filter(Boolean).map(x=>[x.id,x])):v):{}};
export function makeGuestCode(){const a=new Uint8Array(12);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')};export function qrPayload(s){return `BALLROOM|${roomId}|${s.id}|${s.guestCode}`};
export function defaultRoom(){const tables={},seats={};for(const [id,x] of Object.entries(TABLE_X)){tables[id]={id,x,y:205,rows:DEFAULT_ROWS,nextNumber:DEFAULT_ROWS*2+1};for(let n=1;n<=DEFAULT_ROWS*2;n++)seats[id+n]={id:id+n,tableId:id,number:n,rowIndex:Math.floor((n-1)/2),side:n%2?'left':'right',status:'available',guestName:'',groupName:'',groupId:'',groupColor:GROUP_COLORS[0].value,conditions:'',notes:'',confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null,updatedAt:null}}return{meta:{title:'Nantigan and Ativich',version:'online-final',updatedAt:Date.now()},tables,seats,backups:{}}}
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
  for(const [id,t] of Object.entries(fresh.tables)){
    if(!tables[id]){
      writes.push(set(ref(db,roomPath(`tables/${id}`)),t));
    }else{
      const currentRows=Number(tables[id].rows)||0;
      const currentNext=Number(tables[id].nextNumber)||1;
      if(currentRows<DEFAULT_ROWS)writes.push(update(ref(db,roomPath(`tables/${id}`)),{rows:DEFAULT_ROWS,nextNumber:Math.max(currentNext,DEFAULT_ROWS*2+1)}));
    }
  }
  for(const [id,seat] of Object.entries(fresh.seats)){
    if(!seats[id])writes.push(set(ref(db,roomPath(`seats/${id}`)),seat));
  }
  if(writes.length)await Promise.all(writes);
  return fresh;
}
export function mergeRoomDefaults(room){
  const fresh=defaultRoom();
  const current=room||{};
  return {
    ...fresh,
    ...current,
    meta:{...fresh.meta,...(current.meta||{})},
    tables:{...fresh.tables,...normalize(current.tables)},
    seats:{...fresh.seats,...normalize(current.seats)},
    backups:current.backups||{}
  };
}
export function seatPos(t,s){return{x:s.side==='left'?t.x-GAP-SEAT_W:t.x+TABLE_W+GAP,y:t.y+18+s.rowIndex*ROW_GAP}}
export function drawBase(canvas,tables){canvas.innerHTML='<div class="screen-bar"></div><div class="main-stage">MAIN STAGE</div><div class="center-aisle"></div><div class="gate bride">GATE BRIDE</div><div class="gate groom">GATE GROOM</div>';canvas.querySelector('.main-stage').style.left=(STAGE_CENTER-210)+'px';const aisle=canvas.querySelector('.center-aisle');aisle.style.left=AISLE_LEFT+'px';aisle.style.width=AISLE_W+'px';Object.values(tables).forEach(t=>{const e=document.createElement('div');e.className='long-table';e.style.left=t.x+'px';e.style.top=t.y+'px';e.style.height=Math.max(140,t.rows*ROW_GAP+28)+'px';e.innerHTML=`<strong>TABLE ${esc(t.id)}</strong><span>${t.rows} rows</span>`;canvas.appendChild(e)})}
export function seatEl(s,t,{selected=false,publicMode=false,onClick=null}={}){const p=seatPos(t,s),b=document.createElement('button');b.className=`seat-card ${s.status||'available'} ${s.checkedIn?'checked-in':''} ${selected?'selected':''}`;b.style.left=p.x+'px';b.style.top=p.y+'px';if(s.status!=='available'&&!s.checkedIn)b.style.background=s.groupColor||GROUP_COLORS[0].value;b.innerHTML=`<span class="seat-no">${esc(s.id)}</span><span class="guest-line">${esc(short(s.guestName)||'—')}</span><span class="group-line">${esc(short(s.groupName)||'—')}</span>`;b.title=`Seat: ${s.id}\nGuest: ${s.guestName||'—'}\nGroup: ${s.groupName||'—'}\nStatus: ${s.status||'available'}\nConfirmed: ${s.confirmed?'Yes':'No'}\nCheck-in: ${s.checkedIn?'Checked in':'Not arrived'}${publicMode?'':`\nConditions: ${s.conditions||'—'}\nNotes: ${s.notes||'—'}`}`;if(onClick)b.onclick=()=>onClick(s);return b}
export function sortSeats(a,b){return a.tableId.localeCompare(b.tableId)||a.number-b.number}
export async function createCloudBackup(reason='manual'){const snap=await get(ref(db,roomPath()));const room=snap.val();if(!room)return;const id=Date.now().toString();await set(ref(db,roomPath(`backups/${id}`)),{createdAt:Date.now(),reason,data:{meta:room.meta||{},tables:room.tables||{},seats:room.seats||{}}});return id}
export function setupViewport(which){const viewport=document.getElementById(which+'Viewport'),world=document.getElementById(which+'World');let z=1,drag=false,sx=0,sy=0,sl=0,st=0;const center=()=>{viewport.scrollLeft=Math.max(0,(WORLD_W*z-viewport.clientWidth)/2);viewport.scrollTop=Math.max(0,(WORLD_H*z-viewport.clientHeight)/2)};const apply=()=>{world.style.transform=`scale(${z})`;center()};const fit=()=>{z=Math.max(.24,Math.min(2.2,Math.min((viewport.clientWidth-24)/WORLD_W,(viewport.clientHeight-24)/WORLD_H)));apply()};document.querySelectorAll(`[data-zoom="${which}"]`).forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='in')z=Math.min(2.4,z+.1);if(a==='out')z=Math.max(.24,z-.1);if(a==='reset')z=1;if(a==='fit')return fit();apply()});viewport.onmousedown=e=>{if(e.target.closest('button,input'))return;drag=true;viewport.classList.add('panning');sx=e.pageX;sy=e.pageY;sl=viewport.scrollLeft;st=viewport.scrollTop};window.addEventListener('mouseup',()=>{drag=false;viewport.classList.remove('panning')});viewport.onmousemove=e=>{if(!drag)return;viewport.scrollLeft=sl-(e.pageX-sx);viewport.scrollTop=st-(e.pageY-sy)};window.addEventListener('resize',fit);requestAnimationFrame(fit);return{fit,apply,center}}
