const $ = s => document.querySelector(s);
const tokenKey = 'nd_admin_token';
let token = localStorage.getItem(tokenKey) || '';
let dashboardData = null;
let previewTimer = null;

async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`} : {}), ...(options.headers||{}) } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){ if(res.status===401 && url!=='/api/admin/login') logout(false); throw new Error(data.error||'Não foi possível concluir a ação.'); }
  return data;
}
function showDashboard(){ $('#loginPanel').classList.add('hidden'); $('#dashboard').classList.remove('hidden'); }
function showLogin(){ $('#dashboard').classList.add('hidden'); $('#loginPanel').classList.remove('hidden'); }
function logout(clear=true){ if(clear){token='';localStorage.removeItem(tokenKey);} showLogin(); }

$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{const result=await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#adminPassword').value})});token=result.token;localStorage.setItem(tokenKey,token);$('#adminPassword').value='';showDashboard();await loadDashboard();}catch(err){$('#loginError').textContent=err.message;}});
$('#logoutBtn').addEventListener('click',()=>logout(true));

async function loadDashboard(){dashboardData=await api('/api/admin/dashboard');renderStats();renderConfig();renderGiftSections();renderRsvps();}
function renderStats(){const gifts=dashboardData.gifts||[],rsvps=dashboardData.rsvps||[];$('#statAvailable').textContent=gifts.filter(g=>g.status==='available').length;$('#statReserved').textContent=gifts.filter(g=>g.status==='reserved').length;$('#statReceived').textContent=gifts.filter(g=>g.status==='received').length;$('#statRsvpYes').textContent=rsvps.filter(r=>r.attending==='yes').length;}
function renderConfig(){const c=dashboardData.config||{};$('#cfgCouple').value=c.couple||'';$('#cfgTitle').value=c.title||'';$('#cfgSubtitle').value=c.subtitle||'';$('#cfgDate').value=c.eventDate||'';$('#cfgTime').value=c.eventTime||'';$('#cfgPlace').value=c.eventPlace||'';$('#cfgInvitationMessage').value=c.invitationMessage||'';$('#cfgMessage').value=c.message||'';}
function phoneMask(v=''){const d=String(v).replace(/\D/g,'');if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return v;}
function dateText(v){if(!v)return'';try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch{return'';}}
function actionButton(text,cls,handler){const b=document.createElement('button');b.className=cls;b.textContent=text;b.addEventListener('click',handler);return b;}
async function mutate(url,method,body){await api(url,{method,...(body?{body:JSON.stringify(body)}:{})});await loadDashboard();}

function giftItem(gift){
  const item=document.createElement('article');item.className='admin-item';
  const thumb=document.createElement('div');thumb.className='admin-thumb';
  if(gift.image){const img=document.createElement('img');img.src=gift.image;img.alt=gift.name;img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{thumb.textContent='🎁';});thumb.appendChild(img);}else thumb.textContent='🎁';
  const info=document.createElement('div');const h=document.createElement('h4');h.textContent=gift.name;const meta=document.createElement('div');meta.className='admin-meta';meta.textContent=gift.category||'Outros';info.append(h,meta);
  if(gift.purchaseUrl){const a=document.createElement('a');a.className='admin-product-link';a.href=gift.purchaseUrl;a.target='_blank';a.rel='noopener noreferrer nofollow';a.textContent='Abrir link de compra ↗';info.appendChild(a);}
  if(gift.reservedBy){const who=document.createElement('div');who.className='admin-meta reserved-who';who.textContent=`Por: ${gift.reservedBy.name} • ${phoneMask(gift.reservedBy.phone)}${gift.reservedBy.reservedAt?` • ${dateText(gift.reservedBy.reservedAt)}`:''}`;info.appendChild(who);}
  const actions=document.createElement('div');actions.className='admin-actions';
  if(gift.status!=='available')actions.appendChild(actionButton('Liberar','btn btn-soft btn-small',()=>mutate(`/api/admin/gifts/${gift.id}/release`,'POST')));
  if(gift.status==='reserved')actions.appendChild(actionButton('Marcar entregue','btn btn-primary btn-small',()=>mutate(`/api/admin/gifts/${gift.id}/received`,'POST')));
  actions.appendChild(actionButton('Excluir','btn btn-danger btn-small',async()=>{if(confirm(`Excluir “${gift.name}”?`))await mutate(`/api/admin/gifts/${gift.id}`,'DELETE');}));
  item.append(thumb,info,actions);return item;
}
function fillList(selector,items,emptyText){const wrap=$(selector);wrap.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='mini-empty';e.textContent=emptyText;wrap.appendChild(e);return;}items.forEach(g=>wrap.appendChild(giftItem(g)));}
function renderGiftSections(){const gifts=dashboardData.gifts||[];const a=gifts.filter(g=>g.status==='available'),r=gifts.filter(g=>g.status==='reserved'),d=gifts.filter(g=>g.status==='received');$('#countAvailable').textContent=a.length;$('#countReserved').textContent=r.length;$('#countReceived').textContent=d.length;fillList('#availableGiftList',a,'Nenhum presente disponível.');fillList('#reservedGiftList',r,'Nenhum presente reservado.');fillList('#receivedGiftList',d,'Nenhum presente entregue ainda.');}

function rsvpItem(r){const item=document.createElement('article');item.className='admin-item rsvp-item';const info=document.createElement('div');const h=document.createElement('h4');h.textContent=r.name;const meta=document.createElement('div');meta.className='admin-meta';meta.textContent=`${phoneMask(r.phone)}${r.confirmedAt?` • ${dateText(r.confirmedAt)}`:''}`;info.append(h,meta);if(r.note){const note=document.createElement('div');note.className='admin-meta rsvp-note';note.textContent=`“${r.note}”`;info.appendChild(note);}const actions=document.createElement('div');actions.className='admin-actions';actions.appendChild(actionButton('Excluir','btn btn-danger btn-small',async()=>{if(confirm(`Excluir a confirmação de ${r.name}?`))await mutate(`/api/admin/rsvps/${r.id}`,'DELETE');}));item.append(info,actions);return item;}
function fillRsvp(selector,items,emptyText){const wrap=$(selector);wrap.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='mini-empty';e.textContent=emptyText;wrap.appendChild(e);return;}items.forEach(r=>wrap.appendChild(rsvpItem(r)));}
function renderRsvps(){const r=dashboardData.rsvps||[];fillRsvp('#rsvpYesList',r.filter(x=>x.attending==='yes'),'Ninguém confirmou presença ainda.');fillRsvp('#rsvpNoList',r.filter(x=>x.attending==='no'),'Nenhuma ausência registrada.');}

async function previewProduct(){
  const url=$('#giftProductUrl').value.trim(); const box=$('#productPreview'); if(!url){box.classList.add('hidden');return;}
  $('#productPreviewStatus').textContent='Buscando foto do produto...';$('#productPreviewTitle').textContent='Aguarde';box.classList.remove('hidden');$('#productPreviewImage').removeAttribute('src');
  try{const p=await api(`/api/admin/product-preview?url=${encodeURIComponent(url)}`);$('#productPreviewTitle').textContent=p.title||'Produto encontrado';if(p.image){$('#productPreviewImage').src=p.image;$('#giftImage').value=p.image;$('#productPreviewStatus').textContent='Foto encontrada automaticamente.';}else{$('#productPreviewStatus').textContent='A página foi encontrada, mas a loja não informou uma foto. Cole o link da imagem manualmente abaixo.';}}
  catch(err){$('#productPreviewTitle').textContent='Não foi possível buscar a foto';$('#productPreviewStatus').textContent=err.message;}
}
$('#giftProductUrl').addEventListener('input',()=>{clearTimeout(previewTimer);previewTimer=setTimeout(previewProduct,800);});
$('#giftProductUrl').addEventListener('blur',()=>{clearTimeout(previewTimer);previewProduct();});

$('#giftForm').addEventListener('submit',async e=>{e.preventDefault();$('#giftError').textContent='';$('#giftSuccess').classList.add('hidden');try{const result=await api('/api/admin/gifts',{method:'POST',body:JSON.stringify({name:$('#giftName').value,purchaseUrl:$('#giftProductUrl').value,image:$('#giftImage').value,category:$('#giftCategory').value,description:$('#giftDescription').value})});e.currentTarget.reset();$('#productPreview').classList.add('hidden');$('#giftSuccess').textContent=result.warning||'Presente adicionado com sucesso!';$('#giftSuccess').classList.remove('hidden');await loadDashboard();}catch(err){$('#giftError').textContent=err.message;}});

$('#configForm').addEventListener('submit',async e=>{e.preventDefault();$('#configError').textContent='';$('#configSuccess').classList.add('hidden');try{await api('/api/admin/config',{method:'PUT',body:JSON.stringify({couple:$('#cfgCouple').value,title:$('#cfgTitle').value,subtitle:$('#cfgSubtitle').value,eventDate:$('#cfgDate').value,eventTime:$('#cfgTime').value,eventPlace:$('#cfgPlace').value,invitationMessage:$('#cfgInvitationMessage').value,message:$('#cfgMessage').value})});$('#configSuccess').textContent='Informações do convite salvas.';$('#configSuccess').classList.remove('hidden');await loadDashboard();}catch(err){$('#configError').textContent=err.message;}});

(async function init(){if(!token)return showLogin();try{showDashboard();await loadDashboard();}catch{token='';localStorage.removeItem(tokenKey);showLogin();}})();
