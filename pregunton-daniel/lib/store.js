// Almacén de datos. En Vercel usa un Blob privado (un archivo JSON por jugador).
// Con PD_STORE=memory usa memoria, solo para pruebas locales.

function memoryStore() {
  const data = new Map();
  return {
    async get(path) { return data.has(path) ? JSON.parse(data.get(path)) : null; },
    async put(path, obj) { data.set(path, JSON.stringify(obj)); },
    async list(prefix) { return [...data.keys()].filter(k => k.startsWith(prefix)).sort(); },
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
  return env.PD_STORE === 'memory' ? memoryStore() : blobStore();
}
