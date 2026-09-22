const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'troque-esta-senha';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'troque-por-uma-chave-longa-e-aleatoria';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB_PATH = path.join(ROOT, 'data', 'db.json');

const attempts = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const current = attempts.get(key) || [];
  const fresh = current.filter(ts => now - ts < windowMs);
  fresh.push(now);
  attempts.set(key, fresh);
  return fresh.length > max;
}

function readDb() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(db.gifts)) db.gifts = [];
  if (!Array.isArray(db.rsvps)) db.rsvps = [];
  if (!db.config) db.config = {};
  return db;
}
function writeDb(db) {
  const temp = `${DB_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temp, DB_PATH);
}
function cleanText(value, max = 120) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max); }
function cleanMultiline(value, max = 500) { return String(value || '').trim().slice(0, max); }
function cleanPhone(value) { return String(value || '').replace(/\D/g, '').slice(0, 11); }
function cleanHttpUrl(value, max = 1200) {
  const raw = String(value || '').trim().slice(0, max);
  if (!raw) return '';
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Use um link começando com http:// ou https://.');
  return u.toString();
}
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function isAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp) > Date.now();
  } catch { return false; }
}
function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https: http: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
}
function json(res, status, data) {
  securityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 150_000) { reject(new Error('Payload muito grande.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}
function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' })[ext] || 'application/octet-stream';
}
function sendFile(res, file) {
  try {
    const data = fs.readFileSync(file);
    securityHeaders(res);
    const ext = path.extname(file).toLowerCase();
    const cacheControl = ['.html','.css','.js'].includes(ext) ? 'no-store, max-age=0' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': cacheControl });
    res.end(data);
  } catch { json(res, 404, { error: 'Arquivo não encontrado.' }); }
}
function clientIp(req) { return req.socket.remoteAddress || 'unknown'; }
function adminGuard(req, res) { if (!isAdmin(req)) { json(res, 401, { error:'Acesso não autorizado.' }); return false; } return true; }

function isPrivateAddress(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}
async function validateExternalUrl(raw) {
  const clean = cleanHttpUrl(raw);
  const u = new URL(clean);
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('Esse endereço não pode ser usado.');
  if (net.isIP(host) && isPrivateAddress(host)) throw new Error('Esse endereço não pode ser usado.');
  const addresses = await dns.lookup(host, { all:true }).catch(() => []);
  if (!addresses.length) throw new Error('Não foi possível localizar esse site.');
  if (addresses.some(x => isPrivateAddress(x.address))) throw new Error('Esse endereço não pode ser usado.');
  return u;
}
function decodeEntities(str='') {
  return str.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#x2F;/gi,'/').replace(/&#x27;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const p of patterns) { const m = html.match(p); if (m) return decodeEntities(m[1].trim()); }
  return '';
}
async function fetchProductMetadata(rawUrl) {
  let current = await validateExternalUrl(rawUrl);
  for (let i = 0; i < 4; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    let response;
    try {
      response = await fetch(current, {
        method:'GET', redirect:'manual', signal:controller.signal,
        headers:{ 'User-Agent':'Mozilla/5.0 (compatible; ChaDosNoivos/1.0)', 'Accept':'text/html,application/xhtml+xml' }
      });
    } finally { clearTimeout(timer); }

    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('A loja redirecionou para um endereço inválido.');
      current = await validateExternalUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error('A loja não permitiu buscar os dados do produto.');
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error('O link informado não parece ser uma página de produto.');
    const buffer = Buffer.from(await response.arrayBuffer()).subarray(0, 1_500_000);
    const html = buffer.toString('utf8');
    const imageRaw = metaContent(html,'og:image') || metaContent(html,'twitter:image') || metaContent(html,'twitter:image:src');
    const titleRaw = metaContent(html,'og:title') || metaContent(html,'twitter:title') || (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] || '');
    let image = '';
    if (imageRaw) {
      try { image = cleanHttpUrl(new URL(imageRaw, current).toString(), 1600); } catch { image = ''; }
    }
    return { url:current.toString(), image, title:cleanText(decodeEntities(titleRaw), 160) };
  }
  throw new Error('Muitos redirecionamentos ao buscar o produto.');
}

async function api(req, res, pathname, urlObj) {
  try {
    if (req.method === 'GET' && pathname === '/api/config') return json(res, 200, readDb().config);
    if (req.method === 'GET' && pathname === '/api/gifts') {
      const gifts = readDb().gifts.map(g => ({ id:g.id, name:g.name, category:g.category, description:g.description, image:g.image, purchaseUrl:g.purchaseUrl || '', status:g.status }));
      return json(res, 200, gifts);
    }

    let match = pathname.match(/^\/api\/gifts\/([^/]+)\/reserve$/);
    if (req.method === 'POST' && match) {
      if (rateLimited(`reserve:${clientIp(req)}`, 8, 10 * 60 * 1000)) return json(res, 429, { error:'Muitas tentativas. Tente novamente em alguns minutos.' });
      const body = await readJson(req);
      const name = cleanText(body.name, 80), phone = cleanPhone(body.phone);
      if (name.length < 3) return json(res, 400, { error:'Informe seu nome completo.' });
      if (phone.length < 10) return json(res, 400, { error:'Informe um telefone válido com DDD.' });
      const db = readDb();
      const gift = db.gifts.find(g => g.id === decodeURIComponent(match[1]));
      if (!gift) return json(res, 404, { error:'Presente não encontrado.' });
      if (gift.status !== 'available') return json(res, 409, { error:'Esse presente acabou de ser escolhido por outra pessoa.' });
      gift.status = 'reserved';
      gift.reservedBy = { name, phone, reservedAt:new Date().toISOString() };
      writeDb(db);
      return json(res, 200, { ok:true, message:`Tudo certo, ${name.split(' ')[0]}! O presente ficou reservado em seu nome. Se quiser, use o botão da loja para comprar e lembre-se de levá-lo no dia do chá.` });
    }

    if (req.method === 'POST' && pathname === '/api/rsvp') {
      if (rateLimited(`rsvp:${clientIp(req)}`, 10, 10 * 60 * 1000)) return json(res, 429, { error:'Muitas tentativas. Tente novamente em alguns minutos.' });
      const body = await readJson(req);
      const name = cleanText(body.name, 80), phone = cleanPhone(body.phone);
      const attending = body.attending === true || body.attending === 'yes' ? 'yes' : body.attending === false || body.attending === 'no' ? 'no' : '';
      const note = cleanText(body.note, 220);
      if (name.length < 3) return json(res, 400, { error:'Informe seu nome completo.' });
      if (phone.length < 10) return json(res, 400, { error:'Informe um telefone válido com DDD.' });
      if (!attending) return json(res, 400, { error:'Informe se você poderá comparecer.' });
      const db = readDb();
      const existing = db.rsvps.find(r => r.phone === phone);
      const record = { id: existing?.id || `rsvp-${crypto.randomBytes(6).toString('hex')}`, name, phone, attending, note, confirmedAt:new Date().toISOString() };
      if (existing) Object.assign(existing, record); else db.rsvps.unshift(record);
      writeDb(db);
      return json(res, 200, { ok:true, message: attending === 'yes' ? `Presença confirmada, ${name.split(' ')[0]}! Vai ser muito especial ter você com a gente. 💚` : `Confirmação registrada, ${name.split(' ')[0]}. Obrigado por nos avisar!` });
    }

    if (req.method === 'POST' && pathname === '/api/admin/login') {
      if (rateLimited(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) return json(res, 429, { error:'Muitas tentativas de acesso. Aguarde alguns minutos.' });
      const body = await readJson(req);
      const supplied = Buffer.from(String(body.password || ''));
      const expected = Buffer.from(ADMIN_PASSWORD);
      const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
      return valid ? json(res, 200, { token:makeToken() }) : json(res, 401, { error:'Senha incorreta.' });
    }

    if (pathname.startsWith('/api/admin/') && !adminGuard(req, res)) return;
    if (req.method === 'GET' && pathname === '/api/admin/dashboard') return json(res, 200, readDb());

    if (req.method === 'GET' && pathname === '/api/admin/product-preview') {
      const raw = urlObj.searchParams.get('url') || '';
      if (!raw) return json(res,400,{error:'Cole o link do produto primeiro.'});
      const metadata = await fetchProductMetadata(raw);
      return json(res,200,metadata);
    }

    if (req.method === 'PUT' && pathname === '/api/admin/config') {
      const body = await readJson(req), db = readDb();
      db.config = {
        couple:cleanText(body.couple,70)||db.config.couple||'Daniel & Núbia',
        title:cleanText(body.title,70)||db.config.title||'Chá dos Noivos',
        subtitle:cleanText(body.subtitle,180),
        eventDate:cleanText(body.eventDate,80),
        eventTime:cleanText(body.eventTime,80),
        eventPlace:cleanText(body.eventPlace,150),
        message:cleanMultiline(body.message,350),
        invitationMessage:cleanMultiline(body.invitationMessage,420)
      };
      writeDb(db); return json(res,200,{ok:true,config:db.config});
    }

    if (req.method === 'POST' && pathname === '/api/admin/gifts') {
      const body = await readJson(req), name=cleanText(body.name,100);
      if (name.length < 2) return json(res,400,{error:'Informe o nome do presente.'});
      let purchaseUrl = '', image = '';
      if (body.purchaseUrl) purchaseUrl = cleanHttpUrl(body.purchaseUrl, 1200);
      if (body.image) image = cleanHttpUrl(body.image, 1600);
      let warning = '';
      if (purchaseUrl && !image) {
        try { const meta = await fetchProductMetadata(purchaseUrl); purchaseUrl=meta.url; image=meta.image || ''; }
        catch (err) { warning = 'O presente foi salvo, mas a loja não liberou a foto automática. Você pode adicionar uma imagem manualmente.'; }
      }
      const db=readDb();
      const gift={id:`gift-${crypto.randomBytes(6).toString('hex')}`,name,category:cleanText(body.category,60)||'Outros',description:cleanText(body.description,220),image,purchaseUrl,status:'available',reservedBy:null,createdAt:new Date().toISOString()};
      db.gifts.unshift(gift); writeDb(db); return json(res,201,{ok:true,gift,warning});
    }

    match = pathname.match(/^\/api\/admin\/gifts\/([^/]+)\/(release|received)$/);
    if (req.method === 'POST' && match) {
      const db=readDb(), gift=db.gifts.find(g=>g.id===decodeURIComponent(match[1]));
      if (!gift) return json(res,404,{error:'Presente não encontrado.'});
      if (match[2]==='release') { gift.status='available'; gift.reservedBy=null; gift.receivedAt=null; }
      else { gift.status='received'; gift.receivedAt=new Date().toISOString(); }
      writeDb(db); return json(res,200,{ok:true});
    }

    match = pathname.match(/^\/api\/admin\/gifts\/([^/]+)$/);
    if (req.method === 'DELETE' && match) {
      const db=readDb(), before=db.gifts.length;
      db.gifts=db.gifts.filter(g=>g.id!==decodeURIComponent(match[1]));
      if (db.gifts.length===before) return json(res,404,{error:'Presente não encontrado.'});
      writeDb(db); return json(res,200,{ok:true});
    }

    match = pathname.match(/^\/api\/admin\/rsvps\/([^/]+)$/);
    if (req.method === 'DELETE' && match) {
      const db=readDb(), before=db.rsvps.length;
      db.rsvps=db.rsvps.filter(r=>r.id!==decodeURIComponent(match[1]));
      if (db.rsvps.length===before) return json(res,404,{error:'Confirmação não encontrada.'});
      writeDb(db); return json(res,200,{ok:true});
    }

    return json(res,404,{error:'Rota não encontrada.'});
  } catch (err) {
    console.error(err);
    return json(res,400,{error:err.name === 'AbortError' ? 'A loja demorou demais para responder.' : (err.message || 'Erro ao processar a solicitação.')});
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith('/api/')) return api(req,res,pathname,url);
  if (pathname === '/' || pathname === '/index.html') return sendFile(res,path.join(PUBLIC,'index.html'));
  if (pathname === '/admin' || pathname === '/admin.html') return sendFile(res,path.join(PUBLIC,'admin.html'));

  const relative = pathname.replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC, relative));
  if (!file.startsWith(PUBLIC + path.sep)) return json(res,403,{error:'Acesso negado.'});
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res,file);
  return sendFile(res,path.join(PUBLIC,'index.html'));
});

server.listen(PORT, () => console.log(`Chá dos Noivos rodando em http://localhost:${PORT}`));
