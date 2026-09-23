const $ = s => document.querySelector(s);
const tokenKey = 'nd_admin_token';
let token = localStorage.getItem(tokenKey) || '';
let dashboardData = null;
let previewTimer = null;

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && url !== '/api/admin/login') logout(false);
    throw new Error(data.error || 'Não foi possível concluir a ação.');
  }
  return data;
}

function showDashboard() {
  $('#loginPanel').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
}
function showLogin() {
  $('#dashboard').classList.add('hidden');
  $('#loginPanel').classList.remove('hidden');
}
function logout(clear = true) {
  if (clear) {
    token = '';
    localStorage.removeItem(tokenKey);
  }
  showLogin();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  const button = e.currentTarget.querySelector('button[type="submit"]');
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Entrando...';
  try {
    const result = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: $('#adminPassword').value })
    });
    token = result.token;
    localStorage.setItem(tokenKey, token);
    $('#adminPassword').value = '';
    showDashboard();
    await loadDashboard();
  } catch (err) {
    $('#loginError').textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});
$('#logoutBtn').addEventListener('click', () => logout(true));

function giftCounts(gift) {
  const quantity = Math.max(1, Number(gift.quantity || 1));
  const reservations = Array.isArray(gift.reservations) ? gift.reservations : [];
  const reservedRows = reservations.filter(r => r.status !== 'received');
  const receivedRows = reservations.filter(r => r.status === 'received');
  return {
    quantity,
    reservations,
    reservedRows,
    receivedRows,
    reserved: reservedRows.length,
    received: receivedRows.length,
    occupied: reservations.length,
    available: Math.max(0, quantity - reservations.length)
  };
}

function rsvpNames(r) {
  if (Array.isArray(r.names)) return r.names.filter(Boolean);
  if (r.attending === 'no') return [];
  return r.name ? [r.name] : [];
}

async function loadDashboard() {
  dashboardData = await api('/api/admin/dashboard');
  renderStats();
  renderConfig();
  renderGiftSections();
  renderRsvps();
}

function renderStats() {
  const gifts = dashboardData.gifts || [];
  const rsvps = dashboardData.rsvps || [];
  const totals = gifts.reduce((acc, gift) => {
    const c = giftCounts(gift);
    acc.available += c.available;
    acc.reserved += c.reserved;
    acc.received += c.received;
    return acc;
  }, { available: 0, reserved: 0, received: 0 });
  $('#statAvailable').textContent = totals.available;
  $('#statReserved').textContent = totals.reserved;
  $('#statReceived').textContent = totals.received;
  $('#statRsvpYes').textContent = rsvps.reduce((sum, r) => sum + rsvpNames(r).length, 0);
}

function renderConfig() {
  const c = dashboardData.config || {};
  $('#cfgCouple').value = c.couple || '';
  $('#cfgTitle').value = c.title || '';
  $('#cfgSubtitle').value = c.subtitle || '';
  $('#cfgDate').value = c.eventDate || '';
  $('#cfgTime').value = c.eventTime || '';
  $('#cfgPlace').value = c.eventPlace || '';
  $('#cfgInvitationMessage').value = c.invitationMessage || '';
  $('#cfgMessage').value = c.message || '';
  $('#cfgPixKey').value = c.pixKey || '';
  $('#cfgPixReceiver').value = c.pixReceiver || '';
}

