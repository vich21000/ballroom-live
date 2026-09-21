import{db,roomPath,roomId,ref,onValue,get,set,update,runTransaction,serverTimestamp,ensureRoom,normalize,GROUP_COLORS,drawBase,seatEl,sortSeats,makeGuestCode,qrPayload,createCloudBackup,setupViewport,defaultRoom,mergeRoomDefaults,esc,logActivity,saveUndoSnapshot,undoLastChange,isGiftEligible}from'./common.js?v=20260921-saveguard-v5-1';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),colorInput=$('colorInput'),emptyState=$('emptyState'),seatPanel=$('seatPanel'),seatTitle=$('seatTitle'),statusInput=$('statusInput'),guestInput=$('guestInput'),groupInput=$('groupInput'),groupIdInput=$('groupIdInput'),souvenirInput=$('souvenirInput'),conditionsInput=$('conditionsInput'),notesInput=$('notesInput'),saveBtn=$('saveBtn'),confirmBtn=$('confirmBtn'),clearBtn=$('clearBtn'),tableControls=$('tableControls'),total=$('total'),assigned=$('assigned'),checked=$('checked'),available=$('available'),selectMode=$('selectMode'),moveGuestMode=$('moveGuestMode'),moveGroupMode=$('moveGroupMode'),modeHelp=$('modeHelp'),qrcode=$('qrcode'),qrInfo=$('qrInfo'),qrModal=$('qrModal'),downloadQr=$('downloadQr'),closeQr=$('closeQr'),snapshotBtn=$('snapshotBtn'),exportBtn=$('exportBtn'),restoreBtn=$('restoreBtn'),importBtn=$('importBtn'),importFile=$('importFile'),resetBtn=$('resetBtn'),pinModal=$('pinModal'),pinInput=$('pinInput'),pinConfirm=$('pinConfirm'),pinCancel=$('pinCancel'),planLockBtn=$('planLockBtn'),planStatus=$('planStatus'),undoBtn=$('undoBtn'),activityLog=$('activityLog');

