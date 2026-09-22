const state = { gifts: [], category: 'Todos', selectedGift: null };
const $ = s => document.querySelector(s);

function categoryEmoji(category = '') {
  const c = category.toLowerCase();
  if (c.includes('cozinha')) return '🍳';
  if (c.includes('quarto') || c.includes('cama')) return '🛏️';
  if (c.includes('banheiro') || c.includes('banho')) return '🛁';
  if (c.includes('lav')) return '🧺';
  if (c.includes('eletro')) return '🔌';
  if (c.includes('decor')) return '🪴';
  return '🎁';
}

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a ação.');
  return data;
}

async function loadConfig() {
  const c = await api('/api/config');
  $('#heroTitle').textContent = c.title || 'Chá dos Noivos';
  $('#heroSubtitle').textContent = c.subtitle || 'Estamos muito felizes em compartilhar esse momento especial com vocês.';
  $('#eventDate').textContent = c.eventDate || 'Data a definir';
  $('#eventTime').textContent = c.eventTime || 'Horário a definir';
  $('#eventPlace').textContent = c.eventPlace || 'Local a definir';
  $('#eventMessage').textContent = c.message || 'Escolha um presente da nossa lista e leve no dia do chá.';
  $('#invitationMessage').textContent = c.invitationMessage || 'Sua presença vai deixar esse momento ainda mais especial. Confirme abaixo se poderá estar com a gente.';
  const [one, two] = (c.couple || 'Daniel & Núbia').split('&').map(x => x.trim());
  $('#nameOne').textContent = one || 'Daniel';
  $('#nameTwo').textContent = two || 'Núbia';
}

async function loadGifts() {
  state.gifts = await api('/api/gifts');
  renderFilters();
  renderGifts();
}

