import { LGTV } from './lgtv.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const STORE_KEY = 'lgremote.tvs';
const LAST_KEY = 'lgremote.last';

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

let tvs = load(STORE_KEY, {}); // { ip: { key, name } }
let tv = null;

// ---------- UI helpers ----------
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}
function buzz() { if (navigator.vibrate) navigator.vibrate(12); }
function show(id) {
  $$('.screen').forEach((s) => (s.hidden = s.id !== id));
}
function setStatus(msg, kind = '') {
  const s = $('#setup-status');
  s.textContent = msg;
  s.className = 'status ' + kind;
}
function setConnected(ok) {
  $('#conn-dot').classList.toggle('on', ok);
}

// ---------- Configuración ----------
function renderSaved() {
  const ips = Object.keys(tvs);
  $('#saved').hidden = ips.length === 0;
  const ul = $('#saved-list');
  ul.innerHTML = '';
  for (const ip of ips) {
    const li = document.createElement('li');
    li.innerHTML = `<button class="saved-item"><b></b><span class="muted"></span></button><button class="forget" aria-label="Olvidar">Olvidar</button>`;
    $('b', li).textContent = tvs[ip].name || 'TV LG';
    $('span', li).textContent = ip;
    $('.saved-item', li).onclick = () => connectTo(ip);
    $('.forget', li).onclick = () => { delete tvs[ip]; save(STORE_KEY, tvs); renderSaved(); };
    ul.appendChild(li);
  }
}

function validIp(ip) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every((n) => +n <= 255);
}

$('#open-cert').onclick = () => {
  const ip = $('#ip').value.trim();
  if (!validIp(ip)) { setStatus('Escribe primero una IP válida.', 'err'); $('#ip').focus(); return; }
  window.open(`https://${ip}:3001/`, '_blank', 'noopener');
};

$('#setup-form').onsubmit = (e) => {
  e.preventDefault();
  const ip = $('#ip').value.trim();
  if (!validIp(ip)) { setStatus('La IP no es válida.', 'err'); return; }
  connectTo(ip);
};

$('#tv-name').onclick = () => {
  if (tv) { tv.close(); tv = null; }
  renderSaved();
  show('setup');
};

// ---------- Conexión ----------
let reconnectTimer;
async function connectTo(ip, { silent = false } = {}) {
  clearTimeout(reconnectTimer);
  if (tv) { tv.onclose = null; tv.close(); }
  $('#ip').value = ip;
  const entry = tvs[ip] || {};
  const client = new LGTV(ip, entry.key);
  tv = client;

  if (!silent) setStatus('Conectando…');
  $('#connect-btn').disabled = true;
  client.addEventListener('prompt', () => setStatus('Acepta la solicitud en la pantalla de la TV…', 'warn'));
  client.addEventListener('close', () => {
    if (tv !== client) return;
    setConnected(false);
    if (!$('#remote').hidden) {
      toast('Conexión perdida. Reintentando…');
      reconnectTimer = setTimeout(() => connectTo(ip, { silent: true }), 3000);
    }
  });

  try {
    const key = await client.connect(entry.key ? 10000 : 60000);
    tvs[ip] = { ...entry, key };
    save(STORE_KEY, tvs);
    save(LAST_KEY, ip);
    setStatus('');
    setConnected(true);
    show('remote');
    afterConnect(client, ip);
  } catch (err) {
    if (tv !== client) return;
    setConnected(false);
    if ($('#remote').hidden || !silent) {
      show('setup');
      setStatus(explain(err, ip), 'err');
    } else {
      reconnectTimer = setTimeout(() => connectTo(ip, { silent: true }), 5000);
    }
  } finally {
    $('#connect-btn').disabled = false;
  }
}

function explain(err, ip) {
  if (err.message === 'timeout') return 'La TV no respondió a tiempo. ¿Aceptaste el aviso en la pantalla?';
  if (err.message === 'socket' || err.message === 'closed')
    return `No se pudo abrir la conexión con ${ip}. Revisa: 1) la TV está encendida y en la misma red; 2) aceptaste el certificado en https://${ip}:3001; 3) el navegador tiene permiso de «red local»; 4) en la TV está activado «LG Connect Apps» / «Control móvil de TV».`;
  return 'La TV rechazó la conexión: ' + err.message;
}

