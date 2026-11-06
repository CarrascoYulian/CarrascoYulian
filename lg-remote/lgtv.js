// Cliente mínimo del protocolo SSAP de LG webOS sobre WebSocket.
import { PAIRING } from './pairing.js';

export class LGTV extends EventTarget {
  constructor(host, clientKey) {
    super();
    this.host = host;
    this.clientKey = clientKey || null;
    this.ws = null;
    this.input = null; // socket de botones / puntero
    this.nextId = 1;
    this.pending = new Map();
    this.subs = new Map();
  }

  get url() { return `wss://${this.host}:3001`; }
  get connected() { return this.ws && this.ws.readyState === WebSocket.OPEN; }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  connect(timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        err ? reject(err) : resolve(val);
      };
      const timer = setTimeout(() => {
        done(new Error('timeout'));
        try { this.ws.close(); } catch {}
      }, timeoutMs);

      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return done(e); }
      this.ws = ws;

      ws.onopen = () => {
        const payload = structuredClone(PAIRING);
        if (this.clientKey) payload['client-key'] = this.clientKey;
        ws.send(JSON.stringify({ type: 'register', id: 'register_0', payload }));
      };
      ws.onerror = () => done(new Error('socket'));
      ws.onclose = () => {
        this.input = null;
        done(new Error('closed'));
        this.emit('close');
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.id === 'register_0') {
          if (msg.type === 'registered') {
            this.clientKey = msg.payload['client-key'];
            this.emit('registered', this.clientKey);
            done(null, this.clientKey);
          } else if (msg.payload && msg.payload.pairingType === 'PROMPT') {
            this.emit('prompt');
          } else if (msg.type === 'error') {
            done(new Error(msg.error || 'rechazado'));
          }
          return;
        }
        const sub = this.subs.get(msg.id);
        if (sub) { sub(msg.payload || {}, msg); return; }
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.type === 'error' || (msg.payload && msg.payload.returnValue === false)) {
            p.reject(new Error(msg.error || msg.payload?.errorText || 'error'));
          } else {
            p.resolve(msg.payload || {});
          }
        }
      };
    });
  }

  request(uri, payload = {}) {
    if (!this.connected) return Promise.reject(new Error('desconectado'));
    const id = 'r' + this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: 'request', id, uri, payload }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('timeout'));
      }, 8000);
    });
  }

  subscribe(uri, cb, payload = {}) {
    if (!this.connected) return;
    const id = 's' + this.nextId++;
    this.subs.set(id, cb);
    this.ws.send(JSON.stringify({ type: 'subscribe', id, uri, payload }));
  }

  async inputSocket() {
    if (this.input && this.input.readyState === WebSocket.OPEN) return this.input;
    if (this._inputPromise) return this._inputPromise;
    this._inputPromise = (async () => {
      const { socketPath } = await this.request('ssap://com.webos.service.networkinput/getPointerInputSocket');
      // Las TVs a veces devuelven ws://...:3000; una página HTTPS necesita wss://...:3001.
      const path = socketPath.replace(/^ws:\/\//, 'wss://').replace(/:3000\//, ':3001/');
      const ws = new WebSocket(path);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('input socket')); });
      ws.onclose = () => { if (this.input === ws) this.input = null; };
      this.input = ws;
      return ws;
    })();
    try { return await this._inputPromise; } finally { this._inputPromise = null; }
  }

  async sendInput(type, fields = {}) {
    const ws = await this.inputSocket();
    const lines = ['type:' + type, ...Object.entries(fields).map(([k, v]) => `${k}:${v}`)];
    ws.send(lines.join('\n') + '\n\n');
  }

  button(name) { return this.sendInput('button', { name }); }
  move(dx, dy) { return this.sendInput('move', { dx: Math.round(dx), dy: Math.round(dy), down: 0 }); }
  scroll(dx, dy) { return this.sendInput('scroll', { dx: Math.round(dx), dy: Math.round(dy) }); }
  click() { return this.sendInput('click'); }

  close() {
    try { this.input && this.input.close(); } catch {}
    try { this.ws && this.ws.close(); } catch {}
  }
}
