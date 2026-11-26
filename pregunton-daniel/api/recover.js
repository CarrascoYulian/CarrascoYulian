import crypto from 'node:crypto';
import { getStore, getLegacyStore } from '../lib/store.js';
import { createGame } from '../lib/logic.js';

// Tarea diaria de Vercel (ver vercel.json). Reintenta pasar los puntos del almacén anterior a Supabase
// hasta que se pueda una vez. Vercel la llama con "Authorization: Bearer <CRON_SECRET>".
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
let game;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'Falta CRON_SECRET.' });
  const sent = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!crypto.timingSafeEqual(sha(sent), sha(secret))) return res.status(401).json({ error: 'No autorizado.' });
  game = game || createGame(getStore(), process.env, () => Date.now(), getLegacyStore());
  const out = await game.autoImport();
  return res.status(out.status).json(out.json);
}
