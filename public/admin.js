const $ = s => document.querySelector(s);
const tokenKey = 'nd_admin_token';
let token = localStorage.getItem(tokenKey) || '';
let dashboardData = null;

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
  if (clear) { token=''; localStorage.removeItem(tokenKey); }
  showLogin();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    const result = await api('/api/admin/login', { method:'POST', body:JSON.stringify({ password: $('#adminPassword').value }) });
    token = result.token;
    localStorage.setItem(tokenKey, token);
    $('#adminPassword').value='';
    showDashboard();
    await loadDashboard();
  } catch (err) { $('#loginError').textContent = err.message; }
});
$('#logoutBtn').addEventListener('click', () => logout(true));

async function loadDashboard() {
  dashboardData = await api('/api/admin/dashboard');
  renderStats();
  renderConfig();
  renderGiftList();
}
function renderStats() {
  const gifts = dashboardData.gifts || [];
  $('#statAvailable').textContent = gifts.filter(g=>g.status==='available').length;
  $('#statReserved').textContent = gifts.filter(g=>g.status==='reserved').length;
  $('#statReceived').textContent = gifts.filter(g=>g.status==='received').length;
}
function renderConfig() {
  const c = dashboardData.config || {};
  $('#cfgCouple').value=c.couple||''; $('#cfgTitle').value=c.title||''; $('#cfgSubtitle').value=c.subtitle||'';
  $('#cfgDate').value=c.eventDate||''; $('#cfgTime').value=c.eventTime||''; $('#cfgPlace').value=c.eventPlace||''; $('#cfgMessage').value=c.message||'';
}
function phoneMask(v='') {
  const d = String(v).replace(/\D/g,'');
  if (d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v;
}
function renderGiftList() {
  const wrap = $('#adminGiftList'); wrap.replaceChildren();
  if (!dashboardData.gifts.length) { const e=document.createElement('div'); e.className='empty'; e.textContent='Nenhum presente cadastrado.'; wrap.appendChild(e); return; }
  dashboardData.gifts.forEach(gift => {
    const item=document.createElement('article'); item.className='admin-item';
    const info=document.createElement('div');
    const h=document.createElement('h4'); h.textContent=gift.name;
    const meta=document.createElement('div'); meta.className='admin-meta';
    const status = gift.status==='available' ? 'Disponível' : gift.status==='received' ? 'Recebido' : 'Reservado';
    meta.textContent = `${gift.category || 'Outros'} • ${status}`;
    info.append(h,meta);
    if (gift.reservedBy) {
      const who=document.createElement('div'); who.className='admin-meta'; who.style.marginTop='6px';
      who.textContent=`Reservado por ${gift.reservedBy.name} • ${phoneMask(gift.reservedBy.phone)}`;
      info.appendChild(who);
    }
    const actions=document.createElement('div'); actions.className='admin-actions';
    if (gift.status!=='available') actions.appendChild(actionButton('Liberar','btn btn-soft btn-small',()=>mutate(`/api/admin/gifts/${gift.id}/release`,'POST')));
    if (gift.status==='reserved') actions.appendChild(actionButton('Marcar recebido','btn btn-primary btn-small',()=>mutate(`/api/admin/gifts/${gift.id}/received`,'POST')));
    actions.appendChild(actionButton('Excluir','btn btn-danger btn-small',async()=>{ if(confirm(`Excluir “${gift.name}”?`)) await mutate(`/api/admin/gifts/${gift.id}`,'DELETE'); }));
    item.append(info,actions); wrap.appendChild(item);
  });
}
function actionButton(text, cls, handler) { const b=document.createElement('button'); b.className=cls; b.textContent=text; b.addEventListener('click',handler); return b; }
async function mutate(url, method, body) { await api(url,{method, ...(body?{body:JSON.stringify(body)}:{})}); await loadDashboard(); }

$('#giftForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#giftError').textContent='';
  try {
    await api('/api/admin/gifts',{method:'POST', body:JSON.stringify({ name:$('#giftName').value, category:$('#giftCategory').value, description:$('#giftDescription').value, image:$('#giftImage').value })});
    e.currentTarget.reset(); await loadDashboard();
  } catch(err){ $('#giftError').textContent=err.message; }
});

$('#configForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#configError').textContent='';
  try {
    await api('/api/admin/config',{method:'PUT',body:JSON.stringify({
      couple:$('#cfgCouple').value,title:$('#cfgTitle').value,subtitle:$('#cfgSubtitle').value,eventDate:$('#cfgDate').value,eventTime:$('#cfgTime').value,eventPlace:$('#cfgPlace').value,message:$('#cfgMessage').value
    })});
    await loadDashboard();
  } catch(err){ $('#configError').textContent=err.message; }
});

(async function init(){
  if (!token) return showLogin();
  try { showDashboard(); await loadDashboard(); }
  catch { token=''; localStorage.removeItem(tokenKey); showLogin(); }
})();
