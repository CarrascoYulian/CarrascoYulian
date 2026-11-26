// Almacén de datos. Interfaz: get(path), put(path, obj), del(path), list(prefix) y listAll(prefix).
//  - Supabase (Postgres): el principal. Una sola consulta trae a todos los jugadores.
//  - Memoria (PD_STORE=memory): solo para pruebas locales.
//  - Vercel Blob: el almacén anterior. Solo se usa para recuperar los puntos viejos (importación).

function memoryStore() {
  const data = new Map();
  return {
    async get(path) { return data.has(path) ? JSON.parse(data.get(path)) : null; },
    async put(path, obj) { data.set(path, JSON.stringify(obj)); },
    async list(prefix) { return [...data.keys()].filter(k => k.startsWith(prefix)).sort(); },
    async listAll(prefix) { return [...data.keys()].filter(k => k.startsWith(prefix)).sort().map(k => ({ path: k, data: JSON.parse(data.get(k)) })); },
    async del(path) { data.delete(path); },
  };
}

function supabaseStore(env) {
  const base = String(env.SUPABASE_URL).replace(/\/$/, '') + '/rest/v1/rpc/';
  const key = env.SUPABASE_KEY, secret = env.PD_DB_SECRET;
  async function rpc(fn, args) {
    const r = await fetch(base + fn, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, ...args }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error('Supabase ' + fn + ' ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }
  return {
    async get(path) { const d = await rpc('pd_get', { p_path: path }); return d == null ? null : d; },
    async put(path, obj) { await rpc('pd_put', { p_path: path, p_data: obj }); },
    async del(path) { await rpc('pd_del', { p_path: path }); },
    async list(prefix) { return (await rpc('pd_list', { p_prefix: prefix })).map(r => r.path); },
    async listAll(prefix) { return (await rpc('pd_list', { p_prefix: prefix })).map(r => ({ path: r.path, data: r.data })); },
  };
}

function blobStore() {
  const sdk = () => import('@vercel/blob');
  return {
    async get(path) {
      const { get } = await sdk();
      const r = await get(path, { access: 'private', useCache: false });
      if (!r || !r.stream) return null;
      return JSON.parse(await new Response(r.stream).text());
    },
    async put(path, obj) {
      const { put } = await sdk();
      await put(path, JSON.stringify(obj), {
        access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
      });
    },
    async del(path) {
      const { del } = await sdk();
      await del(path);
    },
    async list(prefix) {
      const { list } = await sdk();
      const out = []; let cursor;
      do {
        const r = await list({ prefix, cursor, limit: 1000 });
        out.push(...r.blobs.map(b => b.pathname));
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return out;
    },
  };
}

export function getStore(env = process.env) {
  if (env.PD_STORE === 'memory') return memoryStore();
  if (env.SUPABASE_URL && env.SUPABASE_KEY && env.PD_DB_SECRET) return supabaseStore(env);
  return blobStore();
}

/** Almacén anterior (Vercel Blob), solo si hay token. Sirve únicamente para importar los puntos viejos. */
export function getLegacyStore(env = process.env) {
  return env.BLOB_READ_WRITE_TOKEN && env.SUPABASE_URL ? blobStore() : null;
}
