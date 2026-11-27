/**
 * Batch state and original photo bytes.
 * MemoryStore is the test double. FileStore is the local dry-run.
 * SupabaseStore is the production store since 27 Nov 2026: one private Postgres
 * table reached through the ssj_kv_* functions (see ../supabase/001_ssj_kv.sql).
 * BlobStore (Vercel Blob) was the store before. Its Hobby quota suspended it on 20 Nov.
 */

class MemoryStore {
  constructor() { this.map = new Map(); }
  async put(key, body) { this.map.set(key, Buffer.from(body)); }
  async get(key) {
    const hit = this.map.get(key);
    return hit ? Buffer.from(hit) : null;
  }
  // No await between the check and the write. Concurrent callers stay single-threaded here.
  async putIfAbsent(key, body) {
    if (this.map.has(key)) return { created: false };
    this.map.set(key, Buffer.from(body));
    return { created: true };
  }
  async list(prefix) {
    const keys = [];
    for (const key of this.map.keys()) {
      if (String(key).startsWith(prefix)) keys.push(key);
    }
    return keys;
  }
  async delete(key) { this.map.delete(key); }
  async putJson(key, value) { await this.put(key, Buffer.from(JSON.stringify(value))); }
  async getJson(key) {
    const buf = await this.get(key);
    return buf ? JSON.parse(buf.toString('utf8')) : null;
  }
}

