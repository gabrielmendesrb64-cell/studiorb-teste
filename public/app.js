const state = { gifts: [], category: 'Todos', selectedGift: null, config: {} };
const $ = s => document.querySelector(s);

function categoryEmoji(category = '') {
  const c = category.toLowerCase();
  if (c.includes('cozinha')) return '🍳';
  if (c.includes('cama') || c.includes('quarto')) return '🛏️';
  if (c.includes('banho')) return '🛁';
  if (c.includes('eletro')) return '🔌';
  if (c.includes('casa')) return '🏠';
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
  state.config = c;
  const setText = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  setText('#eventDate', c.eventDate || 'Data a definir');
  setText('#eventTime', c.eventTime || 'Horário a definir');
  setText('#eventPlace', c.eventPlace || 'Local a definir');
  setText('#eventMessage', c.message || 'Escolha um presente da nossa lista, veja o link desejado pelos noivos e leve no dia do chá.');
  setText('#invitationMessage', c.invitationMessage || 'Coloque o nome completo de cada pessoa que irá ao chá.');
  const couple = c.couple || 'Daniel e Núbia';
  setText('#pixKeyText', c.pixKey || 'Chave a definir');
  setText('#pixReceiverText', c.pixReceiver || couple);
  $('#copyPixBtn').disabled = !c.pixKey;
  $('#copyPixBtn').textContent = c.pixKey ? 'Copiar chave PIX' : 'PIX ainda não configurado';
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
    btn.type = 'button';
    btn.textContent = cat;
    btn.addEventListener('click', () => { state.category = cat; renderFilters(); renderGifts(); });
    wrap.appendChild(btn);
  });
}

function makeEmoji(category) {
  const span = document.createElement('span');
  span.className = 'gift-icon';
  span.textContent = categoryEmoji(category);
  return span;
}

function buildGiftImage(gift, cls = '') {
  const visual = document.createElement('div');
  visual.className = cls || 'gift-visual';
  if (gift.image && /^https?:\/\//i.test(gift.image)) {
    const img = document.createElement('img');
    img.src = gift.image;
    img.alt = gift.name;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => visual.replaceChildren(makeEmoji(gift.category)));
    visual.appendChild(img);
  } else {
    visual.appendChild(makeEmoji(gift.category));
  }
  return visual;
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
    const available = Number(gift.availableQuantity ?? (gift.status === 'available' ? 1 : 0));
    const total = Math.max(1, Number(gift.quantity || 1));
    const unavailable = available <= 0;
    const card = document.createElement('article');
    card.className = `gift-card ${unavailable ? 'unavailable' : ''}`;
    card.appendChild(buildGiftImage(gift));

    const body = document.createElement('div');
    body.className = 'gift-body';
    const status = document.createElement('span');
    status.className = `status-pill ${unavailable ? (gift.status || 'reserved') : 'available'}`;
    if (!unavailable) status.textContent = total > 1 ? `${available} de ${total} disponíveis` : 'Disponível';
    else status.textContent = gift.status === 'received' ? 'Todos presenteados ✓' : 'Todas as unidades reservadas';

    const cat = document.createElement('span');
    cat.className = 'gift-category';
    cat.textContent = gift.category || 'Outros';
    const title = document.createElement('h3');
    title.className = 'gift-title';
    title.textContent = gift.name;
    const desc = document.createElement('p');
    desc.className = 'gift-desc';
    desc.textContent = gift.description || 'Um presente especial para a casa nova.';

    if (total > 1) {
      const quantity = document.createElement('div');
      quantity.className = 'gift-quantity-note';
      quantity.innerHTML = `<strong>${total} unidades desejadas</strong><span>Cada convidado reserva 1 unidade.</span>`;
      body.append(status, cat, title, desc, quantity);
    } else {
      body.append(status, cat, title, desc);
    }

    const actions = document.createElement('div');
    actions.className = 'gift-actions';

    if (gift.purchaseUrl) {
      const link = document.createElement('a');
      link.className = 'btn btn-secondary btn-card';
      link.href = gift.purchaseUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.textContent = '↗ Ver presente desejado';
      actions.appendChild(link);
    } else {
      const noLink = document.createElement('button');
      noLink.className = 'btn btn-secondary btn-card';
      noLink.type = 'button';
      noLink.disabled = true;
      noLink.textContent = 'Link em breve';
      actions.appendChild(noLink);
    }

    const btn = document.createElement('button');
    btn.className = !unavailable ? 'btn btn-primary btn-card' : 'btn btn-soft btn-card';
    btn.type = 'button';
    btn.textContent = !unavailable ? '🎁 Quero presentear' : 'Indisponível';
    btn.disabled = unavailable;
    if (!unavailable) btn.addEventListener('click', () => openReserve(gift));
    actions.appendChild(btn);

    body.appendChild(actions);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function openReserve(gift) {
  state.selectedGift = gift;
  const available = Number(gift.availableQuantity || 1);
  const total = Math.max(1, Number(gift.quantity || 1));
  $('#chosenGiftText').textContent = total > 1
    ? `Você escolheu ${gift.name}. Esta confirmação reserva 1 unidade. Ainda há ${available} de ${total} disponíveis.`
    : `Você escolheu ${gift.name}. Confirme seus dados para este item ficar reservado em seu nome.`;
  $('#reserveError').textContent = '';
  $('#reserveForm').reset();
  $('#reserveFormWrap').classList.remove('hidden');
  $('#successPanel').classList.add('hidden');
  const chosen = $('#chosenGiftCard');
  chosen.replaceChildren(buildGiftImage(gift, 'chosen-gift-image'));
  const info = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = gift.name;
  const small = document.createElement('span');
  small.textContent = gift.category || 'Presente';
  info.append(strong, small);
  chosen.appendChild(info);

  const link = $('#modalStoreLink');
  const successLink = $('#successStoreLink');
  if (gift.purchaseUrl) {
    link.href = gift.purchaseUrl;
    successLink.href = gift.purchaseUrl;
    link.classList.remove('hidden');
    successLink.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
    successLink.classList.add('hidden');
  }
  $('#reserveModal').classList.add('open');
  setTimeout(() => $('#guestName').focus(), 30);
}

