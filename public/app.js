const state = { gifts: [], category: 'Todos', selectedGift: null };
const $ = s => document.querySelector(s);

function escapeVisibleText(value) { return String(value ?? ''); }
function categoryEmoji(category = '') {
  const c = category.toLowerCase();
  if (c.includes('cozinha')) return '🍳';
  if (c.includes('quarto')) return '🛏️';
  if (c.includes('banheiro')) return '🛁';
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
  $('#heroTitle').textContent = c.title;
  $('#heroSubtitle').textContent = c.subtitle;
  $('#eventDate').textContent = c.eventDate || 'Data a definir';
  $('#eventTime').textContent = c.eventTime || 'Horário a definir';
  $('#eventPlace').textContent = c.eventPlace || 'Local a definir';
  $('#eventMessage').textContent = c.message;
  const [one, two] = (c.couple || 'Núbia & Daniel').split('&').map(x => x.trim());
  $('#nameOne').textContent = one || 'Núbia';
  $('#nameTwo').textContent = two || 'Daniel';
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

function renderGifts() {
  const grid = $('#giftsGrid');
  grid.replaceChildren();
  const gifts = state.gifts.filter(g => state.category === 'Todos' || g.category === state.category);
  if (!gifts.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nenhum presente nesta categoria ainda.';
    grid.appendChild(empty);
    return;
  }
  gifts.forEach(gift => {
    const card = document.createElement('article');
    card.className = `gift-card ${gift.status !== 'available' ? 'unavailable' : ''}`;

    const status = document.createElement('span');
    status.className = `status-pill ${gift.status}`;
    status.textContent = gift.status === 'available' ? 'Disponível' : gift.status === 'received' ? 'Recebido 💚' : 'Já escolhido';
    card.appendChild(status);

    const visual = document.createElement('div');
    visual.className = 'gift-visual';
    if (gift.image && /^https:\/\//i.test(gift.image)) {
      const img = document.createElement('img');
      img.src = gift.image;
      img.alt = gift.name;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { visual.replaceChildren(makeEmoji(gift.category)); });
      visual.appendChild(img);
    } else visual.appendChild(makeEmoji(gift.category));
    card.appendChild(visual);

    const body = document.createElement('div');
    body.className = 'gift-body';
    const cat = document.createElement('span'); cat.className='gift-category'; cat.textContent = gift.category;
    const title = document.createElement('h3'); title.className='gift-title'; title.textContent = gift.name;
    const desc = document.createElement('p'); desc.className='gift-desc'; desc.textContent = gift.description || 'Um presente especial para a casa nova.';
    const btn = document.createElement('button'); btn.className='btn btn-primary';
    btn.textContent = gift.status === 'available' ? 'Quero presentear' : 'Indisponível';
    btn.disabled = gift.status !== 'available';
    if (gift.status !== 'available') { btn.className='btn btn-soft'; }
    else btn.addEventListener('click', () => openReserve(gift));
    body.append(cat,title,desc,btn);
    card.appendChild(body);
    grid.appendChild(card);
  });
}
function makeEmoji(category) { const span=document.createElement('span'); span.className='gift-icon'; span.textContent=categoryEmoji(category); return span; }

function openReserve(gift) {
  state.selectedGift = gift;
  $('#chosenGiftText').textContent = `Você escolheu: ${gift.name}. Confirme seus dados abaixo.`;
  $('#reserveError').textContent = '';
  $('#reserveForm').reset();
  $('#reserveFormWrap').classList.remove('hidden');
  $('#successPanel').classList.add('hidden');
  $('#reserveModal').classList.add('open');
  setTimeout(() => $('#guestName').focus(), 30);
}
function closeReserve() { $('#reserveModal').classList.remove('open'); }

$('#closeModal').addEventListener('click', closeReserve);
$('#finishModal').addEventListener('click', closeReserve);
$('#reserveModal').addEventListener('click', e => { if (e.target === $('#reserveModal')) closeReserve(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeReserve(); });

$('#guestPhone').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2, v.length === 10 ? 6 : 7)}-${v.slice(v.length === 10 ? 6 : 7)}`;
  else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
  else if (v.length) v = `(${v}`;
  e.target.value = v;
});

$('#reserveForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.selectedGift) return;
  const button = $('#confirmReserve');
  button.disabled = true;
  button.textContent = 'Confirmando...';
  $('#reserveError').textContent = '';
  try {
    const result = await api(`/api/gifts/${encodeURIComponent(state.selectedGift.id)}/reserve`, {
      method: 'POST',
      body: JSON.stringify({ name: $('#guestName').value, phone: $('#guestPhone').value })
    });
    $('#reserveFormWrap').classList.add('hidden');
    $('#successPanel').classList.remove('hidden');
    $('#successText').textContent = result.message;
    await loadGifts();
  } catch (err) {
    $('#reserveError').textContent = err.message;
    if (err.message.includes('outra pessoa')) await loadGifts();
  } finally {
    button.disabled = false;
    button.textContent = 'Confirmar que vou dar este presente';
  }
});

Promise.all([loadConfig(), loadGifts()]).catch(err => {
  console.error(err);
  $('#giftsGrid').innerHTML = '<div class="empty">Não foi possível carregar a lista agora. Tente atualizar a página.</div>';
});
