import * as common from './common.js?v=20260921-fixv2';
const {db,roomId,roomPath,ref,get,runTransaction,ensureRoom}=common;
const logActivity=typeof common.logActivity==='function'?common.logActivity:async()=>{};
await ensureRoom();

let scanner=null,timer=null,locked=false,switchingCamera=false;
let currentFacing='environment',currentDeviceId='';
let cameras=[];
let soundEnabled=sessionStorage.getItem('ballroom_sound')!=='0';
const KIOSK_KEY='ballroom_kiosk_mode';
let audioCtx=null;

function updateViewportHeight(){
  const h=Math.round(window.visualViewport?.height||window.innerHeight);
  document.documentElement.style.setProperty('--checkin-height',`${h}px`);
}
updateViewportHeight();
window.addEventListener('resize',updateViewportHeight,{passive:true});
window.visualViewport?.addEventListener('resize',updateViewportHeight,{passive:true});

function isKiosk(){return sessionStorage.getItem(KIOSK_KEY)==='1'}
function applyKiosk(){document.body.classList.toggle('kiosk-mode',isKiosk());const b=document.getElementById('kioskBtn');if(b)b.textContent=isKiosk()?'Exit kiosk':'Kiosk mode'}
function ensureAudio(){try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
function tone(kind){if(!soundEnabled)return;ensureAudio();if(!audioCtx)return;const seq=kind==='success'?[[880,.10],[1175,.12]]:kind==='already'?[[520,.12],[520,.12]]:[[220,.20],[165,.20]];let at=audioCtx.currentTime;seq.forEach(([f,d])=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(.15,at+.015);g.gain.exponentialRampToValueAtTime(.001,at+d);o.connect(g);g.connect(audioCtx.destination);o.start(at);o.stop(at+d+.02);at+=d+.04})}

function cameraKind(label=''){
  if(/front|user|facetime|selfie/i.test(label))return'user';
  if(/back|rear|environment|world|wide|telephoto|ultra/i.test(label))return'environment';
  return'';
}
function cameraDisplayName(c,i){
  const kind=cameraKind(c.label);
  if(kind==='user')return`Front camera${c.label?` — ${c.label}`:''}`;
  if(kind==='environment')return`Back camera${c.label?` — ${c.label}`:''}`;
  return c.label||`Camera ${i+1}`;
}
async function refreshCameras(){
  try{cameras=await Html5Qrcode.getCameras()||[]}catch{cameras=[]}
  const sel=document.getElementById('cameraSelect');if(!sel)return;
  const old=currentDeviceId||sel.value;
  sel.innerHTML='';
  cameras.forEach((c,i)=>{const o=new Option(cameraDisplayName(c,i),c.id);sel.add(o)});
  if(!cameras.length)sel.add(new Option('Automatic camera',''));
  if(old&&cameras.some(c=>c.id===old))sel.value=old;
  else if(currentDeviceId&&cameras.some(c=>c.id===currentDeviceId))sel.value=currentDeviceId;
  else{
    const preferred=cameras.find(c=>cameraKind(c.label)===currentFacing);
    if(preferred){sel.value=preferred.id;currentDeviceId=preferred.id}
  }
}
function scanConfig(){
  const vw=window.innerWidth,vh=window.visualViewport?.height||window.innerHeight;
  const size=Math.max(150,Math.min(230,Math.round(Math.min(vw,vh)*.28)));
  return{fps:12,qrbox:{width:size,height:size},aspectRatio:1.0,disableFlip:false};
}
async function stop(){try{if(scanner&&scanner.isScanning)await scanner.stop();if(scanner)await scanner.clear()}catch{}scanner=null}
async function startExactDevice(deviceId){
  const reader=document.getElementById('reader'),status=document.getElementById('cameraStatus');if(!reader)return false;
  await stop();
  try{
    scanner=new Html5Qrcode('reader');
    await scanner.start(deviceId,scanConfig(),txt=>handle(txt),()=>{});
    currentDeviceId=deviceId;
    const found=cameras.find(c=>c.id===deviceId);const kind=cameraKind(found?.label||'');if(kind)currentFacing=kind;
    if(status)status.textContent=found?cameraDisplayName(found,cameras.indexOf(found)):'Camera ready';
    return true;
  }catch(e){console.warn('Exact camera start failed',e);await stop();return false}
}
async function startFacing(facing=currentFacing){
  const reader=document.getElementById('reader'),status=document.getElementById('cameraStatus');if(!reader)return;
  if(status)status.textContent='Starting camera…';
  await stop();
  let ok=false,lastError=null;
  const attempts=[{facingMode:{exact:facing}},{facingMode:{ideal:facing}},{facingMode:facing}];
  for(const config of attempts){
    try{scanner=new Html5Qrcode('reader');await scanner.start(config,scanConfig(),txt=>handle(txt),()=>{});ok=true;break}catch(e){lastError=e;await stop()}
  }
  if(ok){currentFacing=facing;await refreshCameras();const preferred=cameras.find(c=>cameraKind(c.label)===facing);if(preferred)currentDeviceId=preferred.id;if(status)status.textContent=facing==='user'?'Front camera':'Back camera'}
  else{
    await refreshCameras();const preferred=cameras.find(c=>cameraKind(c.label)===facing);
    if(preferred)ok=await startExactDevice(preferred.id);
  }
  if(!ok){reader.innerHTML='<small>Camera unavailable. Use seat entry on the left.</small>';if(status)status.textContent='Camera unavailable';console.warn(lastError)}
  await refreshCameras();
}
async function selectFacing(facing){
  if(switchingCamera)return;switchingCamera=true;setCameraControlsDisabled(true);
  try{
    await refreshCameras();
    const matches=cameras.filter(c=>cameraKind(c.label)===facing);
    let ok=false;
    for(const c of matches){if(await startExactDevice(c.id)){ok=true;break}}
    if(!ok)await startFacing(facing);
    currentFacing=facing;
  }finally{await refreshCameras();setCameraControlsDisabled(false);switchingCamera=false}
}
function setCameraControlsDisabled(v){['frontCameraBtn','backCameraBtn','cameraSelect'].forEach(id=>{const e=document.getElementById(id);if(e)e.disabled=v})}

