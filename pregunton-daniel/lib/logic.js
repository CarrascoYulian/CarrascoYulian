import crypto from 'node:crypto';
import { ANSWERS } from './answers.js';

export const CHAPTERS = 12;
export const SECS_OPTIONS = [20, 30, 45, 60];
// Azul, rojo, amarillo, verde, morado, naranja, rosa, turquesa.
const PALETTE = ['#4f9bff', '#e5484d', '#f5d33a', '#3fbf7f', '#b995f2', '#f28c28', '#f08bb6', '#5fd0d6'];
// Seis equipos, como en el afiche del campamento. Se pueden cambiar desde el Panel.
const TEAM_NAMES = ['Daniel', 'Sadrac', 'Mesac', 'Abed-Nego', 'Babilonia', 'Israel'];
const BASE = { medio: 100, alto: 150 };   // puntos base por nivel; la rapidez suma hasta la mitad más
const GRACE_MS = 2000;      // margen por la demora de la red
const CACHE_MS = 12000;     // el marcador se recalcula como máximo cada 12 s por instancia
const PID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const defaultCfg = () => ({
  open: true, cards: true, from: 1, to: CHAPTERS, secs: 30,
  teams: TEAM_NAMES.map((name, i) => ({ id: 't' + (i + 1), name, color: PALETTE[i] })),
});

export function normCfg(d) {
  d = d || {};
  let from = Math.min(CHAPTERS, Math.max(1, parseInt(d.from, 10) || 1));
  let to = Math.min(CHAPTERS, Math.max(1, parseInt(d.to, 10) || CHAPTERS));
  if (from > to) [from, to] = [to, from];
  const secs = SECS_OPTIONS.includes(d.secs) ? d.secs : 30;
  const teams = Array.isArray(d.teams) && d.teams.length >= 2
    ? d.teams.slice(0, 8).map((t, i) => ({
        id: String(t.id || 't' + (i + 1)).slice(0, 12).replace(/[^A-Za-z0-9_-]/g, '') || 't' + (i + 1),
        name: String(t.name || 'Equipo ' + (i + 1)).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Equipo ' + (i + 1),
        color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : PALETTE[i % PALETTE.length],
      }))
    : defaultCfg().teams;
  return { open: d.open !== false, cards: d.cards !== false, from, to, secs, teams };
}

const pubId = pid => crypto.createHash('sha256').update('pub:' + pid).digest('hex').slice(0, 12);
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
export const ptsFor = (leftMs, secs, lv = 'medio') => {
  const base = BASE[lv] || BASE.medio;
  return base + Math.round(base * 0.5 * Math.max(0, leftMs) / (secs * 1000));
};
const cleanName = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

class HttpError extends Error { constructor(status, msg, code) { super(msg); this.status = status; this.code = code; } }

