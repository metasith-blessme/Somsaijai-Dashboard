// Minimal probe to detect which MiniMax M3 API variant accepts the existing key.
// Sends the smallest possible payload and reports which variant succeeds first.

const fs = require('fs');
const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) {
  console.error('MINIMAX_API_KEY not set');
  process.exit(1);
}

const HOSTS = ['https://api.minimax.io', 'https://api.minimaxi.com'];

function post({ host, path, body, label }) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const url = new URL(host + path);
    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + KEY,
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(buf); } catch (_) {}
          resolve({ label, host, path, status: res.statusCode, body: parsed || buf.slice(0, 400) });
        });
      },
    );
    req.on('error', (e) => resolve({ label, host, path, status: 0, body: e.message }));
    req.write(data);
    req.end();
  });
}

function get({ host, path, label }) {
  return new Promise((resolve) => {
    const url = new URL(host + path);
    const req = https.request(
      {
        method: 'GET',
        hostname: url.hostname,
        path: url.pathname,
        headers: { Authorization: 'Bearer ' + KEY },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(buf); } catch (_) {}
          resolve({ label, host, path, status: res.statusCode, body: parsed || buf.slice(0, 400) });
        });
      },
    );
    req.on('error', (e) => resolve({ label, host, path, status: 0, body: e.message }));
    req.end();
  });
}

(async () => {
  const probe = [];
  for (const host of HOSTS) {
    probe.push(await get({ host, path: '/v1/models', label: 'GET models' }));
  }
  const chatPayload = {
    model: 'MiniMax-M3',
    messages: [{ role: 'user', content: 'ping' }],
    max_completion_tokens: 16,
    thinking: { type: 'adaptive' },
    reasoning_split: true,
  };
  for (const host of HOSTS) {
    probe.push(await post({ host, path: '/v1/chat/completions', body: chatPayload, label: 'POST chat/completions' }));
  }
  const responsesPayload = {
    model: 'MiniMax-M3',
    input: 'ping',
    max_output_tokens: 16,
    reasoning: { effort: 'medium' },
  };
  for (const host of HOSTS) {
    probe.push(await post({ host, path: '/v1/responses', body: responsesPayload, label: 'POST responses' }));
  }

  console.log(JSON.stringify(probe, null, 2));
})();