async function afterConnect(client, ip) {
  // Nombre de la TV
  client.request('ssap://system/getSystemInfo').then((info) => {
    const name = info.modelName ? `LG ${info.modelName}` : 'TV LG';
    $('#tv-label').textContent = name;
    tvs[ip] = { ...tvs[ip], name };
    save(STORE_KEY, tvs);
  }).catch(() => { $('#tv-label').textContent = tvs[ip]?.name || 'TV LG'; });

  // Volumen en vivo
  client.subscribe('ssap://audio/getVolume', (p) => {
    const vol = p.volume ?? p.volumeStatus?.volume;
    const muted = p.muted ?? p.volumeStatus?.muteStatus;
    if (vol === undefined) return;
    const pill = $('#vol-pill');
    pill.hidden = false;
    pill.textContent = muted ? 'Silencio' : `Vol ${vol}`;
    $('#mute-btn').classList.toggle('active', !!muted);
    state.muted = !!muted;
  });

  // Abrir el socket de botones con antelación para que el primer toque sea inmediato
  client.inputSocket().catch(() => {});
  appsLoaded = false;
}

// ---------- Acciones ----------
const state = { muted: false };

const actions = {
  power: () => {
    if (confirm('¿Apagar la TV?')) tv.request('ssap://system/turnOff');
  },
  volUp: () => tv.request('ssap://audio/volumeUp'),
  volDown: () => tv.request('ssap://audio/volumeDown'),
  mute: () => tv.request('ssap://audio/setMute', { mute: !state.muted }),
  chUp: () => tv.request('ssap://tv/channelUp'),
  chDown: () => tv.request('ssap://tv/channelDown'),
  play: () => tv.request('ssap://media.controls/play'),
  pause: () => tv.request('ssap://media.controls/pause'),
  rewind: () => tv.request('ssap://media.controls/rewind'),
  ff: () => tv.request('ssap://media.controls/fastForward'),
};

function run(fn) {
  if (!tv || !tv.connected) { toast('Sin conexión con la TV'); return; }
  buzz();
  Promise.resolve().then(fn).catch((e) => toast('Error: ' + e.message));
}

// Botones simples y con repetición al mantener pulsado
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-btn],[data-act]');
  if (!el) return;
  const fire = () => {
    if (el.dataset.btn) run(() => tv.button(el.dataset.btn));
    else run(actions[el.dataset.act]);
  };
  el.classList.add('pressed');
  fire();
  let repeat;
  const hold = el.hasAttribute('data-repeat') || el.closest('#dpad') && el.dataset.btn !== 'ENTER';
  const delay = hold ? setTimeout(() => (repeat = setInterval(fire, 140)), 450) : null;
  const stop = () => {
    clearTimeout(delay); clearInterval(repeat);
    el.classList.remove('pressed');
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
});

// ---------- Paneles ----------
let openPanel = null;
function panel(name) {
  closePanel();
  const el = $('#panel-' + name);
  if (!el) return;
  el.hidden = false;
  $('#backdrop').hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
  openPanel = el;
  if (name === 'apps') loadApps();
  if (name === 'inputs') loadInputs();
  if (name === 'keyboard') setTimeout(() => $('#kb-input').focus(), 250);
}
function closePanel() {
  if (!openPanel) return;
  const el = openPanel;
  el.classList.remove('open');
  $('#backdrop').hidden = true;
  setTimeout(() => (el.hidden = true), 200);
  openPanel = null;
}
$$('[data-panel]').forEach((b) => (b.onclick = () => panel(b.dataset.panel)));
$$('.sheet .close').forEach((b) => (b.onclick = closePanel));
$('#backdrop').onclick = closePanel;

