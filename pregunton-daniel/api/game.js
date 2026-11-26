import { getStore, getLegacyStore } from '../lib/store.js';
import { createGame } from '../lib/logic.js';

let game;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  game = game || createGame(getStore(), process.env, () => Date.now(), getLegacyStore());
  const out = await game.handle(body || {});
  return res.status(out.status).json(out.json);
}