export function createGame(store, env = process.env, now = () => Date.now()) {
  const secret = String(env.GAME_SECRET || env.ADMIN_PIN || 'dev-secret');
  let cache = null; // { t, players: Map(pid -> player), cfg }

  const sign = payload => crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const makeToken = (pid, qid, t, secs) => { const p = Buffer.from([pubId(pid), qid, t, secs].join('|')).toString('base64url'); return p + '.' + sign(p); };
  function readToken(token, pid, qid) {
    const [p, s] = String(token || '').split('.');
    if (!p || !s) return null;
    const good = sign(p);
    if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
    const [who, q, t, secs] = Buffer.from(p, 'base64url').toString().split('|');
    if (who !== pubId(pid) || q !== qid) return null;
    return { t: Number(t), secs: Number(secs) };
  }

  async function loadCfg() {
    return normCfg(await store.get('config.json'));
  }
  async function loadAll(force) {
    if (!force && cache && now() - cache.t < CACHE_MS) return cache;
    const paths = (await store.list('players/')).filter(p => p.endsWith('.json'));
    const players = new Map();
    for (let i = 0; i < paths.length; i += 10) {
      const chunk = await Promise.all(paths.slice(i, i + 10).map(p => store.get(p)));
      chunk.forEach((pl, j) => { if (pl && pl.pid) players.set(pl.pid, pl); });
    }
    cache = { t: now(), players, cfg: await loadCfg() };
    return cache;
  }
  const getPlayer = pid => store.get('players/' + pid + '.json');
  async function savePlayer(pl) {
    await store.put('players/' + pl.pid + '.json', pl);
    if (cache) cache.players.set(pl.pid, pl);
  }
  const sumPts = items => Object.values(items || {}).reduce((a, x) => a + (x.pts || 0), 0);
  const meView = pl => pl ? { id: pubId(pl.pid), name: pl.name, team: pl.team, pts: pl.pts || 0, n: pl.n || 0, t: pl.t || 0, items: pl.items || {} } : null;

  async function stateFor(pid, force) {
    const c = await loadAll(force);
    const board = [...c.players.values()]
      .map(p => ({ id: pubId(p.pid), name: p.name, team: p.team, pts: p.pts || 0 }))
      .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'es'));
    return { now: now(), cfg: c.cfg, board, me: pid ? meView(c.players.get(pid) || await getPlayer(pid)) : null };
  }

  function checkAdmin(body) {
    const pin = String(env.ADMIN_PIN || '');
    if (!pin) throw new HttpError(503, 'El panel no está configurado todavía.', 'no_pin');
    const a = sha(body.pin || ''), b = sha(pin);
    if (!crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Clave incorrecta.', 'bad_pin');
  }
  const needPid = pid => { if (!PID_RE.test(String(pid || ''))) throw new HttpError(400, 'Falta tu identificador.', 'bad_pid'); return pid; };

  async function recordResult(pid, qid, tok, pick, forceTimeout) {
    const pl = await getPlayer(pid);
    if (!pl) throw new HttpError(404, 'Primero entra al juego.', 'no_player');
    const key = ANSWERS[qid];
    if (!key) throw new HttpError(400, 'Pregunta desconocida.', 'bad_q');
    const reveal = key.k === 'p' ? { d: key.d, kv: key.kv, refs: key.refs } : undefined;
    const t = readToken(tok, pid, qid);
    if (!t) throw new HttpError(400, 'La pregunta no se inició bien. Vuelve a empezarla.', 'bad_token');
    const prev = pl.items && pl.items[qid];
    // Mismo intento enviado dos veces (por ejemplo, tras un corte de internet): no se vuelve a contar.
    if (prev && prev.st === t.t) return { item: prev.la || prev, correct: key.a, reveal, me: meView(pl), dup: true };
    const elapsed = now() - t.t, limit = t.secs * 1000;
    if (forceTimeout && elapsed < limit - 1500) throw new HttpError(409, 'Todavía queda tiempo.', 'not_yet');
    const timedOut = forceTimeout || elapsed > limit + GRACE_MS;
    const ok = !timedOut && pick === key.a;
    const base = { ok: ok ? 1 : 0, pick: timedOut ? '' : String(pick || '').slice(0, 200), sec: Math.round(Math.min(t.secs, Math.max(0, elapsed / 1000)) * 10) / 10, to: timedOut ? 1 : 0 };
    // Repaso: solo suma una pregunta que nunca se había acertado. Lo que ya estaba bien no suma otra vez.
    const earned = ok && !(prev && prev.ok) ? ptsFor(limit - elapsed, t.secs, key.lv) : 0;
    const la = { ...base, pts: earned };            // lo que se le muestra por este intento
    const att = ((prev && prev.att) || (prev ? 1 : 0)) + 1;
    const stored = !prev || (!prev.ok && ok)
      ? { ...base, pts: earned, st: t.t, att, la }  // primer intento, o una fallada que ahora acertó
      : { ...prev, st: t.t, att, la };              // ya estaba bien (o sigue mal): se conserva
    pl.items = Object.assign({}, pl.items, { [qid]: stored });
    pl.pts = sumPts(pl.items); pl.n = Object.keys(pl.items).length; pl.t = now();
    await savePlayer(pl);
    return { item: la, correct: key.a, reveal, me: meView(pl) };
  }

  const actions = {
    async state(b) { return stateFor(b.pid ? needPid(b.pid) : null); },

    async join(b) {
      const pid = needPid(b.pid);
      const name = cleanName(b.name);
      if (name.length < 2) throw new HttpError(400, 'Escribe tu nombre o apodo (mínimo 2 letras).', 'bad_name');
      const cfg = await loadCfg();
      if (!cfg.teams.some(t => t.id === b.team)) throw new HttpError(400, 'Elige tu equipo.', 'bad_team');
      const prev = await getPlayer(pid);
      const pl = Object.assign({ items: {}, pts: 0, n: 0 }, prev, { pid, name, team: b.team, t: now() });
      await savePlayer(pl);
      return stateFor(pid);
    },

    async start(b) {
      const pid = needPid(b.pid); const qid = String(b.qid || '');
      const pl = await getPlayer(pid);
      if (!pl) throw new HttpError(404, 'Primero entra al juego.', 'no_player');
      const key = ANSWERS[qid];
      if (!key) throw new HttpError(400, 'Pregunta desconocida.', 'bad_q');
      const cfg = await loadCfg();
      if (!cfg.open) throw new HttpError(409, 'El juego está cerrado por ahora.', 'closed');
      // Se puede volver a jugar una pregunta ya respondida (repaso); el servidor decide si suma puntos al responder.
      if (key.k === 'p') {
        if (!cfg.cards) throw new HttpError(409, 'Las tarjetas están cerradas por ahora.', 'closed');
      } else if (key.c < cfg.from || key.c > cfg.to) throw new HttpError(409, 'Esa pregunta no está en la ronda actual.', 'out_of_round');
      const t = now();
      return { token: makeToken(pid, qid, t, cfg.secs), left: cfg.secs, secs: cfg.secs };
    },

    async answer(b) { return recordResult(needPid(b.pid), String(b.qid || ''), b.token, b.pick, false); },
    async timeout(b) { return recordResult(needPid(b.pid), String(b.qid || ''), b.token, null, true); },

    async admin_check(b) { checkAdmin(b); return { ok: true }; },
    async admin_players(b) {
      checkAdmin(b);
      const c = await loadAll(false);
      const cardNames = {};
      for (const [id, k] of Object.entries(ANSWERS)) if (k.k === 'p') cardNames[id] = k.a;
      return { now: now(), cfg: c.cfg, cardNames, players: [...c.players.values()].map(p => ({ id: pubId(p.pid), name: p.name, team: p.team, pts: p.pts || 0, n: p.n || 0, items: p.items || {} })) };
    },
    async admin_cfg(b) {
      checkAdmin(b);
      const cfg = normCfg(b.cfg);
      await store.put('config.json', cfg);
      if (cache) cache.cfg = cfg;
      return { cfg };
    },
    async admin_remove(b) {
      checkAdmin(b);
      const c = await loadAll(true);
      const target = [...c.players.values()].find(p => pubId(p.pid) === String(b.id || ''));
      if (!target) throw new HttpError(404, 'No se encontró ese jugador.', 'no_player');
      await store.del('players/' + target.pid + '.json');
      c.players.delete(target.pid);
      return { ok: true };
    },
    async admin_reset(b) {
      checkAdmin(b);
      const c = await loadAll(true);
      const list = [...c.players.values()];
      for (let i = 0; i < list.length; i += 10) {
        await Promise.all(list.slice(i, i + 10).map(async p => { p.items = {}; p.pts = 0; p.n = 0; p.t = now(); await savePlayer(p); }));
      }
      return { ok: true, count: list.length };
    },
  };

  return {
    async handle(body) {
      try {
        const fn = actions[body && body.a];
        if (!fn) throw new HttpError(400, 'Acción desconocida.', 'bad_action');
        return { status: 200, json: await fn(body) };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, json: { error: e.message, code: e.code } };
        console.error(e);
        return { status: 500, json: { error: 'Error del servidor. Inténtalo de nuevo.', code: 'server' } };
      }
    },
    _cacheReset() { cache = null; },
  };
}
