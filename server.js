const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'danielnubia';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'troque-esta-senha';
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-este-segredo-em-producao';
const DATA_FILE = path.join(__dirname, 'data.json');
const usePostgres = Boolean(process.env.DATABASE_URL);
const pool = usePostgres ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }) : null;

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const seedGifts = [
  { id: 1, name: 'Air Fryer 5L', category: 'Eletrodomésticos', description: 'Para deixar as refeições mais práticas no nosso novo lar.', quantity: 1, image: 'airfryer', reserved: 0 },
  { id: 2, name: 'Jogo de Panelas', category: 'Cozinha', description: 'Um conjunto completo para nossas primeiras receitas.', quantity: 1, image: 'panelas', reserved: 0 },
  { id: 3, name: 'Jogo de Toalhas', category: 'Banheiro', description: 'Toalhas macias para deixar a casa ainda mais aconchegante.', quantity: 6, image: 'toalhas', reserved: 0 },
  { id: 4, name: 'Aspirador de Pó', category: 'Limpeza', description: 'Praticidade para cuidar da nossa casa no dia a dia.', quantity: 1, image: 'aspirador', reserved: 0 },
  { id: 5, name: 'Jogo de Pratos', category: 'Cozinha', description: 'Conjunto para receber família e amigos à mesa.', quantity: 2, image: 'pratos', reserved: 0 },
  { id: 6, name: 'Cafeteira', category: 'Eletrodomésticos', description: 'Para começar nossas manhãs com café fresquinho.', quantity: 1, image: 'cafeteira', reserved: 0 },
  { id: 7, name: 'Jogo de Cama', category: 'Quarto', description: 'Conforto e carinho para o nosso cantinho.', quantity: 2, image: 'cama', reserved: 0 },
  { id: 8, name: 'Micro-ondas', category: 'Eletrodomésticos', description: 'Mais praticidade para a rotina da casa.', quantity: 1, image: 'microondas', reserved: 0 },
  { id: 9, name: 'Faqueiro', category: 'Cozinha', description: 'Um faqueiro bonito para completar nossa mesa.', quantity: 1, image: 'faqueiro', reserved: 0 },
  { id: 10, name: 'Jogo de Copos', category: 'Cozinha', description: 'Copos para o dia a dia e para receber visitas.', quantity: 2, image: 'copos', reserved: 0 },
  { id: 11, name: 'Edredom Casal', category: 'Quarto', description: 'Um toque de conforto para nosso novo quarto.', quantity: 1, image: 'edredom', reserved: 0 },
  { id: 12, name: 'Liquidificador', category: 'Eletrodomésticos', description: 'Um companheiro para sucos, receitas e sobremesas.', quantity: 1, image: 'liquidificador', reserved: 0 }
];

function defaultData() {
  return { gifts: seedGifts, reservations: [], messages: [], nextGiftId: 13, nextReservationId: 1, nextMessageId: 1 };
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2));
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

async function initDb() {
  if (!usePostgres) {
    readData();
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gifts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      image TEXT NOT NULL DEFAULT 'presente'
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      gift_id INTEGER NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
      guest_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      guest_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM gifts');
  if (rows[0].count === 0) {
    for (const g of seedGifts) {
      await pool.query('INSERT INTO gifts (name, category, description, quantity, image) VALUES ($1,$2,$3,$4,$5)', [g.name, g.category, g.description, g.quantity, g.image]);
    }
  }
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return false;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : false;
  } catch { return false; }
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('='); return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}
function requireAdmin(req, res, next) {
  const session = verify(parseCookies(req).dn_admin);
  if (!session || session.role !== 'admin') return res.status(401).json({ error: 'Não autorizado.' });
  next();
}
function cleanText(v, max = 120) {
  return String(v || '').replace(/[<>]/g, '').trim().slice(0, max);
}
function cleanPhone(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 13);
}

async function listGifts() {
  if (usePostgres) {
    const { rows } = await pool.query(`SELECT g.*, COUNT(r.id)::int AS reserved FROM gifts g LEFT JOIN reservations r ON r.gift_id=g.id GROUP BY g.id ORDER BY g.id`);
    return rows;
  }
  const data = readData();
  return data.gifts.map(g => ({ ...g, reserved: data.reservations.filter(r => r.gift_id === g.id).length }));
}

app.get('/api/gifts', async (_req, res) => {
  try { res.json(await listGifts()); } catch (e) { res.status(500).json({ error: 'Não foi possível carregar os presentes.' }); }
});