function phoneMask(v = '') {
  const d = String(v).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v;
}
function dateText(v) {
  if (!v) return '';
  try { return new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
}
function actionButton(text, cls, handler) {
  const b = document.createElement('button');
  b.className = cls;
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', handler);
  return b;
}
async function mutate(url, method, body) {
  await api(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  await loadDashboard();
}

function makeThumb(gift) {
  const thumb = document.createElement('div');
  thumb.className = 'admin-thumb';
  if (gift.image) {
    const img = document.createElement('img');
    img.src = gift.image;
    img.alt = gift.name;
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => thumb.replaceChildren(document.createTextNode('🎁')));
    thumb.appendChild(img);
  } else {
    thumb.textContent = '🎁';
  }
  return thumb;
}

function reservationRow(gift, reservation, mode) {
  const row = document.createElement('div');
  row.className = 'reservation-row';

  const who = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = reservation.name || 'Convidado';
  const details = document.createElement('span');
  const time = mode === 'received' ? reservation.receivedAt : reservation.reservedAt;
  details.textContent = `${reservation.phone ? phoneMask(reservation.phone) : 'Sem telefone'}${time ? ` • ${dateText(time)}` : ''}`;
  who.append(strong, details);

  const actions = document.createElement('div');
  actions.className = 'reservation-actions';
  if (mode === 'reserved') {
    actions.appendChild(actionButton('✓ Entregue', 'btn btn-primary btn-tiny', () =>
      mutate(`/api/admin/gifts/${encodeURIComponent(gift.id)}/reservations/${encodeURIComponent(reservation.id)}/received`, 'POST')
    ));
  }
  actions.appendChild(actionButton(mode === 'received' ? 'Desfazer' : 'Liberar', 'btn btn-soft btn-tiny', async () => {
    const msg = mode === 'received'
      ? `Remover a entrega de ${reservation.name} e liberar esta unidade novamente?`
      : `Liberar a unidade reservada por ${reservation.name}?`;
    if (confirm(msg)) {
      await mutate(`/api/admin/gifts/${encodeURIComponent(gift.id)}/reservations/${encodeURIComponent(reservation.id)}/release`, 'POST');
    }
  }));

  row.append(who, actions);
  return row;
}

function giftItem(gift, mode) {
  const c = giftCounts(gift);
  const item = document.createElement('article');
  item.className = 'admin-item admin-gift-card';

  const thumb = makeThumb(gift);
  const info = document.createElement('div');
  info.className = 'admin-gift-info';

  const top = document.createElement('div');
  top.className = 'admin-gift-title-row';
  const h = document.createElement('h4');
  h.textContent = gift.name;
  const badge = document.createElement('span');
  badge.className = 'unit-badge';
  badge.textContent = `${c.quantity} ${c.quantity === 1 ? 'unidade' : 'unidades'}`;
  top.append(h, badge);

  const meta = document.createElement('div');
  meta.className = 'admin-meta';
  meta.textContent = `${gift.category || 'Outros'} • ${c.available} disponível(is) • ${c.reserved} reservada(s) • ${c.received} entregue(s)`;
  info.append(top, meta);

  if (gift.purchaseUrl) {
    const a = document.createElement('a');
    a.className = 'admin-product-link';
    a.href = gift.purchaseUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    a.textContent = 'Ver presente desejado ↗';
    info.appendChild(a);
  }

  const quantityEditor = document.createElement('div');
  quantityEditor.className = 'quantity-editor';
  const qLabel = document.createElement('span');
  qLabel.textContent = 'Quantidade desejada';
  const qInput = document.createElement('input');
  qInput.type = 'number';
  qInput.min = String(Math.max(1, c.occupied));
  qInput.max = '100';
  qInput.value = String(c.quantity);
  qInput.setAttribute('aria-label', `Quantidade desejada de ${gift.name}`);
  const qButton = actionButton('Salvar', 'btn btn-outline btn-tiny', async () => {
    try {
      qButton.disabled = true;
      await mutate(`/api/admin/gifts/${encodeURIComponent(gift.id)}/quantity`, 'PUT', { quantity: Number(qInput.value) });
    } catch (err) {
      alert(err.message);
    } finally {
      qButton.disabled = false;
    }
  });
  quantityEditor.append(qLabel, qInput, qButton);
  info.appendChild(quantityEditor);

  const relevant = mode === 'reserved' ? c.reservedRows : mode === 'received' ? c.receivedRows : [];
  if (relevant.length) {
    const stack = document.createElement('div');
    stack.className = 'reservation-stack';
    relevant.forEach(r => stack.appendChild(reservationRow(gift, r, mode)));
    info.appendChild(stack);
  }

  const actions = document.createElement('div');
  actions.className = 'admin-actions';
  actions.appendChild(actionButton('Excluir presente', 'btn btn-danger btn-small', async () => {
    const warning = c.occupied
      ? `“${gift.name}” tem ${c.occupied} unidade(s) reservada(s)/entregue(s). Excluir mesmo assim?`
      : `Excluir “${gift.name}”?`;
    if (confirm(warning)) await mutate(`/api/admin/gifts/${encodeURIComponent(gift.id)}`, 'DELETE');
  }));

  item.append(thumb, info, actions);
  return item;
}

function fillGiftList(selector, gifts, mode, emptyText) {
  const wrap = $(selector);
  wrap.replaceChildren();
  if (!gifts.length) {
    const e = document.createElement('div');
    e.className = 'mini-empty';
    e.textContent = emptyText;
    wrap.appendChild(e);
    return;
  }
  gifts.forEach(g => wrap.appendChild(giftItem(g, mode)));
}

function renderGiftSections() {
  const gifts = dashboardData.gifts || [];
  const available = gifts.filter(g => giftCounts(g).available > 0);
  const reserved = gifts.filter(g => giftCounts(g).reserved > 0);
  const received = gifts.filter(g => giftCounts(g).received > 0);

  $('#countAvailable').textContent = available.reduce((n, g) => n + giftCounts(g).available, 0);
  $('#countReserved').textContent = reserved.reduce((n, g) => n + giftCounts(g).reserved, 0);
  $('#countReceived').textContent = received.reduce((n, g) => n + giftCounts(g).received, 0);

  fillGiftList('#availableGiftList', available, 'available', 'Nenhuma unidade disponível.');
  fillGiftList('#reservedGiftList', reserved, 'reserved', 'Nenhuma unidade reservada.');
  fillGiftList('#receivedGiftList', received, 'received', 'Nenhuma unidade entregue ainda.');
}

function rsvpItem(r) {
  const names = rsvpNames(r);
  const item = document.createElement('article');
  item.className = 'admin-item rsvp-item';
  const info = document.createElement('div');
  const h = document.createElement('h4');
  h.textContent = `${names.length} ${names.length === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}`;
  const meta = document.createElement('div');
  meta.className = 'admin-meta';
  meta.textContent = r.confirmedAt ? `Enviado em ${dateText(r.confirmedAt)}` : 'Confirmação registrada';
  const list = document.createElement('div');
  list.className = 'rsvp-names';
  names.forEach(name => {
    const n = document.createElement('div');
    n.className = 'rsvp-name';
    n.textContent = `• ${name}`;
    list.appendChild(n);
  });
  info.append(h, meta, list);
  const actions = document.createElement('div');
  actions.className = 'admin-actions';
  actions.appendChild(actionButton('Excluir', 'btn btn-danger btn-small', async () => {
    if (confirm('Excluir esta confirmação de presença?')) await mutate(`/api/admin/rsvps/${encodeURIComponent(r.id)}`, 'DELETE');
  }));
  item.append(info, actions);
  return item;
}

function renderRsvps() {
  const items = (dashboardData.rsvps || []).filter(r => rsvpNames(r).length);
  const wrap = $('#rsvpYesList');
  wrap.replaceChildren();
  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'mini-empty';
    e.textContent = 'Ninguém confirmou presença ainda.';
    wrap.appendChild(e);
    return;
  }
  items.forEach(r => wrap.appendChild(rsvpItem(r)));
}

