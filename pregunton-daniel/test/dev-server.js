// Servidor local para pruebas: sirve /public y /api/game con almacenamiento en memoria.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.PD_STORE = process.env.PD_STORE || 'memory';
process.env.ADMIN_PIN = process.env.ADMIN_PIN || '123456';
const { default: handler } = await import('../api/game.js');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/game')) {
    let raw = ''; for await (const c of req) raw += c;
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    req.body = raw ? JSON.parse(raw) : {};
    return handler(req, res);
  }
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('no encontrado'); }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log('http://localhost:' + port));
