const grid = document.getElementById('giftGrid');
const filters = document.getElementById('filters');
const search = document.getElementById('search');
const summary = document.getElementById('summary');
const reserveModal = document.getElementById('reserveModal');
const successModal = document.getElementById('successModal');
const reserveForm = document.getElementById('reserveForm');
const reserveFeedback = document.getElementById('reserveFeedback');
let gifts = [];
let category = 'Todos';

const icons = { airfryer:'🍟', panelas:'🍲', toalhas:'🧺', aspirador:'🧹', pratos:'🍽️', cafeteira:'☕', cama:'🛏️', microondas:'📻', faqueiro:'🍴', copos:'🥛', edredom:'🛌', liquidificador:'🥤', presente:'🎁' };

function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function formatPhone(input){ let v=input.value.replace(/\D/g,'').slice(0,11); if(v.length>10) v=v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3'); else if(v.length>6) v=v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3'); else if(v.length>2) v=v.replace(/(\d{2})(\d+)/,'($1) $2'); input.value=v; }
reserveForm.phone.addEventListener('input',e=>formatPhone(e.target));

function renderFilters(){ const cats=['Todos',...new Set(gifts.map(g=>g.category))]; filters.innerHTML=cats.map(c=>`<button class="filter-btn ${c===category?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join(''); filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{category=b.dataset.cat;renderFilters();renderGifts();}); }
function renderGifts(){ const q=search.value.trim().toLowerCase(); const shown=gifts.filter(g=>(category==='Todos'||g.category===category)&&(!q||g.name.toLowerCase().includes(q)||g.category.toLowerCase().includes(q))); const remaining=gifts.reduce((n,g)=>n+Math.max(0,g.quantity-g.reserved),0); summary.textContent=`${remaining} opção${remaining===1?'':'ões'} ainda disponível${remaining===1?'':'is'}`; if(!shown.length){grid.innerHTML='<div class="loading">Nenhum presente encontrado.</div>';return;} grid.innerHTML=shown.map(g=>{ const left=Math.max(0,g.quantity-g.reserved); const full=left===0; const pct=Math.min(100,(g.reserved/g.quantity)*100); return `<article class="gift-card"><div class="product-art"><span class="emoji">${icons[g.image]||'🎁'}</span></div><div class="gift-card-body"><small class="eyebrow">${esc(g.category)}</small><h3>${esc(g.name)}</h3><p>${esc(g.description)}</p><div class="availability">${g.quantity>1?`<small>${g.reserved} de ${g.quantity} escolhido${g.reserved===1?'':'s'}</small><div class="progress-line"><i style="width:${pct}%"></i></div>`:`<small>${full?'Já escolhido por um convidado':'Disponível para presentear'}</small>`}</div><button ${full?'disabled':''} class="primary reserve-btn" data-id="${g.id}">${full?'Presente já escolhido':'Quero presentear'}</button></div></article>`; }).join(''); grid.querySelectorAll('.reserve-btn:not(:disabled)').forEach(btn=>btn.onclick=()=>openReserve(Number(btn.dataset.id))); }
function openReserve(id){ const g=gifts.find(x=>x.id===id); if(!g)return; reserveForm.reset(); reserveFeedback.textContent=''; reserveForm.giftId.value=id; document.getElementById('modalGiftName').textContent=g.name; document.getElementById('modalGiftArt').innerHTML=`<span class="emoji">${icons[g.image]||'🎁'}</span>`; reserveModal.hidden=false; document.body.style.overflow='hidden'; }
function closeReserve(){reserveModal.hidden=true;document.body.style.overflow='';}
document.querySelector('[data-close]').onclick=closeReserve; reserveModal.addEventListener('click',e=>{if(e.target===reserveModal)closeReserve();});
document.querySelectorAll('[data-close-success]').forEach(b=>b.onclick=()=>{successModal.hidden=true;document.body.style.overflow='';});

reserveForm.addEventListener('submit', async e=>{e.preventDefault(); const fd=new FormData(reserveForm); reserveFeedback.textContent='Reservando...'; const btn=reserveForm.querySelector('button[type=submit]'); btn.disabled=true; try{ const r=await fetch(`/api/reserve/${fd.get('giftId')}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fd.get('name'),phone:fd.get('phone'),confirmed:fd.get('confirmed')==='on'})}); const data=await r.json(); if(!r.ok)throw new Error(data.error||'Não foi possível reservar.'); closeReserve(); successModal.hidden=false; document.body.style.overflow='hidden'; await loadGifts(); }catch(err){reserveFeedback.textContent=err.message;}finally{btn.disabled=false;} });

search.addEventListener('input',renderGifts);
async function loadGifts(){try{const r=await fetch('/api/gifts');gifts=await r.json();renderFilters();renderGifts();}catch{grid.innerHTML='<div class="loading">Não foi possível carregar a lista agora.</div>';}}

document.getElementById('messageForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),fb=document.getElementById('messageFeedback');fb.textContent='Enviando...';try{const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.get('name'),message:f.get('message')})});const d=await r.json();if(!r.ok)throw new Error(d.error);e.target.reset();fb.textContent='Mensagem enviada com carinho. 🤍';}catch(err){fb.textContent=err.message||'Erro ao enviar.';}});
loadGifts();