function closeReserve() { $('#reserveModal').classList.remove('open'); }
$('#closeModal').addEventListener('click', closeReserve);
$('#finishModal').addEventListener('click', closeReserve);
$('#reserveModal').addEventListener('click', e => { if (e.target === $('#reserveModal')) closeReserve(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeReserve();
    closePix();
  }
});

function maskPhoneInput(input) {
  input.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2, v.length === 10 ? 6 : 7)}-${v.slice(v.length === 10 ? 6 : 7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length) v = `(${v}`;
    e.target.value = v;
  });
}
maskPhoneInput($('#guestPhone'));

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

function addRsvpName(value = '', focus = false) {
  const row = document.createElement('div');
  row.className = 'name-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rsvp-name-input';
  input.maxLength = 80;
  input.required = true;
  input.placeholder = 'Nome completo de quem vai';
  input.autocomplete = 'name';
  input.value = value;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-name';
  remove.textContent = '×';
  remove.title = 'Remover este nome';
  remove.addEventListener('click', () => {
    const rows = $('#rsvpNames').querySelectorAll('.name-row');
    if (rows.length <= 1) { input.value = ''; input.focus(); return; }
    row.remove();
  });
  row.append(input, remove);
  $('#rsvpNames').appendChild(row);
  if (focus) input.focus();
}

function resetRsvpNames() {
  $('#rsvpNames').replaceChildren();
  addRsvpName();
}

$('#addRsvpName').addEventListener('click', () => addRsvpName('', true));
$('#rsvpForm').addEventListener('submit', async e => {
  e.preventDefault();
  const names = [...document.querySelectorAll('.rsvp-name-input')].map(i => i.value.trim()).filter(Boolean);
  const button = $('#rsvpSubmit');
  $('#rsvpError').textContent = '';
  $('#rsvpSuccess').classList.add('hidden');
  if (!names.length) { $('#rsvpError').textContent = 'Informe pelo menos um nome completo.'; return; }
  if (names.some(n => n.length < 3)) { $('#rsvpError').textContent = 'Confira os nomes completos informados.'; return; }
  button.disabled = true;
  button.textContent = 'Confirmando...';
  try {
    const result = await api('/api/rsvp', { method: 'POST', body: JSON.stringify({ names }) });
    $('#rsvpSuccess').textContent = result.message;
    $('#rsvpSuccess').classList.remove('hidden');
    resetRsvpNames();
  } catch (err) {
    $('#rsvpError').textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = '✓ Confirmar presença';
  }
});

function openPix() {
  $('#pixCopySuccess').classList.add('hidden');
  $('#pixModal').classList.add('open');
}
function closePix() { $('#pixModal').classList.remove('open'); }
$('#pixCard').addEventListener('click', openPix);
$('#pixCard').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPix(); } });
$('#closePixModal').addEventListener('click', closePix);
$('#pixModal').addEventListener('click', e => { if (e.target === $('#pixModal')) closePix(); });
$('#copyPixBtn').addEventListener('click', async () => {
  const key = state.config.pixKey || '';
  if (!key) return;
  try {
    await navigator.clipboard.writeText(key);
  } catch {
    const t = document.createElement('textarea');
    t.value = key;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  $('#pixCopySuccess').classList.remove('hidden');
});

resetRsvpNames();
Promise.all([loadConfig(), loadGifts()]).catch(err => {
  console.error(err);
  $('#giftsGrid').innerHTML = '<div class="empty">Não foi possível carregar a lista agora. Tente atualizar a página.</div>';
});
