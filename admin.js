import{db,roomPath,roomId,ref,onValue,get,set,update,serverTimestamp,ensureRoom,normalize,GROUP_COLORS,drawBase,seatEl,sortSeats,makeGuestCode,qrPayload,createCloudBackup,setupViewport,defaultRoom,mergeRoomDefaults,esc,logActivity,saveUndoSnapshot,undoLastChange,isGiftEligible}from'./common.js?v=20260921-adminfixv3';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),colorInput=$('colorInput'),emptyState=$('emptyState'),seatPanel=$('seatPanel'),seatTitle=$('seatTitle'),statusInput=$('statusInput'),guestInput=$('guestInput'),groupInput=$('groupInput'),groupIdInput=$('groupIdInput'),souvenirInput=$('souvenirInput'),conditionsInput=$('conditionsInput'),notesInput=$('notesInput'),saveBtn=$('saveBtn'),confirmBtn=$('confirmBtn'),clearBtn=$('clearBtn'),tableControls=$('tableControls'),total=$('total'),assigned=$('assigned'),checked=$('checked'),available=$('available'),selectMode=$('selectMode'),moveGuestMode=$('moveGuestMode'),moveGroupMode=$('moveGroupMode'),modeHelp=$('modeHelp'),qrcode=$('qrcode'),qrInfo=$('qrInfo'),qrModal=$('qrModal'),downloadQr=$('downloadQr'),closeQr=$('closeQr'),snapshotBtn=$('snapshotBtn'),exportBtn=$('exportBtn'),restoreBtn=$('restoreBtn'),importBtn=$('importBtn'),importFile=$('importFile'),resetBtn=$('resetBtn'),pinModal=$('pinModal'),pinInput=$('pinInput'),pinConfirm=$('pinConfirm'),pinCancel=$('pinCancel'),planLockBtn=$('planLockBtn'),planStatus=$('planStatus'),undoBtn=$('undoBtn'),activityLog=$('activityLog');

await ensureRoom();
const state={tables:{},seats:{},meta:{planLocked:false},selected:null,mode:'select',source:null};
let formDirty=false, panelSeatId=null;
GROUP_COLORS.forEach(c=>colorInput.add(new Option(c.label,c.value)));
[statusInput,guestInput,groupInput,groupIdInput,colorInput,souvenirInput,conditionsInput,notesInput].forEach(el=>{
  el.addEventListener('input',()=>{formDirty=true});
  el.addEventListener('change',()=>{formDirty=true});
});

onValue(ref(db,roomPath()),s=>{
  const r=mergeRoomDefaults(s.val()||{});state.tables=r.tables;state.seats=r.seats;state.meta=r.meta||{};render();
},err=>{console.error(err);alert('Firebase read error: '+err.message)});

onValue(ref(db,roomPath('activity')),s=>renderActivity(s.val()||{}));