// Do not rerun layout migrations on every Admin visit.
// Only initialise a genuinely new room; never replace an existing room.
const bootSnapshot=await get(ref(db,roomPath()));
if(!bootSnapshot.exists())await runTransaction(ref(db,roomPath()),current=>current===null?defaultRoom():undefined,{applyLocally:false});
const state={tables:{},seats:{},meta:{planLocked:false},selected:null,mode:'select',source:null};
// A form draft belongs to one seat. No change/input handler writes to Firebase.
// Slow acknowledgements must never overwrite a newer draft revision.
const SAVE_GUARD_BUILD='SAVE GUARD 5.1';
const DRAFT_KEY=`ballroom-admin-drafts-v5:${roomId}`;
const FIELD_NAMES=['status','guestName','groupName','groupId','groupColor','souvenirEligible','conditions','notes'];
const fieldElements={status:statusInput,guestName:guestInput,groupName:groupInput,groupId:groupIdInput,groupColor:colorInput,souvenirEligible:souvenirInput,conditions:conditionsInput,notes:notesInput};
const drafts=new Map(),saveStates=new Map(),acknowledged=new Map();
let panelSeatId=null,writeBusy=false,connected=false,storageWarning=false,composing=false;
state.seatKeys={};state.duplicateSeatIds=new Set();
const saveNotice=$('guestSaveStatus'),discardDraftBtn=$('discardDraftBtn'),draftExportBtn=$('draftExportBtn');
const clone=value=>JSON.parse(JSON.stringify(value));
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function editableValues(seat={}){
  return {status:seat.status||'available',guestName:String(seat.guestName||''),groupName:String(seat.groupName||''),groupId:String(seat.groupId||''),groupColor:seat.groupColor||GROUP_COLORS[0].value,souvenirEligible:isGiftEligible(seat),conditions:String(seat.conditions||''),notes:String(seat.notes||'')};
}
function readForm(){
  return {status:statusInput.value,guestName:guestInput.value,groupName:groupInput.value,groupId:groupIdInput.value,groupColor:colorInput.value,souvenirEligible:souvenirInput.value==='yes',conditions:conditionsInput.value,notes:notesInput.value};
}
function hasChanges(a,b){return FIELD_NAMES.some(k=>!same(a[k],b[k]));}
function readDraftStore(){try{const value=JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(_){return{}}}
function storeDraft(id,draft){
  try{const stored=readDraftStore();stored[id]=draft;localStorage.setItem(DRAFT_KEY,JSON.stringify(stored))}
  catch(_){storageWarning=true}
}
function removeStoredDraft(id,token){
  try{const stored=readDraftStore();if(stored[id]?.token===token){delete stored[id];localStorage.setItem(DRAFT_KEY,JSON.stringify(stored))}}
  catch(_){storageWarning=true}
}
for(const [id,value] of Object.entries(readDraftStore())){
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!value?.fields||!value?.base||!value?.token)continue;
  if(!FIELD_NAMES.every(k=>own(value.fields,k)&&own(value.base,k)))continue;
  drafts.set(id,{...value,rev:Number(value.rev)||1});
  saveStates.set(id,{kind:'dirty',message:'Recovered draft on this device. Press Save to send it to Firebase.'});
}
function draftFor(id){
  if(drafts.has(id))return drafts.get(id);
  const seat=state.seats[id];if(!seat)return null;
  return {token:makeGuestCode(),rev:0,base:editableValues(seat),fields:editableValues(seat),identityCode:seat.guestCode||'',updatedAt:Date.now()};
}
function captureDraftFromDOM(){
  const id=state.selected;if(!id||panelSeatId!==id||!state.seats[id])return null;
  const entry=draftFor(id),fields=readForm();
  if(!same(fields,entry.fields)){
    entry.fields=fields;entry.rev++;entry.updatedAt=Date.now();
    drafts.set(id,entry);storeDraft(id,entry);
    saveStates.set(id,{kind:'dirty',message:writeBusy?'New typing is kept as a draft; the current save will not replace it.':'Unsaved changes. Press Save Guest Details or Confirm & QR.'});
  }
  refreshSaveUI();return entry;
}
function markDraft(){captureDraftFromDOM();}
GROUP_COLORS.forEach(c=>colorInput.add(new Option(c.label,c.value)));
Object.values(fieldElements).forEach(el=>{
  el.addEventListener('input',markDraft);
  el.addEventListener('change',markDraft);
  el.addEventListener('compositionstart',()=>{composing=true});
  el.addEventListener('compositionend',()=>{composing=false;markDraft()});
});
function setSaveState(id,kind,message){saveStates.set(id,{kind,message});refreshSaveUI();}
function refreshSaveUI(){
  const id=state.selected,entry=id?drafts.get(id):null;
  let notice=saveStates.get(id)||{kind:'idle',message:id?'Ready. Changes are saved only with Save or Confirm.':'Select a seat to edit.'};
  if(!connected)notice={kind:'offline',message:'OFFLINE / CONNECTING - typing is kept as a draft. Wait for ONLINE before saving.'};
  if(storageWarning)notice={kind:'error',message:notice.message+' Browser recovery storage is unavailable; download your draft before closing.'};
  if(saveNotice){saveNotice.dataset.state=notice.kind;saveNotice.textContent=notice.message;}
  [saveBtn,confirmBtn,clearBtn].forEach(b=>b.disabled=writeBusy||!id||!connected);
  if(discardDraftBtn)discardDraftBtn.disabled=writeBusy||!entry;
  if(draftExportBtn)draftExportBtn.disabled=!drafts.size;
  if(undoBtn)undoBtn.disabled=writeBusy;
  if(planLockBtn)planLockBtn.disabled=writeBusy;
}
function fillForm(values){
  for(const [key,el] of Object.entries(fieldElements)){
    const next=key==='souvenirEligible'?(values[key]?'yes':'no'):values[key];
    if(key==='groupColor'&&next&&!Array.from(el.options).some(o=>o.value===next))el.add(new Option('Saved group color',next));
    if(el.value!==String(next??''))el.value=String(next??'');
  }
}
function renderPanel(force=false){
  const id=state.selected,s=state.seats[id];
  emptyState.hidden=!!s;seatPanel.hidden=!s;
  if(!s){panelSeatId=null;refreshSaveUI();return;}
  seatTitle.textContent='Seat '+s.id;
  seatPanel.classList.toggle('plan-locked-form',isLocked());
  // Keep active DOM inputs intact, including selection/caret/IME composition.
  if(panelSeatId===id&&(!force)&&(drafts.has(id)||writeBusy||composing||seatPanel.contains(document.activeElement))){refreshSaveUI();return;}
  fillForm(drafts.get(id)?.fields||editableValues(s));
  panelSeatId=id;refreshSaveUI();
}
function indexSeatKeys(rawSeats){
  const keys={},duplicates=new Set();
  for(const [key,value] of Object.entries(rawSeats||{})){
    if(!value||typeof value!=='object')continue;
    const id=String(value.id||key);
    if(own(keys,id)&&keys[id]!==key)duplicates.add(id);else keys[id]=key;
  }
  state.seatKeys=keys;state.duplicateSeatIds=duplicates;
}
function observeRemoteSeats(){
  // A clean form follows server changes. A dirty form never does.
  for(const [id,fields] of acknowledged){
    const seat=state.seats[id];
    if(!writeBusy&&seat&&!drafts.has(id)&&hasChanges(fields,editableValues(seat))){
      setSaveState(id,'warning','Server data changed again after the last save. Review this seat before editing.');
      acknowledged.delete(id);
    }
  }
}
onValue(ref(db,'.info/connected'),snap=>{connected=snap.val()===true;refreshSaveUI()});
onValue(ref(db,roomPath()),snap=>{
  const raw=snap.val()||{},r=mergeRoomDefaults(raw);
  // Capture any autofill/input that did not dispatch an input event before refresh.
  captureDraftFromDOM();
  indexSeatKeys(raw.seats);
  // Key the view by stable seat ID, but preserve the original database key for writes.
  // This also prevents a synthetic default seat from covering its legacy stored row.
  const displayed={};
  for(const seat of Object.values(r.seats))if(seat?.id)displayed[seat.id]=seat;
  for(const [key,seat] of Object.entries(raw.seats||{})){
    if(!seat||typeof seat!=='object')continue;
    const id=String(seat.id||key);
    if(key===id||!own(raw.seats,id))displayed[id]={...seat,id};
  }
  state.tables=r.tables;state.seats=displayed;state.meta=r.meta||{};
  observeRemoteSeats();render();
},err=>{console.error(err);setSaveState(state.selected,'error','Cannot read Firebase: '+err.message)});
onValue(ref(db,roomPath('activity')),snap=>renderActivity(snap.val()||{}));
if(discardDraftBtn)discardDraftBtn.onclick=()=>{
  const id=state.selected,entry=drafts.get(id);if(!entry||writeBusy)return;
  if(!confirm('Discard this local draft and reload the saved guest details?'))return;
  removeStoredDraft(id,entry.token);drafts.delete(id);saveStates.delete(id);renderPanel(true);
};
if(draftExportBtn)draftExportBtn.onclick=()=>{
  captureDraftFromDOM();
  const blob=new Blob([JSON.stringify({type:'ballroom-unsaved-drafts',build:SAVE_GUARD_BUILD,roomId,createdAt:new Date().toISOString(),drafts:Object.fromEntries(drafts)},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ballroom-${roomId}-unsaved-drafts.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('beforeunload',event=>{
  captureDraftFromDOM();
  if(writeBusy||drafts.size){event.preventDefault();event.returnValue='';}
});
window.BallroomSaveGuard={version:SAVE_GUARD_BUILD,diagnostics:()=>({build:SAVE_GUARD_BUILD,roomId,connected,selected:state.selected,seatKey:state.seatKeys[state.selected]||state.selected,saving:writeBusy,draftCount:drafts.size,status:saveStates.get(state.selected)||null})};

function isLocked(){return state.meta.planLocked===true}
async function ensureEditable(ownSave=false){
  if(writeBusy&&!ownSave){setSaveState(state.selected,'warning','Please wait for the current guest save before changing the plan.');return false;}
  if(!connected){setSaveState(state.selected,'offline','Connection unavailable. Draft kept; wait for ONLINE.');return false;}
  if(!isLocked())return true;
  const p=prompt('The seating plan is locked. Enter PIN 1800 to unlock editing.');
  if(p===null)return false;
  if(p.trim()!=='1800'){alert('Incorrect PIN.');return false;}
  await update(ref(db,roomPath('meta')),{planLocked:false,updatedAt:serverTimestamp()});
  await logActivity('Plan unlocked','Administrator PIN accepted for editing');
  return true;
}
function render(){
  drawBase(canvas,state.tables);
  Object.values(state.seats).sort(sortSeats).forEach(s=>canvas.appendChild(seatEl(s,state.tables[s.tableId],{selected:s.id===state.selected,onClick:clickSeat})));
  renderPanel();renderControls();renderPlanSafety();refreshSaveUI();
  const a=Object.values(state.seats);total.textContent=a.length;assigned.textContent=a.filter(s=>s.guestName||s.groupName).length;checked.textContent=a.filter(s=>s.checkedIn).length;available.textContent=a.filter(s=>!s.guestName&&!s.groupName).length;
}
function renderControls(){
  tableControls.innerHTML='';Object.values(state.tables).sort((a,b)=>a.id.localeCompare(b.id)).forEach(t=>{const d=document.createElement('div');d.className='table-control';d.innerHTML=`<strong>${t.id}</strong><button>+ Row</button><button>− Row</button>`;d.children[1].disabled=false;d.children[2].disabled=false;d.children[1].onclick=()=>addRow(t.id);d.children[2].onclick=()=>removeRow(t.id);tableControls.appendChild(d)});
  [moveGuestMode,moveGroupMode].forEach(b=>b.disabled=false);
}
function renderPlanSafety(){
  if(!planLockBtn)return;
  planLockBtn.textContent=isLocked()?'Unlock Plan':'Lock Plan';
  planLockBtn.classList.toggle('danger',!isLocked());
  planLockBtn.classList.toggle('good',isLocked());
  planStatus.textContent=isLocked()?'LOCKED — check-in only':'EDITABLE';
  planStatus.className=`plan-status ${isLocked()?'locked':'open'}`;
  if(undoBtn)undoBtn.disabled=false;
}
function renderActivity(data){
  if(!activityLog)return;
  const items=Object.values(data).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,50);
  activityLog.innerHTML=items.length?items.map(x=>`<div class="activity-item"><time>${new Date(x.at||0).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time><div><b>${esc(x.action)}</b>${x.detail?`<span>${esc(x.detail)}</span>`:''}</div></div>`).join(''):'<div class="small">No activity yet.</div>';
}

async function addRow(id){
  if(!(await ensureEditable()))return;const t=state.tables[id];if(!t)return alert('Table '+id+' is not ready. Please refresh.');
  await saveUndoSnapshot(`Add row to Table ${id}`);
  const row=Number(t.rows)||0,n=Number(t.nextNumber)||(row*2+1),base={tableId:id,rowIndex:row,status:'available',guestName:'',groupName:'',groupId:'',groupColor:GROUP_COLORS[0].value,conditions:'',notes:'',souvenirEligible:false,confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null};
  await update(ref(db,roomPath()),{[`tables/${id}/rows`]:row+1,[`tables/${id}/nextNumber`]:n+2,[`seats/${id+n}`]:{...base,id:id+n,number:n,side:'left'},[`seats/${id+(n+1)}`]:{...base,id:id+(n+1),number:n+1,side:'right'},'meta/updatedAt':serverTimestamp()});
  await logActivity('Row added',`Table ${id}: ${id+n}, ${id+(n+1)}`);
}
async function removeRow(id){
  if(!(await ensureEditable()))return;const t=state.tables[id],r=t.rows-1,targets=Object.values(state.seats).filter(s=>s.tableId===id&&s.rowIndex===r);if(targets.some(s=>s.guestName||s.confirmed||s.checkedIn))return alert('Last row is in use.');if(!confirm('Remove last row?'))return;
  await saveUndoSnapshot(`Remove row from Table ${id}`);
  const p={[`tables/${id}/rows`]:r,'meta/updatedAt':serverTimestamp()};targets.forEach(s=>p[`seats/${s.id}`]=null);await update(ref(db,roomPath()),p);await logActivity('Row removed',`Table ${id}`);
}
function mode(m){captureDraftFromDOM();state.mode=m;state.source=null;selectMode.classList.toggle('active',m==='select');moveGuestMode.classList.toggle('active',m==='guest');moveGroupMode.classList.toggle('active',m==='group');modeHelp.textContent=m==='select'?'Select a seat to edit it.':m==='guest'?'Select occupied seat, then empty destination.':'Select group member, then first empty destination.'}
selectMode.onclick=()=>mode('select');moveGuestMode.onclick=async()=>{if(await ensureEditable())mode('guest')};moveGroupMode.onclick=async()=>{if(await ensureEditable())mode('group')};
async function clickSeat(s){
  if(state.mode==='select'){captureDraftFromDOM();if(state.selected!==s.id)panelSeatId=null;state.selected=s.id;return render()}
  if(!(await ensureEditable()))return mode('select');
  if(!state.source){if(state.mode==='guest'&&!s.guestName&&!s.groupName)return alert('Choose occupied seat.');if(state.mode==='group'&&!s.groupId)return alert('Seat has no Group ID.');state.source=s.id;return}
  if(s.guestName||s.groupName)return alert('Destination must be empty.');
  if(state.mode==='guest'){
    const a=state.seats[state.source],b=s;await saveUndoSnapshot(`Move ${a.id} to ${b.id}`);
    await update(ref(db,roomPath()),{[`seats/${b.id}`]:{...a,id:b.id,tableId:b.tableId,number:b.number,rowIndex:b.rowIndex,side:b.side},[`seats/${a.id}`]:{...a,status:'available',guestName:'',groupName:'',groupId:'',conditions:'',notes:'',souvenirEligible:false,confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null},'meta/updatedAt':serverTimestamp()});
    await logActivity('Guest moved',`${a.guestName||a.id}: ${a.id} → ${b.id}`);
  }else{
    const src=state.seats[state.source],members=Object.values(state.seats).filter(x=>x.groupId===src.groupId).sort(sortSeats),empties=Object.values(state.seats).filter(x=>!x.guestName&&!x.groupName).sort(sortSeats),i=empties.findIndex(x=>x.id===s.id),dest=empties.slice(i,i+members.length);if(dest.length<members.length)return alert('Not enough empty seats.');
    await saveUndoSnapshot(`Move group ${src.groupName||src.groupId}`);
    const p={'meta/updatedAt':serverTimestamp()};members.forEach(x=>p[`seats/${x.id}`]={...x,status:'available',guestName:'',groupName:'',groupId:'',conditions:'',notes:'',souvenirEligible:false,confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null});members.forEach((x,j)=>p[`seats/${dest[j].id}`]={...x,id:dest[j].id,tableId:dest[j].tableId,number:dest[j].number,rowIndex:dest[j].rowIndex,side:dest[j].side});await update(ref(db,roomPath()),p);await logActivity('Group moved',`${src.groupName||src.groupId} → ${s.id}`);
  }
  mode('select');
}
function snapshotSubmission(){
  const id=state.selected;
  if(!id||!state.seats[id])return null;
  captureDraftFromDOM();
  const entry=draftFor(id);
  // Even a no-change Confirm owns a draft while its request is pending.
  drafts.set(id,entry);storeDraft(id,entry);
  const fields=clone(entry.fields);
  for(const k of ['guestName','groupName','groupId','conditions','notes'])fields[k]=fields[k].trim();
  return {seatId:id,key:state.seatKeys[id]||id,existed:own(state.seatKeys,id),initial:clone(state.seats[id]),draft:clone(entry),fields,requestId:makeGuestCode(),guestCode:makeGuestCode()};
}
function hasServerConflict(current,request,keys){
  const now=editableValues(current);
  const conflicts=keys.filter(k=>!same(now[k],request.draft.base[k])&&!same(now[k],request.fields[k]));
  // A different reservation at the same seat must not inherit this draft.
  const oldCode=request.draft.identityCode||'',newCode=current?.guestCode||'';
  if(oldCode&&newCode!==oldCode)conflicts.push('reservation');
  if(!oldCode&&newCode&&current?.guestName!==request.fields.guestName&&keys.includes('guestName'))conflicts.push('reservation');
  return conflicts;
}
function completeDraftSave(request,saved){
  const entry=drafts.get(request.seatId),savedFields=editableValues(saved);
  acknowledged.set(request.seatId,savedFields);
  if(entry&&entry.token===request.draft.token&&entry.rev===request.draft.rev){
    removeStoredDraft(request.seatId,entry.token);drafts.delete(request.seatId);
    setSaveState(request.seatId,'saved',`Saved to Firebase - ${request.seatId} - ${new Date().toLocaleTimeString()}`);
    if(state.selected===request.seatId)renderPanel(true);
    return;
  }
  if(entry&&entry.token===request.draft.token){
    // Rebase unchanged fields only. Typing done after Save remains unsaved.
    for(const key of FIELD_NAMES)if(same(entry.fields[key],request.draft.fields[key]))entry.fields[key]=savedFields[key];
    entry.base=savedFields;entry.identityCode=saved.guestCode||'';entry.updatedAt=Date.now();
    drafts.set(request.seatId,entry);storeDraft(request.seatId,entry);
    if(state.selected===request.seatId&&!composing)fillForm(entry.fields);
    setSaveState(request.seatId,'dirty',`Earlier details saved for ${request.seatId}. Newer typing is still a draft - press Save again.`);
  }
}
async function submitGuest(confirmNow=false){
  if(writeBusy)return;
  const request=snapshotSubmission();if(!request)return;
  const id=request.seatId;
  if(state.duplicateSeatIds.has(id)){setSaveState(id,'error','Duplicate seat IDs were found in the database. No write was attempted. Export a backup for inspection.');return;}
  if(!connected){setSaveState(id,'offline','Offline: nothing was submitted. Your draft is kept on this device.');return;}
  if(confirmNow&&!request.fields.guestName){setSaveState(id,'error','Enter a guest name before confirming. Your draft is kept.');return;}
  if(request.draft.base.guestName&&!request.fields.guestName){setSaveState(id,'error','An existing name cannot be erased by Save. Use Clear reservation intentionally.');return;}
  writeBusy=true;refreshSaveUI();
  let slowTimer=null,committed=false;
  try{
    if(!(await ensureEditable(true))){setSaveState(id,'dirty','Editing is still locked. Your draft has been kept.');return;}
    setSaveState(id,'saving',`Saving ${id} - waiting for Firebase confirmation...`);
    slowTimer=setTimeout(()=>setSaveState(id,'saving',`Still waiting for Firebase (${id}). Keep this page open; your draft is protected.`),12000);
    // A backup notification must never change the submitted form or clear a draft.
    await saveUndoSnapshot(`${confirmNow?'Confirm':'Edit'} seat ${id}`);
    if(!connected)throw Object.assign(new Error('Connection lost before guest save. Draft kept; reconnect and Save again.'),{code:'OFFLINE'});
    const seatRef=ref(db,roomPath(`seats/${request.key}`));
    const keys=FIELD_NAMES.filter(k=>!same(request.fields[k],request.draft.base[k]));
    let failure='The save was cancelled because this seat changed. Your draft is kept.';
    const result=await runTransaction(seatRef,current=>{
      if(current===null&&request.existed){failure='The selected seat no longer exists in Firebase. Your draft is kept.';return;}
      if(current&&current.id&&current.id!==id){failure='The selected seat ID changed. No guest data was overwritten.';return;}
      const live=current||request.initial;
      const conflicts=hasServerConflict(live,request,keys);
      if(conflicts.length){failure='Someone changed the same guest details ('+Array.from(new Set(conflicts)).join(', ')+'). Your draft is kept; review saved data before retrying.';return;}
      if(state.meta.planLocked===true){failure='The seating plan was locked while saving. Your draft is kept.';return;}
      const next={...live};
      keys.forEach(k=>{next[k]=request.fields[k]});
      if(!current){Object.assign(next,{id:request.initial.id,tableId:request.initial.tableId,number:request.initial.number,rowIndex:request.initial.rowIndex,side:request.initial.side})}
      // Preserve check-in and every unrelated field from the latest server record.
      if(String(next.guestName||'').trim()){
        next.confirmed=true;
        next.guestCode=live.guestCode||request.guestCode;
        if(confirmNow||next.status==='available'||!next.status)next.status='reserved';
      }
      next.updatedAt=serverTimestamp();
      next.adminWriteId=request.requestId;
      return next;
    },{applyLocally:false});
    if(!result.committed){setSaveState(id,'conflict',failure);return;}
    committed=true;
    const saved=result.snapshot.val();
    completeDraftSave(request,saved);
    // Logging failure must not falsely report that an acknowledged guest save failed.
    Promise.resolve(logActivity(confirmNow?'Seat confirmed':'Guest details saved',`${id} ${saved.guestName||'(no name)'}${isGiftEligible(saved)?' - Gift redemption':''}`)).catch(console.warn);
    if(confirmNow){
      if(typeof QRCode==='undefined'){setSaveState(id,'warning','Guest saved. QR library did not load; open Tickets to print later.');return;}
      qrcode.innerHTML='';
      new QRCode(qrcode,{text:qrPayload(saved),width:260,height:260,correctLevel:QRCode.CorrectLevel.H});
      qrInfo.innerHTML=`<strong>${esc(id)}</strong><br>${esc(saved.guestName)}`;
      qrModal.classList.add('open');
      downloadQr.onclick=()=>{
        const img=qrcode.querySelector('canvas')||qrcode.querySelector('img');if(!img)return;
        const a=document.createElement('a');a.download=`${id}-${saved.guestName||'guest'}.png`;a.href=img.tagName==='CANVAS'?img.toDataURL('image/png'):img.src;a.click();
      };
    }
  }catch(err){
    console.error('Save Guard',err);
    const message=committed?'Guest saved, but the follow-up display failed: ':'NOT SAVED. Your draft is kept. ';
    setSaveState(id,'error',message+(err.code?err.code+': ':'')+(err.message||String(err)));
  }finally{
    clearTimeout(slowTimer);writeBusy=false;refreshSaveUI();
  }
}
saveBtn.onclick=()=>submitGuest(false);
confirmBtn.onclick=()=>submitGuest(true);
// Gift selection is a normal draft field, never an independent auto-save.
clearBtn.onclick=async()=>{
  if(writeBusy)return;
  const id=state.selected,s=state.seats[id];if(!s)return;
  if(!(await ensureEditable()))return;
  if(!confirm(`Clear the saved reservation and local draft for ${id}?`))return;
  writeBusy=true;refreshSaveUI();
  try{
    await saveUndoSnapshot(`Clear seat ${id}`);
    const code=s.guestCode||'',key=state.seatKeys[id]||id;
    const result=await runTransaction(ref(db,roomPath(`seats/${key}`)),live=>{
      if(!live||(live.guestCode||'')!==code||String(live.guestName||'')!==String(s.guestName||''))return;
      return {...live,status:'available',guestName:'',groupName:'',groupId:'',conditions:'',notes:'',souvenirEligible:false,giftRedemption:false,giftEligible:false,confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null,updatedAt:serverTimestamp()};
    },{applyLocally:false});
    if(!result.committed){setSaveState(id,'conflict','Reservation changed before Clear. Nothing was cleared.');return;}
    const entry=drafts.get(id);if(entry)removeStoredDraft(id,entry.token);
    drafts.delete(id);acknowledged.delete(id);setSaveState(id,'saved','Reservation cleared in Firebase.');
    if(state.selected===id)renderPanel(true);
    Promise.resolve(logActivity('Reservation cleared',id)).catch(console.warn);
  }catch(err){setSaveState(id,'error','Could not clear the reservation: '+err.message)}
  finally{writeBusy=false;refreshSaveUI();}
};

closeQr.onclick=()=>qrModal.classList.remove('open');

planLockBtn.onclick=async()=>{
  if(writeBusy)return;
  if(isLocked()){
    const p=prompt('Enter PIN to unlock seating plan');if(p===null)return;if(p.trim()!=='1800')return alert('Incorrect PIN.');
    await update(ref(db,roomPath('meta')),{planLocked:false,updatedAt:serverTimestamp()});await logActivity('Plan unlocked','Administrator PIN accepted');
  }else{
    if(!confirm('Lock the seating plan? Check-in will continue, but editing will be disabled.'))return;
    await update(ref(db,roomPath('meta')),{planLocked:true,updatedAt:serverTimestamp()});await logActivity('Plan locked','Editing disabled');mode('select');
  }
};
undoBtn.onclick=async()=>{if(!(await ensureEditable()))return;if(!confirm('Undo the last Admin change?'))return;undoBtn.disabled=true;try{const ok=await undoLastChange();if(!ok)alert('No undo snapshot is available.')}finally{undoBtn.disabled=false}};

snapshotBtn.onclick=async()=>alert('Cloud snapshot created: '+await createCloudBackup('manual'));
exportBtn.onclick=async()=>{const s=await get(ref(db,roomPath()));const b=new Blob([JSON.stringify(s.val(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`ballroom-${roomId}-${Date.now()}.json`;a.click()};
importBtn.onclick=()=>importFile.click();importFile.onchange=async e=>{if(!(await ensureEditable()))return;try{await createCloudBackup('before-import');const data=JSON.parse(await e.target.files[0].text());if(data.type==='ballroom-unsaved-drafts'||!data.seats||!data.tables)throw new Error('This is not a complete ballroom backup. Draft files are not room backups.');await set(ref(db,roomPath()),data);await logActivity('Backup imported',e.target.files[0].name);alert('Imported.')}catch(err){alert('Import failed: '+err.message)}};
restoreBtn.onclick=async()=>{if(!(await ensureEditable()))return;const s=await get(ref(db,roomPath('backups'))),b=s.val()||{},ids=Object.keys(b).sort().reverse();if(!ids.length)return alert('No cloud backups.');const id=prompt('Backup ID to restore:',ids[0]);if(!id||!b[id])return;await createCloudBackup('before-restore');await update(ref(db,roomPath()),{meta:b[id].data.meta,tables:b[id].data.tables,seats:b[id].data.seats});await logActivity('Cloud backup restored',id);alert('Restored.')};
resetBtn.onclick=async()=>{if(!(await ensureEditable()))return;pinModal.classList.add('open')};pinCancel.onclick=()=>pinModal.classList.remove('open');pinConfirm.onclick=async()=>{if(pinInput.value!=='1800')return alert('Incorrect PIN.');await createCloudBackup('before-reset');const fresh=defaultRoom();fresh.backups=(await get(ref(db,roomPath('backups')))).val()||{};await set(ref(db,roomPath()),fresh);await logActivity('Room reset','Fresh standard layout');pinModal.classList.remove('open');pinInput.value='';alert('Reset completed. Backup saved.')};
setupViewport('admin');
$('saveGuardBuild').textContent=SAVE_GUARD_BUILD;
refreshSaveUI();