async function previewProduct() {
  const url = $('#giftProductUrl').value.trim();
  const box = $('#productPreview');
  if (!url) {
    box.classList.add('hidden');
    return;
  }
  $('#productPreviewStatus').textContent = 'Buscando foto do produto...';
  $('#productPreviewTitle').textContent = 'Aguarde';
  box.classList.remove('hidden');
  $('#productPreviewImage').removeAttribute('src');
  try {
    const p = await api(`/api/admin/product-preview?url=${encodeURIComponent(url)}`);
    $('#productPreviewTitle').textContent = p.title || 'Produto encontrado';
    if (p.image) {
      $('#productPreviewImage').src = p.image;
      $('#giftImage').value = p.image;
      $('#productPreviewStatus').textContent = 'Foto encontrada automaticamente.';
    } else {
      $('#productPreviewStatus').textContent = 'A página foi encontrada, mas a loja não informou uma foto. Cole o link da imagem manualmente abaixo.';
    }
  } catch (err) {
    $('#productPreviewTitle').textContent = 'Não foi possível buscar a foto';
    $('#productPreviewStatus').textContent = err.message;
  }
}
$('#giftProductUrl').addEventListener('input', () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(previewProduct, 800);
});
$('#giftProductUrl').addEventListener('blur', () => {
  clearTimeout(previewTimer);
  previewProduct();
});

$('#giftForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#giftError').textContent = '';
  $('#giftSuccess').classList.add('hidden');
  const button = e.currentTarget.querySelector('button[type="submit"]');
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Adicionando...';
  try {
    const result = await api('/api/admin/gifts', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#giftName').value,
        purchaseUrl: $('#giftProductUrl').value,
        image: $('#giftImage').value,
        category: $('#giftCategory').value,
        quantity: Number($('#giftQuantity').value || 1),
        description: $('#giftDescription').value
      })
    });
    e.currentTarget.reset();
    $('#giftQuantity').value = '1';
    $('#productPreview').classList.add('hidden');
    $('#giftSuccess').textContent = result.warning || 'Presente adicionado com sucesso!';
    $('#giftSuccess').classList.remove('hidden');
    await loadDashboard();
  } catch (err) {
    $('#giftError').textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

$('#configForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#configError').textContent = '';
  $('#configSuccess').classList.add('hidden');
  try {
    await api('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({
        couple: $('#cfgCouple').value,
        title: $('#cfgTitle').value,
        subtitle: $('#cfgSubtitle').value,
        eventDate: $('#cfgDate').value,
        eventTime: $('#cfgTime').value,
        eventPlace: $('#cfgPlace').value,
        invitationMessage: $('#cfgInvitationMessage').value,
        message: $('#cfgMessage').value,
        pixKey: $('#cfgPixKey').value,
        pixReceiver: $('#cfgPixReceiver').value
      })
    });
    $('#configSuccess').textContent = 'Informações do chá e do PIX salvas.';
    $('#configSuccess').classList.remove('hidden');
    await loadDashboard();
  } catch (err) {
    $('#configError').textContent = err.message;
  }
});

(async function init() {
  if (!token) return showLogin();
  try {
    showDashboard();
    await loadDashboard();
  } catch {
    token = '';
    localStorage.removeItem(tokenKey);
    showLogin();
  }
})();