function isLocked(){return state.meta.planLocked===true}
async function ensureEditable(){
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
  renderPanel();renderControls();renderPlanSafety();
  const a=Object.values(state.seats);total.textContent=a.length;assigned.textContent=a.filter(s=>s.guestName||s.groupName).length;checked.textContent=a.filter(s=>s.checkedIn).length;available.textContent=a.filter(s=>!s.guestName&&!s.groupName).length;
}
function renderPanel(force=false){
  const s=state.seats[state.selected];
  emptyState.hidden=!!s;seatPanel.hidden=!s;
  if(!s){panelSeatId=null;formDirty=false;return;}
  seatTitle.textContent='Seat '+s.id;
  // Never wipe an in-progress form because Firebase emitted a room update.
  // This is especially important when another check-in station is active.
  if(!force&&formDirty&&panelSeatId===s.id){
    seatPanel.classList.toggle('plan-locked-form',isLocked());
    return;
  }
  panelSeatId=s.id;
  statusInput.value=s.status||'available';
  guestInput.value=s.guestName||'';
  groupInput.value=s.groupName||'';
  groupIdInput.value=s.groupId||'';
  colorInput.value=s.groupColor||GROUP_COLORS[0].value;
  souvenirInput.value=isGiftEligible(s)?'yes':'no';
  conditionsInput.value=s.conditions||'';
  notesInput.value=s.notes||'';
  seatPanel.classList.toggle('plan-locked-form',isLocked());
  formDirty=false;
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
function mode(m){state.mode=m;state.source=null;selectMode.classList.toggle('active',m==='select');moveGuestMode.classList.toggle('active',m==='guest');moveGroupMode.classList.toggle('active',m==='group');modeHelp.textContent=m==='select'?'Select a seat to edit it.':m==='guest'?'Select occupied seat, then empty destination.':'Select group member, then first empty destination.'}
selectMode.onclick=()=>mode('select');moveGuestMode.onclick=async()=>{if(await ensureEditable())mode('guest')};moveGroupMode.onclick=async()=>{if(await ensureEditable())mode('group')};
async function clickSeat(s){
  if(state.mode==='select'){if(state.selected!==s.id){formDirty=false;panelSeatId=null}state.selected=s.id;return render()}
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
function captureForm(){
  return{
    status:statusInput.value,
    guestName:guestInput.value.trim(),
    groupName:groupInput.value.trim(),
    groupId:groupIdInput.value.trim(),
    groupColor:colorInput.value,
    souvenirEligible:souvenirInput.value==='yes',
    conditions:conditionsInput.value.trim(),
    notes:notesInput.value.trim(),
    updatedAt:Date.now()
  };
}
function guestSaveExtras(s,draft){
  const name=draft.guestName;
  if(!name)return{confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null,status:'available'};
  return{
    confirmed:true,
    guestCode:s.guestCode||makeGuestCode(),
    status:draft.status==='available'?'reserved':draft.status
  };
}
async function persistSeat(s,draft,extra={}){
  if(!s)return null;
  // IMPORTANT: draft is captured BEFORE any backup/meta write can trigger onValue().
  const patch={...draft,...guestSaveExtras(s,draft),...extra};
  await update(ref(db,roomPath(`seats/${s.id}`)),patch);
  return{...s,...patch};
}
async function finishSuccessfulEdit(next){
  formDirty=false;
  if(next&&state.selected===next.id){
    state.seats[next.id]={...(state.seats[next.id]||{}),...next};
    renderPanel(true);
  }
}
saveBtn.onclick=async()=>{
  const seatId=state.selected;
  const initial=state.seats[seatId];
  if(!initial)return;
  const draft=captureForm(); // capture first — before unlock / backup / Firebase refresh
  if(!(await ensureEditable()))return;
  const s=state.seats[seatId]||initial;
  try{
    saveBtn.disabled=true;
    await saveUndoSnapshot(`Edit seat ${s.id}`);
    const next=await persistSeat(s,draft);
    await finishSuccessfulEdit(next);
    await logActivity('Guest details saved',`${s.id} ${next.guestName||'(empty)'}${next.souvenirEligible?' · Gift redemption':''}`);
  }catch(err){console.error(err);alert('Could not save this guest: '+err.message)}finally{saveBtn.disabled=false}
};
souvenirInput.addEventListener('change',async()=>{
  const seatId=state.selected;
  const initial=state.seats[seatId];
  if(!initial)return;
  const draft=captureForm(); // preserve Yes/No and any typed guest details immediately
  if(!(await ensureEditable())){renderPanel(true);return;}
  const s=state.seats[seatId]||initial;
  try{
    const next=await persistSeat(s,draft);
    await finishSuccessfulEdit(next);
    await logActivity('Gift redemption changed',`${s.id}: ${next.souvenirEligible?'YES':'NO'}`);
  }catch(err){console.error(err);alert('Could not update Gift redemption: '+err.message);renderPanel(true)}
});
confirmBtn.onclick=async()=>{
  const seatId=state.selected;
  const initial=state.seats[seatId];
  if(!initial)return;
  const draft=captureForm(); // capture before saveUndoSnapshot triggers room onValue
  if(!draft.guestName)return alert('Enter guest name.');
  if(!(await ensureEditable()))return;
  const s=state.seats[seatId]||initial;
  try{
    confirmBtn.disabled=true;
    await saveUndoSnapshot(`Confirm seat ${s.id}`);
    const next=await persistSeat(s,draft,{status:'reserved',confirmed:true,guestCode:s.guestCode||makeGuestCode()});
    await finishSuccessfulEdit(next);
    await logActivity('Seat confirmed',`${s.id} ${next.guestName}${next.souvenirEligible?' · Gift redemption':''}`);
    qrcode.innerHTML='';
    new QRCode(qrcode,{text:qrPayload(next),width:260,height:260,correctLevel:QRCode.CorrectLevel.H});
    qrInfo.innerHTML=`<strong>${esc(next.id)}</strong><br>${esc(next.guestName)}`;
    qrModal.classList.add('open');
    downloadQr.onclick=()=>{const img=qrcode.querySelector('img')||qrcode.querySelector('canvas');const a=document.createElement('a');a.download=`${next.id}-${next.guestName||'guest'}.png`;a.href=img.tagName==='CANVAS'?img.toDataURL('image/png'):img.src;a.click()};
  }catch(err){console.error(err);alert('Could not confirm this guest: '+err.message)}finally{confirmBtn.disabled=false}
};
clearBtn.onclick=async()=>{
  if(!(await ensureEditable()))return;
  const s=state.seats[state.selected];if(!s)return;
  await saveUndoSnapshot(`Clear seat ${s.id}`);
  await set(ref(db,roomPath(`seats/${s.id}`)),{...s,status:'available',guestName:'',groupName:'',groupId:'',conditions:'',notes:'',souvenirEligible:false,confirmed:false,guestCode:'',checkedIn:false,checkedInAt:null});
  formDirty=false;panelSeatId=s.id;await logActivity('Reservation cleared',s.id);
};
closeQr.onclick=()=>qrModal.classList.remove('open');

planLockBtn.onclick=async()=>{
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
importBtn.onclick=()=>importFile.click();importFile.onchange=async e=>{if(!(await ensureEditable()))return;try{await createCloudBackup('before-import');const data=JSON.parse(await e.target.files[0].text());await set(ref(db,roomPath()),data);await logActivity('Backup imported',e.target.files[0].name);alert('Imported.')}catch(err){alert('Import failed: '+err.message)}};
restoreBtn.onclick=async()=>{if(!(await ensureEditable()))return;const s=await get(ref(db,roomPath('backups'))),b=s.val()||{},ids=Object.keys(b).sort().reverse();if(!ids.length)return alert('No cloud backups.');const id=prompt('Backup ID to restore:',ids[0]);if(!id||!b[id])return;await createCloudBackup('before-restore');await update(ref(db,roomPath()),{meta:b[id].data.meta,tables:b[id].data.tables,seats:b[id].data.seats});await logActivity('Cloud backup restored',id);alert('Restored.')};
resetBtn.onclick=async()=>{if(!(await ensureEditable()))return;pinModal.classList.add('open')};pinCancel.onclick=()=>pinModal.classList.remove('open');pinConfirm.onclick=async()=>{if(pinInput.value!=='1800')return alert('Incorrect PIN.');await createCloudBackup('before-reset');const fresh=defaultRoom();fresh.backups=(await get(ref(db,roomPath('backups')))).val()||{};await set(ref(db,roomPath()),fresh);await logActivity('Room reset','Fresh standard layout');pinModal.classList.remove('open');pinInput.value='';alert('Reset completed. Backup saved.')};
setupViewport('admin');