app.post('/api/reserve/:id', async (req, res) => {
  const giftId = Number(req.params.id);
  const guestName = cleanText(req.body.name, 100);
  const phone = cleanPhone(req.body.phone);
  const confirmed = req.body.confirmed === true || req.body.confirmed === 'true';
  if (!giftId || guestName.length < 3 || phone.length < 10 || !confirmed) return res.status(400).json({ error: 'Preencha nome, WhatsApp e confirme que levará o presente no dia do chá.' });

  try {
    if (usePostgres) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const giftQ = await client.query('SELECT * FROM gifts WHERE id=$1 FOR UPDATE', [giftId]);
        if (!giftQ.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Presente não encontrado.' }); }
        const gift = giftQ.rows[0];
        const countQ = await client.query('SELECT COUNT(*)::int AS count FROM reservations WHERE gift_id=$1', [giftId]);
        if (countQ.rows[0].count >= gift.quantity) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Este presente acabou de ser escolhido por outro convidado.' }); }
        await client.query('INSERT INTO reservations (gift_id, guest_name, phone) VALUES ($1,$2,$3)', [giftId, guestName, phone]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } else {
      const data = readData();
      const gift = data.gifts.find(g => g.id === giftId);
      if (!gift) return res.status(404).json({ error: 'Presente não encontrado.' });
      const reserved = data.reservations.filter(r => r.gift_id === giftId).length;
      if (reserved >= gift.quantity) return res.status(409).json({ error: 'Este presente acabou de ser escolhido por outro convidado.' });
      data.reservations.push({ id: data.nextReservationId++, gift_id: giftId, guest_name: guestName, phone, created_at: new Date().toISOString() });
      writeData(data);
    }
    res.json({ ok: true, message: 'Presente reservado com sucesso!' });
  } catch (e) {
    res.status(500).json({ error: 'Não foi possível concluir a reserva.' });
  }
});

app.post('/api/messages', async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const message = cleanText(req.body.message, 500);
  if (name.length < 2 || message.length < 3) return res.status(400).json({ error: 'Preencha seu nome e sua mensagem.' });
  try {
    if (usePostgres) await pool.query('INSERT INTO messages (guest_name, message) VALUES ($1,$2)', [name, message]);
    else { const data = readData(); data.messages.push({ id: data.nextMessageId++, guest_name: name, message, created_at: new Date().toISOString() }); writeData(data); }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Não foi possível salvar sua mensagem.' }); }
});

const loginAttempts = new Map();
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > attempt.reset) { attempt.count = 0; attempt.reset = now + 15 * 60 * 1000; }
  if (attempt.count >= 10) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  const user = cleanText(req.body.user, 80);
  const pass = String(req.body.password || '').slice(0, 160);
  const okUser = crypto.timingSafeEqual(Buffer.from(user.padEnd(100)), Buffer.from(ADMIN_USER.padEnd(100)));
  const okPass = crypto.timingSafeEqual(Buffer.from(pass.padEnd(160)), Buffer.from(ADMIN_PASSWORD.padEnd(160)));
  if (!okUser || !okPass) {
    attempt.count += 1; loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  loginAttempts.delete(ip);
  const token = sign({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 });
  res.setHeader('Set-Cookie', `dn_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (_req, res) => { res.setHeader('Set-Cookie', 'dn_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ ok: true }));

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const gifts = await listGifts();
    let reservations, messages;
    if (usePostgres) {
      reservations = (await pool.query(`SELECT r.id, r.gift_id, r.guest_name, r.phone, r.created_at, g.name AS gift_name FROM reservations r JOIN gifts g ON g.id=r.gift_id ORDER BY r.created_at DESC`)).rows;
      messages = (await pool.query('SELECT * FROM messages ORDER BY created_at DESC')).rows;
    } else {
      const data = readData();
      reservations = data.reservations.map(r => ({ ...r, gift_name: data.gifts.find(g => g.id === r.gift_id)?.name || 'Presente' })).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
      messages = [...data.messages].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    res.json({ gifts, reservations, messages });
  } catch { res.status(500).json({ error: 'Erro ao carregar painel.' }); }
});

app.post('/api/admin/gifts', requireAdmin, async (req, res) => {
  const name = cleanText(req.body.name, 100), category = cleanText(req.body.category, 60), description = cleanText(req.body.description, 240), image = cleanText(req.body.image, 60) || 'presente';
  const quantity = Math.max(1, Math.min(99, Number(req.body.quantity) || 1));
  if (!name || !category) return res.status(400).json({ error: 'Informe nome e categoria.' });
  try {
    if (usePostgres) await pool.query('INSERT INTO gifts (name,category,description,quantity,image) VALUES ($1,$2,$3,$4,$5)', [name, category, description, quantity, image]);
    else { const data = readData(); data.gifts.push({ id: data.nextGiftId++, name, category, description, quantity, image }); writeData(data); }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Não foi possível adicionar o presente.' }); }
});

app.put('/api/admin/gifts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id), name = cleanText(req.body.name, 100), category = cleanText(req.body.category, 60), description = cleanText(req.body.description, 240), image = cleanText(req.body.image, 60) || 'presente';
  const quantity = Math.max(1, Math.min(99, Number(req.body.quantity) || 1));
  try {
    if (usePostgres) await pool.query('UPDATE gifts SET name=$1,category=$2,description=$3,quantity=$4,image=$5 WHERE id=$6', [name, category, description, quantity, image, id]);
    else { const data = readData(); const g = data.gifts.find(g => g.id === id); if (!g) return res.status(404).json({ error: 'Presente não encontrado.' }); Object.assign(g, { name, category, description, quantity, image }); writeData(data); }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Não foi possível editar o presente.' }); }
});

app.delete('/api/admin/gifts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (usePostgres) await pool.query('DELETE FROM gifts WHERE id=$1', [id]);
    else { const data = readData(); data.gifts = data.gifts.filter(g => g.id !== id); data.reservations = data.reservations.filter(r => r.gift_id !== id); writeData(data); }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Não foi possível excluir.' }); }
});

app.delete('/api/admin/reservations/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (usePostgres) await pool.query('DELETE FROM reservations WHERE id=$1', [id]);
    else { const data = readData(); data.reservations = data.reservations.filter(r => r.id !== id); writeData(data); }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Não foi possível liberar este presente.' }); }
});

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => app.listen(PORT, () => console.log(`Daniel & Nubia em http://localhost:${PORT}`))).catch(err => { console.error(err); process.exit(1); });