function renderFilters() {
  const categories = ['Todos', ...new Set(state.gifts.map(g => g.category).filter(Boolean))];
  const wrap = $('#giftFilters');
  wrap.replaceChildren();
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `filter-chip ${state.category === cat ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => { state.category = cat; renderFilters(); renderGifts(); });
    wrap.appendChild(btn);
  });
}

function makeEmoji(category) { const span=document.createElement('span'); span.className='gift-icon'; span.textContent=categoryEmoji(category); return span; }
function buildGiftImage(gift, cls='') {
  const visual = document.createElement('div'); visual.className = cls || 'gift-visual';
  if (gift.image && /^https?:\/\//i.test(gift.image)) {
    const img = document.createElement('img'); img.src=gift.image; img.alt=gift.name; img.loading='lazy'; img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>visual.replaceChildren(makeEmoji(gift.category)));
    visual.appendChild(img);
  } else visual.appendChild(makeEmoji(gift.category));
  return visual;
}

function renderGifts() {
  const grid = $('#giftsGrid'); grid.replaceChildren();
  const gifts = state.gifts.filter(g => state.category === 'Todos' || g.category === state.category);
  if (!gifts.length) { const empty=document.createElement('div'); empty.className='empty'; empty.textContent='Nenhum presente nesta categoria ainda.'; grid.appendChild(empty); return; }
  gifts.forEach(gift => {
    const card = document.createElement('article'); card.className=`gift-card ${gift.status !== 'available' ? 'unavailable' : ''}`;
    const status=document.createElement('span'); status.className=`status-pill ${gift.status}`; status.textContent=gift.status==='available'?'Disponível':gift.status==='received'?'Já presenteado ✓':'Reservado'; card.appendChild(status);
    card.appendChild(buildGiftImage(gift));
    const body=document.createElement('div'); body.className='gift-body';
    const cat=document.createElement('span'); cat.className='gift-category'; cat.textContent=gift.category || 'Outros';
    const title=document.createElement('h3'); title.className='gift-title'; title.textContent=gift.name;
    const desc=document.createElement('p'); desc.className='gift-desc'; desc.textContent=gift.description || 'Um presente especial para a casa nova.';
    const actions=document.createElement('div'); actions.className='gift-actions';
    if (gift.purchaseUrl) { const shop=document.createElement('a'); shop.className='btn btn-secondary btn-card'; shop.href=gift.purchaseUrl; shop.target='_blank'; shop.rel='noopener noreferrer nofollow'; shop.textContent='🛍️ Onde comprar'; actions.appendChild(shop); }
    const btn=document.createElement('button'); btn.className=gift.status==='available'?'btn btn-primary btn-card':'btn btn-soft btn-card'; btn.textContent=gift.status==='available'?'🎁 Quero presentear':'Indisponível'; btn.disabled=gift.status!=='available'; if(gift.status==='available') btn.addEventListener('click',()=>openReserve(gift)); actions.appendChild(btn);
    body.append(cat,title,desc,actions); card.appendChild(body); grid.appendChild(card);
  });
}

function openReserve(gift) {
  state.selectedGift=gift;
  $('#chosenGiftText').textContent=`Você escolheu: ${gift.name}. Confirme seus dados para deixar este item reservado em seu nome.`;
  $('#reserveError').textContent=''; $('#reserveForm').reset(); $('#reserveFormWrap').classList.remove('hidden'); $('#successPanel').classList.add('hidden');
  const chosen=$('#chosenGiftCard'); chosen.replaceChildren(buildGiftImage(gift,'chosen-gift-image')); const info=document.createElement('div'); const strong=document.createElement('strong'); strong.textContent=gift.name; const small=document.createElement('span'); small.textContent=gift.category || 'Presente'; info.append(strong,small); chosen.appendChild(info);
  const link=$('#modalStoreLink'); const successLink=$('#successStoreLink');
  if(gift.purchaseUrl){ link.href=gift.purchaseUrl; successLink.href=gift.purchaseUrl; link.classList.remove('hidden'); successLink.classList.remove('hidden'); } else { link.classList.add('hidden'); successLink.classList.add('hidden'); }
  $('#reserveModal').classList.add('open'); setTimeout(()=>$('#guestName').focus(),30);
}
function closeReserve(){ $('#reserveModal').classList.remove('open'); }
$('#closeModal').addEventListener('click',closeReserve); $('#finishModal').addEventListener('click',closeReserve); $('#reserveModal').addEventListener('click',e=>{if(e.target===$('#reserveModal'))closeReserve();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')closeReserve();});

function maskPhoneInput(input){ input.addEventListener('input',e=>{ let v=e.target.value.replace(/\D/g,'').slice(0,11); if(v.length>6)v=`(${v.slice(0,2)}) ${v.slice(2,v.length===10?6:7)}-${v.slice(v.length===10?6:7)}`; else if(v.length>2)v=`(${v.slice(0,2)}) ${v.slice(2)}`; else if(v.length)v=`(${v}`; e.target.value=v; }); }
maskPhoneInput($('#guestPhone')); maskPhoneInput($('#rsvpPhone'));

$('#reserveForm').addEventListener('submit',async e=>{
  e.preventDefault(); if(!state.selectedGift)return; const button=$('#confirmReserve'); button.disabled=true; button.textContent='Confirmando...'; $('#reserveError').textContent='';
  try{ const result=await api(`/api/gifts/${encodeURIComponent(state.selectedGift.id)}/reserve`,{method:'POST',body:JSON.stringify({name:$('#guestName').value,phone:$('#guestPhone').value})}); $('#reserveFormWrap').classList.add('hidden'); $('#successPanel').classList.remove('hidden'); $('#successText').textContent=result.message; await loadGifts(); }
  catch(err){ $('#reserveError').textContent=err.message; if(err.message.includes('outra pessoa'))await loadGifts(); }
  finally{ button.disabled=false; button.textContent='Confirmar que vou dar este presente'; }
});

$('#rsvpForm').addEventListener('submit',async e=>{
  e.preventDefault(); const button=$('#rsvpSubmit'); button.disabled=true; button.textContent='Salvando confirmação...'; $('#rsvpError').textContent=''; $('#rsvpSuccess').classList.add('hidden');
  try{ const result=await api('/api/rsvp',{method:'POST',body:JSON.stringify({name:$('#rsvpName').value,phone:$('#rsvpPhone').value,attending:$('#rsvpAttending').value,note:$('#rsvpNote').value})}); $('#rsvpSuccess').textContent=result.message; $('#rsvpSuccess').classList.remove('hidden'); e.currentTarget.reset(); }
  catch(err){ $('#rsvpError').textContent=err.message; }
  finally{ button.disabled=false; button.textContent='Confirmar resposta'; }
});

Promise.all([loadConfig(),loadGifts()]).catch(err=>{ console.error(err); $('#giftsGrid').innerHTML='<div class="empty">Não foi possível carregar a lista agora. Tente atualizar a página.</div>'; });