class FileStore {
  constructor(dir) {
    this.dir = dir;
    require('fs').mkdirSync(dir, { recursive: true });
  }
  _path(key) {
    const path = require('path');
    const safe = String(key).replace(/[^a-zA-Z0-9._:-]+/g, '_');
    return path.join(this.dir, safe);
  }
  async put(key, body) { require('fs').writeFileSync(this._path(key), Buffer.from(body)); }
  async get(key) {
    const fs = require('fs');
    const p = this._path(key);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  async putIfAbsent(key, body) {
    const fs = require('fs');
    try {
      fs.writeFileSync(this._path(key), Buffer.from(body), { flag: 'wx' });
      return { created: true };
    } catch (err) {
      if (err && err.code === 'EEXIST') return { created: false };
      throw err;
    }
  }
  async list(prefix) {
    const fs = require('fs');
    const safePrefix = String(prefix).replace(/[^a-zA-Z0-9._:-]+/g, '_');
    return fs.readdirSync(this.dir).filter(name => name.startsWith(safePrefix));
  }
  async delete(key) {
    const fs = require('fs');
    const p = this._path(key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  async putJson(key, value) { await this.put(key, Buffer.from(JSON.stringify(value, null, 2))); }
  async getJson(key) {
    const buf = await this.get(key);
    return buf ? JSON.parse(buf.toString('utf8')) : null;
  }
}

function blobAlreadyExists(err) {
  const code = err && (err.code || err.errorCode);
  if (code === 'blob_already_exists') return true;
  const name = err && err.name;
  if (name === 'BlobAlreadyExistsError') return true;
  return /already exists/i.test(String(err && err.message || ''));
}

// @vercel/blob 2.8.2 turns an unrecognized blob_already_exists into "Unknown error".
function ambiguousBlobWrite(err) {
  if (blobAlreadyExists(err)) return false;
  return /unknown error/i.test(String(err && err.message || ''));
}

function createBlobStoreFromClient(client) {
  return {
    async put(key, body, contentType) {
      await client.put(key, body, {
        access: 'private',
        contentType: contentType || 'application/octet-stream',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    },
    async get(key) {
      const result = await client.get(key, { access: 'private', useCache: false });
      if (!result) return null;
      if (Buffer.isBuffer(result)) return Buffer.from(result);
      if (!result.stream) return null;
      const chunks = [];
      for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    },
    async putIfAbsent(key, body, contentType) {
      const payload = Buffer.from(body);
      try {
        await client.put(key, payload, {
          access: 'private',
          contentType: contentType || 'application/octet-stream',
          addRandomSuffix: false,
          allowOverwrite: false,
        });
        return { created: true };
      } catch (err) {
        if (blobAlreadyExists(err)) return { created: false };
        if (ambiguousBlobWrite(err)) {
          const existing = await this.get(key);
          if (existing && existing.equals(payload)) return { created: true };
          if (existing) return { created: false };
        }
        throw err;
      }
    },
    async list(prefix) {
      const keys = [];
      let cursor;
      do {
        const page = await client.list({ prefix, cursor, limit: 1000 });
        for (const item of (page && page.blobs) || []) {
          if (item && item.pathname) keys.push(item.pathname);
        }
        cursor = page && page.hasMore && page.cursor ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
    async delete(key) {
      if (typeof client.del === 'function') await client.del(key);
      else if (typeof client.delete === 'function') await client.delete(key);
    },
    async putJson(key, value) { await this.put(key, Buffer.from(JSON.stringify(value)), 'application/json'); },
    async getJson(key) {
      const buf = await this.get(key);
      return buf ? JSON.parse(buf.toString('utf8')) : null;
    },
  };
}

function createBlobStore(token) {
  let blob;
  try { blob = require('@vercel/blob'); }
  catch (e) { throw new Error('Install @vercel/blob to store photos. ' + e.message); }
  return createBlobStoreFromClient({
    put: (key, body, options) => blob.put(key, body, { ...options, token }),
    get: (key, options) => blob.get(key, { ...options, token }),
    list: (options) => blob.list({ ...options, token }),
    del: (key) => blob.del(key, { token }),
  });
}

/**
 * Calls the ssj_kv_* Postgres functions over the Supabase REST API.
 * key is the project's publishable (anon) key. secret is the bot secret the
 * functions check, so the publishable key alone cannot read or write anything.
 */
function createSupabaseStore({ url, key, secret, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const base = String(url).replace(/\/+$/, '');
  async function rpc(name, args) {
    const fail = message => Object.assign(new Error(message), { storeError: true });
    let res;
    try {
      res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: key,
          ...(String(key).startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_secret: secret, ...args }),
      });
    } catch (err) {
      throw fail(`Supabase store ${name} unreachable: ${(err && err.message) || err}`);
    }
    const text = await res.text();
    if (!res.ok) {
      let detail = text;
      try { detail = JSON.parse(text).message || text; } catch (e) { /* plain text */ }
      throw fail(`Supabase store ${name} failed (${res.status}): ${String(detail).slice(0, 200)}`);
    }
    return text ? JSON.parse(text) : null;
  }
  const b64 = body => Buffer.from(body).toString('base64');
  return {
    async put(k, body, contentType) {
      await rpc('ssj_kv_put', { p_key: k, p_body: b64(body), p_type: contentType || 'application/octet-stream' });
    },
    async get(k) {
      const out = await rpc('ssj_kv_get', { p_key: k });
      return out == null ? null : Buffer.from(out, 'base64');
    },
    async putIfAbsent(k, body, contentType) {
      const created = await rpc('ssj_kv_put_if_absent', { p_key: k, p_body: b64(body), p_type: contentType || 'application/octet-stream' });
      return { created: created === true };
    },
    async list(prefix) {
      const rows = await rpc('ssj_kv_list', { p_prefix: prefix });
      return (rows || []).map(r => (typeof r === 'string' ? r : r.ssj_kv_list));
    },
    async delete(k) { await rpc('ssj_kv_delete', { p_key: k }); },
    async putJson(k, value) { await this.put(k, Buffer.from(JSON.stringify(value)), 'application/json'); },
    async getJson(k) {
      const buf = await this.get(k);
      return buf ? JSON.parse(buf.toString('utf8')) : null;
    },
  };
}

function createStore(env = process.env) {
  if (env.SSJ_SUPABASE_URL && env.SSJ_SUPABASE_KEY && env.SSJ_STORE_SECRET) {
    return createSupabaseStore({ url: env.SSJ_SUPABASE_URL, key: env.SSJ_SUPABASE_KEY, secret: env.SSJ_STORE_SECRET });
  }
  if (env.BLOB_READ_WRITE_TOKEN) return createBlobStore(env.BLOB_READ_WRITE_TOKEN);
  if (env.LINE_BOT_FILE_STORE) return new FileStore(env.LINE_BOT_FILE_STORE);
  throw new Error('No photo store configured. Set SSJ_SUPABASE_URL, SSJ_SUPABASE_KEY and SSJ_STORE_SECRET.');
}

module.exports = { MemoryStore, FileStore, createBlobStore, createBlobStoreFromClient, createSupabaseStore, createStore, blobAlreadyExists };
