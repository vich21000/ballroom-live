import{db,roomPath,ref,onValue,ensureRoom,normalize,sortSeats,esc}from'./common.js?v=20260921-adminfixv3';
const $=id=>document.getElementById(id),sheets=$('placecardSheets');
await ensureRoom();let seats={},side='duplex',filter='confirmed';
onValue(ref(db,roomPath('seats')),s=>{seats=normalize(s.val());render()});
function menuUrl(){return new URL('menu.html',location.href).href.split('?')[0]}
function list(){return Object.values(seats).filter(s=>s.guestName&&(filter==='all'||s.confirmed)).sort(sortSeats)}
function makeFront(chunk){
  const page=document.createElement('div');page.className='placecard-page placecard-front-page';
  chunk.forEach(s=>{
    const card=document.createElement('div');card.className='placecard-row';
    card.innerHTML=s?`<div class="placecard-panel seat-panel"><strong>${esc(s.id)}</strong></div><div class="placecard-fold-line"></div><div class="placecard-panel name-panel"><div class="placecard-fullname">${esc(s.guestName)}</div><img class="placecard-wedding-logo" src="assets/color-logo.png" alt="event logo"></div>`:`<div class="placecard-panel"></div><div class="placecard-fold-line"></div><div class="placecard-panel"></div>`;
    page.appendChild(card);
  });return page;
}
function makeBack(chunk){
  const page=document.createElement('div');page.className='placecard-page placecard-back-page';
  chunk.forEach(s=>{
    const card=document.createElement('div');card.className='placecard-row';
    card.innerHTML=s?`<div class="placecard-panel menu-label-panel"><img class="placecard-menu-logo" src="assets/color-logo.png" alt="event logo"><strong>DINNER MENU</strong><div class="menu-explore-en">Explore tonight’s buffet selection</div><div class="menu-explore-th">รายการอาหารค่ำสำหรับค่ำคืนนี้</div></div><div class="placecard-fold-line"></div><div class="placecard-panel menu-qr-panel"><div class="menu-placecard-qr"></div><div class="menu-scan-text">SCAN TO VIEW MENU</div></div>`:`<div class="placecard-panel"></div><div class="placecard-fold-line"></div><div class="placecard-panel"></div>`;
    page.appendChild(card);if(s)new QRCode(card.querySelector('.menu-placecard-qr'),{text:menuUrl(),width:142,height:142,correctLevel:QRCode.CorrectLevel.H});
  });return page;
}
function fitNames(){document.querySelectorAll('.placecard-fullname').forEach(el=>{let n=24;el.style.fontSize=n+'pt';while(n>12&&(el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight)){n-=.5;el.style.fontSize=n+'pt'}})}
function render(){
  const a=list();sheets.innerHTML='';const source=a.length?a:[null];
  for(let i=0;i<source.length;i+=3){const chunk=source.slice(i,i+3);while(chunk.length<3)chunk.push(null);if(side==='duplex'||side==='front')sheets.appendChild(makeFront(chunk));if(side==='duplex'||side==='back')sheets.appendChild(makeBack(chunk))}
  duplexBtn.classList.toggle('active',side==='duplex');frontBtn.classList.toggle('active',side==='front');backBtn.classList.toggle('active',side==='back');confirmedBtn.classList.toggle('active',filter==='confirmed');allBtn.classList.toggle('active',filter==='all');requestAnimationFrame(fitNames);
}
duplexBtn.onclick=()=>{side='duplex';render()};frontBtn.onclick=()=>{side='front';render()};backBtn.onclick=()=>{side='back';render()};confirmedBtn.onclick=()=>{filter='confirmed';render()};allBtn.onclick=()=>{filter='all';render()};printBtn.onclick=()=>window.print();