function home(){
  clearTimeout(timer);locked=false;updateViewportHeight();
  checkinRoot.innerHTML=`<div class="checkin-shell">
    <img class="logo-center" src="assets/white-logo.png" alt="Nantigan and Ativich">
    <div class="scan-box">
      <strong>CHECK-IN</strong>
      <div class="manual-row"><input id="manual" placeholder="Seat, e.g. A13" inputmode="text"><button id="manualBtn">Check seat</button></div>
      <div class="camera-controls">
        <button id="frontCameraBtn" type="button">Front</button>
        <button id="backCameraBtn" type="button">Back</button>
        <select id="cameraSelect" aria-label="Camera"><option value="">Automatic camera</option></select>
      </div>
      <div class="utility-controls"><button id="soundBtn" type="button">Sound ${soundEnabled?'on':'off'}</button><button id="kioskBtn" type="button">${isKiosk()?'Exit kiosk':'Kiosk mode'}</button></div>
      <div id="cameraStatus" class="camera-status">Starting camera…</div>
    </div>
    <div class="live-box"><div id="reader"></div></div>
  </div>`;
  const manual=document.getElementById('manual'),manualBtn=document.getElementById('manualBtn'),frontBtn=document.getElementById('frontCameraBtn'),backBtn=document.getElementById('backCameraBtn'),cameraSelect=document.getElementById('cameraSelect'),soundBtn=document.getElementById('soundBtn'),kioskBtn=document.getElementById('kioskBtn');
  manualBtn.onclick=()=>{ensureAudio();manualCheck(manual.value)};manual.addEventListener('keydown',e=>{if(e.key==='Enter'){ensureAudio();manualCheck(manual.value)}});
  frontBtn.onclick=()=>selectFacing('user');backBtn.onclick=()=>selectFacing('environment');
  cameraSelect.onchange=async()=>{if(!cameraSelect.value)return;setCameraControlsDisabled(true);try{await startExactDevice(cameraSelect.value);await refreshCameras()}finally{setCameraControlsDisabled(false)}};
  soundBtn.onclick=()=>{soundEnabled=!soundEnabled;sessionStorage.setItem('ballroom_sound',soundEnabled?'1':'0');soundBtn.textContent=`Sound ${soundEnabled?'on':'off'}`;if(soundEnabled){ensureAudio();tone('success')}};
  kioskBtn.onclick=async()=>{ensureAudio();if(isKiosk()){const p=prompt('Enter PIN to exit kiosk mode');if(p===null)return;if(p.trim()!=='1800')return alert('Incorrect PIN.');sessionStorage.removeItem(KIOSK_KEY);try{if(document.fullscreenElement)await document.exitFullscreen()}catch{};applyKiosk()}else{sessionStorage.setItem(KIOSK_KEY,'1');applyKiosk();try{await document.documentElement.requestFullscreen?.()}catch{}}};
  applyKiosk();startFacing(currentFacing);
}

function result(type,seat='',name=''){
  stop();tone(type==='green'?'success':type==='orange'?'already':'error');
  checkinRoot.innerHTML=type==='green'?`<div class="check-result green"><div><div class="seat-big">${seat}</div><div class="name-small">${name}</div><div class="state-small">CHECKED IN</div></div></div>`:type==='orange'?`<div class="check-result orange"><div><div class="seat-big">${seat}</div><div class="state-small">ALREADY CHECKED IN</div></div></div>`:`<div class="check-result red"><div><div class="state-small">PLEASE CONTACT STAFF</div></div></div>`;
  timer=setTimeout(home,3000);
}
async function manualCheck(id){
  id=id.trim().toUpperCase();const seatRef=ref(db,roomPath(`seats/${id}`)),s=(await get(seatRef)).val();if(!s||!s.confirmed)return result('red');if(s.checkedIn)return result('orange',s.id);
  let did=false;await runTransaction(seatRef,cur=>{if(!cur||cur.checkedIn)return cur;did=true;return{...cur,checkedIn:true,checkedInAt:Date.now()}});if(!did)return result('orange',s.id);await logActivity('Checked in',`${s.id} ${s.guestName||''} · manual`);result('green',s.id,s.guestName);
}
async function handle(txt){
  if(locked)return;locked=true;const p=txt.split('|');if(p.length!==4||p[0]!=='BALLROOM'||p[1]!==roomId)return result('red');const[,,id,code]=p,s=(await get(ref(db,roomPath(`seats/${id}`)))).val();if(!s||!s.confirmed||s.guestCode!==code)return result('red');if(s.checkedIn)return result('orange',s.id);
  let did=false;await runTransaction(ref(db,roomPath(`seats/${id}`)),cur=>{if(!cur||cur.checkedIn)return cur;did=true;return{...cur,checkedIn:true,checkedInAt:Date.now()}});if(!did)return result('orange',s.id);await logActivity('Checked in',`${s.id} ${s.guestName||''} · QR`);result('green',s.id,s.guestName);
}
window.addEventListener('pagehide',()=>stop());
window.addEventListener('orientationchange',()=>setTimeout(()=>{updateViewportHeight();if(document.getElementById('reader'))startFacing(currentFacing)},450));
home();
