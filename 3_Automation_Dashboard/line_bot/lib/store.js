/**
 * Batch state and original photo bytes.
 * MemoryStore is the test double. FileStore is the local dry-run.
 * BlobStore is the production store (Vercel Blob). Photos are private.
 */

class MemoryStore {
  constructor() { this.map = new Map(); }
  async put(key, body) { this.map.set(key, Buffer.from(body)); }
  async get(key) {
    const hit = this.map.get(key);
    return hit ? Buffer.from(hit) : null;
  }
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
  async putJson(key, value) { await this.put(key, Buffer.from(JSON.stringify(value, null, 2))); }
  async getJson(key) {
    const buf = await this.get(key);
    return buf ? JSON.parse(buf.toString('utf8')) : null;
  }
}

function createBlobStore(token) {
  let blob;
  try { blob = require('@vercel/blob'); }
  catch (e) { throw new Error('Install @vercel/blob to store photos. ' + e.message); }
  return {
    async put(key, body, contentType) {
      await blob.put(key, body, {
        access: 'private',
        token,
        contentType: contentType || 'application/octet-stream',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    },
    async get(key) {
      const result = await blob.get(key, { access: 'private', token, useCache: false });
      if (!result || !result.stream) return null;
      const chunks = [];
      for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    },
    async putJson(key, value) { await this.put(key, Buffer.from(JSON.stringify(value)), 'application/json'); },
    async getJson(key) {
      const buf = await this.get(key);
      return buf ? JSON.parse(buf.toString('utf8')) : null;
    },
  };
}

function createStore(env = process.env) {
  if (env.BLOB_READ_WRITE_TOKEN) return createBlobStore(env.BLOB_READ_WRITE_TOKEN);
  if (env.LINE_BOT_FILE_STORE) return new FileStore(env.LINE_BOT_FILE_STORE);
  throw new Error('No photo store configured. Link a Vercel Blob store (BLOB_READ_WRITE_TOKEN).');
}

module.exports = { MemoryStore, FileStore, createBlobStore, createStore };
