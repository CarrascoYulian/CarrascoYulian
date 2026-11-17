import assert from 'node:assert/strict';
import { createGame } from '../lib/logic.js';
import { getStore } from '../lib/store.js';
import { ANSWERS } from '../lib/answers.js';

let clock = 1_000_000;
const env = { PD_STORE: 'memory', ADMIN_PIN: '123456' };
const game = createGame(getStore(env), env, () => clock);
const call = async body => game.handle(body);
const ok = async body => { const r = await call(body); assert.equal(r.status, 200, JSON.stringify(r)); return r.json; };
const err = async (body, status, code) => { const r = await call(body); assert.equal(r.status, status, JSON.stringify(r)); assert.equal(r.json.code, code); };
const pidA = 'a'.repeat(24), pidB = 'b'.repeat(24);
const qids = Object.keys(ANSWERS);
const [q1, q2, q3, q4] = qids;

// unirse
await err({ a: 'join', pid: pidA, name: 'A', team: 't1' }, 400, 'bad_name');
await err({ a: 'join', pid: pidA, name: 'Ana', team: 'zzz' }, 400, 'bad_team');
await err({ a: 'join', pid: 'corto', name: 'Ana', team: 't1' }, 400, 'bad_pid');
let st = await ok({ a: 'join', pid: pidA, name: '  Ana <b>  ', team: 't1' });
assert.equal(st.me.name, 'Ana b'); assert.equal(st.me.pts, 0);
await ok({ a: 'join', pid: pidB, name: 'Beto', team: 't2' });

// acierto rápido (5 s de 30)
let s = await ok({ a: 'start', pid: pidA, qid: q1 });
clock += 5000;
let r = await ok({ a: 'answer', pid: pidA, qid: q1, token: s.token, pick: ANSWERS[q1].a });
assert.equal(r.item.ok, 1); assert.equal(r.item.pts, 100 + Math.round(50 * 25 / 30)); assert.equal(r.correct, ANSWERS[q1].a);
// repetir la misma respuesta no suma otra vez
r = await ok({ a: 'answer', pid: pidA, qid: q1, token: s.token, pick: ANSWERS[q1].a });
assert.equal(r.dup, true); assert.equal(r.me.pts, 142);
await err({ a: 'start', pid: pidA, qid: q1 }, 409, 'answered');

// respuesta incorrecta
s = await ok({ a: 'start', pid: pidA, qid: q2 });
clock += 3000;
r = await ok({ a: 'answer', pid: pidA, qid: q2, token: s.token, pick: 'cualquier cosa' });
assert.equal(r.item.ok, 0); assert.equal(r.item.pts, 0); assert.equal(r.item.to, 0);

// pasarse del tiempo: aunque acierte, cuenta como sin tiempo
s = await ok({ a: 'start', pid: pidA, qid: q3 });
clock += 35_000;
r = await ok({ a: 'answer', pid: pidA, qid: q3, token: s.token, pick: ANSWERS[q3].a });
assert.equal(r.item.to, 1); assert.equal(r.item.ok, 0);

// "timeout" antes de tiempo se rechaza; después se acepta
s = await ok({ a: 'start', pid: pidA, qid: q4 });
clock += 5000;
await err({ a: 'timeout', pid: pidA, qid: q4, token: s.token }, 409, 'not_yet');
clock += 26_000;
r = await ok({ a: 'timeout', pid: pidA, qid: q4, token: s.token });
assert.equal(r.item.to, 1);

// token de otro jugador / otra pregunta / falsificado
const sB = await ok({ a: 'start', pid: pidB, qid: q1 });
await err({ a: 'answer', pid: pidA, qid: qids[5], token: sB.token, pick: 'x' }, 400, 'bad_token');
await err({ a: 'answer', pid: pidB, qid: q1, token: sB.token.replace(/.$/, c => c === 'a' ? 'b' : 'a'), pick: 'x' }, 400, 'bad_token');
await err({ a: 'answer', pid: pidB, qid: qids[6], token: sB.token, pick: 'x' }, 400, 'bad_token');

// marcador: nadie ve respuestas ajenas
clock += 20_000; game._cacheReset();
st = await ok({ a: 'state', pid: pidB });
assert.deepEqual(Object.keys(st.board[0]).sort(), ['id', 'name', 'pts', 'team']);
assert.equal(st.board[0].name, 'Ana b'); assert.equal(st.board[0].pts, 142);
const blob = JSON.stringify(st);
for (const k of qids) if (ANSWERS[k].a.length > 12) assert.ok(!blob.includes(ANSWERS[k].a), 'no se filtra: ' + ANSWERS[k].a);
assert.deepEqual(st.me.items, {});

// panel
await err({ a: 'admin_players', pin: 'mal' }, 401, 'bad_pin');
const adm = await ok({ a: 'admin_players', pin: '123456' });
assert.equal(adm.players.length, 2);
const ana = adm.players.find(p => p.name === 'Ana b');
assert.equal(Object.keys(ana.items).length, 4);

// rondas y cierre del juego
await ok({ a: 'admin_cfg', pin: '123456', cfg: { open: true, from: 5, to: 3, secs: 45, teams: [{ id: 't1', name: 'Leones' }, { id: 't2', name: 'Fieles' }] } });
const c = (await ok({ a: 'state' })).cfg;
assert.equal(c.from, 3); assert.equal(c.to, 5); assert.equal(c.secs, 45); assert.equal(c.teams[0].name, 'Leones');
const outQ = qids.find(q => ANSWERS[q].c === 12);
await err({ a: 'start', pid: pidB, qid: outQ }, 409, 'out_of_round');
const inQ = qids.find(q => ANSWERS[q].c === 4);
s = await ok({ a: 'start', pid: pidB, qid: inQ }); assert.equal(s.secs, 45);
await ok({ a: 'admin_cfg', pin: '123456', cfg: { ...c, open: false } });
await err({ a: 'start', pid: pidB, qid: inQ }, 409, 'closed');

// reiniciar puntajes
const rs = await ok({ a: 'admin_reset', pin: '123456' }); assert.equal(rs.count, 2);
st = await ok({ a: 'state', pid: pidA });
assert.equal(st.me.pts, 0); assert.deepEqual(st.me.items, {}); assert.equal(st.me.name, 'Ana b');

// acciones inválidas
await err({ a: 'nada' }, 400, 'bad_action');
console.log('OK: todas las pruebas del servidor pasaron');
