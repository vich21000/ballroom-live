import {db,roomPath,ref,onValue,ensureRoom,normalize,sortSeats,esc} from './common.js';

const $=id=>document.getElementById(id);
const sheets=$('envelopeSheets');
let seats={};
let filter='confirmed';
let query='';

const settings={left:15,bottom:17,seat:26,name:20};

await ensureRoom();
onValue(ref(db,roomPath('seats')),snap=>{
  seats=normalize(snap.val());
  render();
});

function hasThai(text=''){
  return /[\u0E00-\u0E7F]/.test(text);
}

function guestList(){
  const q=query.trim().toLowerCase();
  return Object.values(seats)
    .filter(s=>s && s.guestName)
    .filter(s=>filter==='all' || !!s.confirmed)
    .filter(s=>!q || String(s.id||'').toLowerCase().includes(q) || String(s.guestName||'').toLowerCase().includes(q))
    .sort(sortSeats);
}

function applyVars(el){
  el.style.setProperty('--left-offset',settings.left+'mm');
  el.style.setProperty('--bottom-offset',settings.bottom+'mm');
  el.style.setProperty('--seat-size',settings.seat+'pt');
  el.style.setProperty('--name-size',settings.name+'pt');
}

function fitName(el){
  const base=settings.name;
  let size=base;
  el.style.fontSize=size+'pt';
  const line=el.closest('.envelope-line');
  if(!line)return;
  while(size>12 && line.scrollWidth>line.clientWidth){
    size-=.5;
    el.style.fontSize=size+'pt';
  }
}

function makeSheet(s){
  const page=document.createElement('section');
  page.className='envelope-sheet';
  applyVars(page);
  const thai=hasThai(s.guestName);
  page.innerHTML=`
    <div class="envelope-flap-guide"></div>
    <div class="envelope-print-block">
      <div class="envelope-line">
        <span class="envelope-seat">${esc(s.id||'')}</span>
        <span class="envelope-name${thai?' has-thai':''}">${esc(s.guestName||'')}</span>
      </div>
    </div>`;
  requestAnimationFrame(()=>fitName(page.querySelector('.envelope-name')));
  return page;
}

function render(){
  const list=guestList();
  sheets.innerHTML='';
  $('countText').textContent=`${list.length} envelope${list.length===1?'':'s'} ready to print`;
  if(!list.length){
    const empty=document.createElement('div');
    empty.className='card envelope-empty';
    empty.textContent='No guests match this filter.';
    sheets.appendChild(empty);
  }else{
    list.forEach(s=>sheets.appendChild(makeSheet(s)));
  }
  $('confirmedBtn').classList.toggle('active',filter==='confirmed');
  $('allBtn').classList.toggle('active',filter==='all');
}

function updateSetting(key,inputId){
  const value=Number($(inputId).value);
  if(Number.isFinite(value))settings[key]=value;
  document.querySelectorAll('.envelope-sheet').forEach(applyVars);
  if(key==='name')document.querySelectorAll('.envelope-name').forEach(fitName);
}

$('confirmedBtn').onclick=()=>{filter='confirmed';render();};
$('allBtn').onclick=()=>{filter='all';render();};
$('searchInput').addEventListener('input',e=>{query=e.target.value;render();});
$('leftOffset').addEventListener('input',()=>updateSetting('left','leftOffset'));
$('bottomOffset').addEventListener('input',()=>updateSetting('bottom','bottomOffset'));
$('seatSize').addEventListener('input',()=>updateSetting('seat','seatSize'));
$('nameSize').addEventListener('input',()=>updateSetting('name','nameSize'));
$('resetSettingsBtn').onclick=()=>{
  Object.assign(settings,{left:15,bottom:17,seat:26,name:20});
  $('leftOffset').value=15;$('bottomOffset').value=17;$('seatSize').value=26;$('nameSize').value=20;
  render();
};
$('printBtn').onclick=()=>window.print();