let appsLoaded = false;
async function loadApps() {
  if (appsLoaded || !tv?.connected) return;
  const grid = $('#apps-grid');
  try {
    const { launchPoints = [] } = await tv.request('ssap://com.webos.applicationManager/listLaunchPoints');
    grid.innerHTML = '';
    launchPoints
      .filter((a) => a.title)
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((a) => {
        const b = document.createElement('button');
        b.className = 'app';
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        // Los iconos vienen como http://IP:3000/...; desde HTTPS hay que pedirlos por https://IP:3001/...
        img.src = (a.icon || a.largeIcon || '').replace(/^http:\/\/([^/:]+):3000\//, 'https://$1:3001/');
        img.onerror = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'app-fallback', textContent: a.title[0] }));
        const label = document.createElement('span');
        label.textContent = a.title;
        b.append(img, label);
        if (a.bgColor) b.style.setProperty('--app-bg', a.bgColor);
        b.onclick = () => run(async () => {
          await tv.request('ssap://system.launcher/launch', { id: a.id });
          closePanel();
          toast('Abriendo ' + a.title);
        });
        grid.appendChild(b);
      });
    appsLoaded = true;
  } catch (e) {
    grid.innerHTML = '<p class="muted">No se pudo cargar la lista de apps.</p>';
  }
}

async function loadInputs() {
  const ul = $('#inputs-list');
  if (!tv?.connected) return;
  try {
    const { devices = [] } = await tv.request('ssap://tv/getExternalInputList');
    ul.innerHTML = '';
    const items = [{ id: 'com.webos.app.livetv', label: 'TV en vivo', live: true }, ...devices];
    for (const d of items) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.textContent = d.label || d.id;
      if (d.connected === false) b.classList.add('dim');
      b.onclick = () => run(async () => {
        if (d.live) await tv.request('ssap://system.launcher/launch', { id: d.id });
        else await tv.request('ssap://tv/switchInput', { inputId: d.id });
        closePanel();
      });
      li.appendChild(b);
      ul.appendChild(li);
    }
  } catch {
    ul.innerHTML = '<li class="muted">No se pudo leer la lista de entradas.</li>';
  }
}

// ---------- Teclado ----------
$('#kb-form').onsubmit = (e) => {
  e.preventDefault();
  const text = $('#kb-input').value;
  run(async () => {
    if (text) await tv.request('ssap://com.webos.service.ime/insertText', { text, replace: 0 });
    await tv.request('ssap://com.webos.service.ime/sendEnterKey');
    $('#kb-input').value = '';
  });
};
$('#kb-del').onclick = () => run(() => tv.request('ssap://com.webos.service.ime/deleteCharacters', { count: 1 }));

// ---------- Touchpad ----------
(function touchpad() {
  const pad = $('#touchpad');
  const pts = new Map();
  let moved = 0, last = null, startT = 0, queued = { dx: 0, dy: 0 }, raf = null, twoFinger = false;
  const flush = () => {
    raf = null;
    const { dx, dy } = queued;
    queued = { dx: 0, dy: 0 };
    if (!tv?.connected || (!dx && !dy)) return;
    (twoFinger ? tv.scroll(0, -dy / 3) : tv.move(dx * 1.6, dy * 1.6)).catch(() => {});
  };
  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    twoFinger = pts.size > 1;
    if (pts.size === 1) { moved = 0; startT = Date.now(); }
    last = { x: e.clientX, y: e.clientY };
  });
  pad.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    queued.dx += dx; queued.dy += dy;
    if (!raf) raf = requestAnimationFrame(flush);
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      if (moved < 8 && Date.now() - startT < 300 && !twoFinger) run(() => tv.click());
      twoFinger = false;
    }
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
})();

// ---------- Volver a conectar al regresar a la app ----------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && tv && !tv.connected && !$('#remote').hidden) {
    connectTo(tv.host, { silent: true });
  }
});

// ---------- Inicio ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const last = load(LAST_KEY, null);
renderSaved();
if (last && tvs[last]?.key) {
  $('#tv-label').textContent = tvs[last].name || 'TV LG';
  show('remote');
  connectTo(last, { silent: true });
} else {
  show('setup');
}
